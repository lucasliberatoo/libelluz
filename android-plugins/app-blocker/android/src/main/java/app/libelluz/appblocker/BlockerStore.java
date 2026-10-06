package app.libelluz.appblocker;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Estado do Modo Disciplina guardado em SharedPreferences, para funcionar com o app fechado.
 *
 * O servidor é quem sabe quantos tokens a pessoa tem hoje (base + bônus de XP). O app manda esse número
 * em setConfig; aqui só descontamos os tokens gastos e, se virar o dia sem o app ser aberto, voltamos à base.
 * Cada token gasto fica numa fila ("pending") até o app confirmar que o servidor registrou (ackIds).
 *
 * Tudo roda no mesmo processo; os métodos são synchronized na instância única.
 */
final class BlockerStore {

    private static final String PREFS = "libelluz_app_blocker";
    private static final String K_ENABLED = "enabled";
    private static final String K_BLOCKED = "blocked"; // JSON array de pacotes
    private static final String K_LABELS = "labels"; // JSON object pacote -> nome
    private static final String K_TOKENS = "tokensLeft";
    private static final String K_BASE = "baseTokens";
    private static final String K_MINUTES = "minutesPerToken";
    private static final String K_DAY = "day";
    private static final String K_UNLOCKS = "unlocks"; // JSON object pacote -> epoch ms
    private static final String K_PENDING = "pending"; // JSON array de gastos ainda não sincronizados
    private static final String K_NOTIFS = "blockNotifications";

    static final int DEFAULT_BASE = 3;
    static final int DEFAULT_MINUTES = 10;
    private static final int MAX_PENDING = 200;

    private static BlockerStore instance;

    private final SharedPreferences prefs;

    private BlockerStore(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized BlockerStore get(Context context) {
        if (instance == null) instance = new BlockerStore(context);
        return instance;
    }

    /** Dia de hoje no fuso do Libelluz (o mesmo `dayOf()` do servidor). */
    static String today() {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("America/Sao_Paulo"));
        return f.format(new Date());
    }

    /* ---------- leitura ---------- */

    synchronized boolean isEnabled() {
        return prefs.getBoolean(K_ENABLED, false);
    }

    synchronized boolean blockNotifications() {
        return prefs.getBoolean(K_NOTIFS, true);
    }

    synchronized Set<String> blocked() {
        Set<String> out = new HashSet<>();
        JSONArray arr = readArray(K_BLOCKED);
        for (int i = 0; i < arr.length(); i++) {
            String p = arr.optString(i, "");
            if (!p.isEmpty()) out.add(p);
        }
        return out;
    }

    synchronized String labelOf(String pkg) {
        String l = readObject(K_LABELS).optString(pkg, "");
        return l.isEmpty() ? pkg : l;
    }

    synchronized int tokensLeft() {
        rolloverIfNeeded();
        return prefs.getInt(K_TOKENS, prefs.getInt(K_BASE, DEFAULT_BASE));
    }

    synchronized int baseTokens() {
        return prefs.getInt(K_BASE, DEFAULT_BASE);
    }

    synchronized int minutesPerToken() {
        return prefs.getInt(K_MINUTES, DEFAULT_MINUTES);
    }

    /** Até quando (epoch ms) o app está liberado; 0 se não está. */
    synchronized long unlockedUntil(String pkg) {
        rolloverIfNeeded();
        return readObject(K_UNLOCKS).optLong(pkg, 0L);
    }

    synchronized JSONArray pending() {
        return readArray(K_PENDING);
    }

    synchronized JSONObject unlocks() {
        rolloverIfNeeded();
        JSONObject src = readObject(K_UNLOCKS);
        JSONObject out = new JSONObject();
        long now = System.currentTimeMillis();
        Iterator<String> it = src.keys();
        while (it.hasNext()) {
            String k = it.next();
            long until = src.optLong(k, 0L);
            if (until > now) put(out, k, until);
        }
        return out;
    }

    synchronized String day() {
        rolloverIfNeeded();
        return prefs.getString(K_DAY, today());
    }

    /* ---------- escrita ---------- */

    /** Virou o dia sem sincronizar: os tokens voltam à base (o bônus de XP começa em zero a cada dia). */
    private void rolloverIfNeeded() {
        String today = today();
        String stored = prefs.getString(K_DAY, null);
        if (today.equals(stored)) return;
        prefs.edit().putString(K_DAY, today).putInt(K_TOKENS, prefs.getInt(K_BASE, DEFAULT_BASE)).putString(K_UNLOCKS, "{}").apply();
    }

    synchronized void setEnabled(boolean enabled) {
        prefs.edit().putBoolean(K_ENABLED, enabled).apply();
    }

    /** Apps bloqueados (pacote -> nome para mostrar). */
    synchronized void setBlocked(Collection<String> packages, JSONObject labels) {
        JSONArray arr = new JSONArray();
        for (String p : packages) arr.put(p);
        prefs.edit().putString(K_BLOCKED, arr.toString()).putString(K_LABELS, labels == null ? "{}" : labels.toString()).apply();
    }

    synchronized void setBlockNotifications(boolean on) {
        prefs.edit().putBoolean(K_NOTIFS, on).apply();
    }

    synchronized void setBaseTokens(int base) {
        prefs.edit().putInt(K_BASE, clamp(base, 0, 50)).apply();
    }

    synchronized void setMinutesPerToken(int minutes) {
        prefs.edit().putInt(K_MINUTES, clamp(minutes, 1, 240)).apply();
    }

    /** Tira da fila os gastos que o servidor já registrou. */
    synchronized void ack(Collection<String> ids) {
        if (ids.isEmpty()) return;
        JSONArray src = readArray(K_PENDING);
        JSONArray out = new JSONArray();
        for (int i = 0; i < src.length(); i++) {
            JSONObject o = src.optJSONObject(i);
            if (o != null && !ids.contains(o.optString("id"))) out.put(o);
        }
        prefs.edit().putString(K_PENDING, out.toString()).apply();
    }

    /**
     * Tokens que o servidor calculou para o dia `serverDay`, já contando os gastos que ele registrou.
     * Os gastos de hoje que ainda estão na fila (feitos depois da leitura do app) também são descontados.
     */
    synchronized void setTokensFromServer(int serverLeft, String serverDay) {
        rolloverIfNeeded();
        String today = today();
        if (serverDay != null && !serverDay.equals(today)) return; // número de outro dia: ignora
        int stillPending = 0;
        JSONArray pend = readArray(K_PENDING);
        for (int i = 0; i < pend.length(); i++) {
            JSONObject o = pend.optJSONObject(i);
            if (o != null && today.equals(o.optString("day"))) stillPending++;
        }
        prefs.edit().putInt(K_TOKENS, Math.max(0, serverLeft - stillPending)).putString(K_DAY, today).apply();
    }

    /**
     * Gasta 1 token para `pkg`: libera o app por minutesPerToken minutos e põe o gasto na fila.
     * Retorna o registro do gasto, ou null se não havia token.
     */
    synchronized JSONObject spendToken(String pkg) {
        rolloverIfNeeded();
        int left = prefs.getInt(K_TOKENS, prefs.getInt(K_BASE, DEFAULT_BASE));
        if (left <= 0) return null;
        int minutes = minutesPerToken();
        long now = System.currentTimeMillis();
        JSONObject unlocks = readObject(K_UNLOCKS);
        put(unlocks, pkg, now + minutes * 60_000L);

        JSONObject entry = new JSONObject();
        put(entry, "id", UUID.randomUUID().toString());
        put(entry, "pkg", pkg);
        put(entry, "label", labelOf(pkg));
        put(entry, "at", now);
        put(entry, "day", today());
        put(entry, "minutes", minutes);
        JSONArray pend = readArray(K_PENDING);
        pend.put(entry);
        // Nunca deixa a fila crescer sem limite (ex.: semanas sem abrir o app).
        if (pend.length() > MAX_PENDING) {
            JSONArray trimmed = new JSONArray();
            for (int i = pend.length() - MAX_PENDING; i < pend.length(); i++) trimmed.put(pend.opt(i));
            pend = trimmed;
        }

        prefs
            .edit()
            .putInt(K_TOKENS, left - 1)
            .putString(K_UNLOCKS, unlocks.toString())
            .putString(K_PENDING, pend.toString())
            .apply();
        return entry;
    }

    /* ---------- util ---------- */

    static List<String> toStringList(JSONArray arr) {
        List<String> out = new ArrayList<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            Object v = arr.opt(i);
            if (v instanceof String && !((String) v).isEmpty()) out.add((String) v);
        }
        return out;
    }

    private JSONArray readArray(String key) {
        try {
            return new JSONArray(prefs.getString(key, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private JSONObject readObject(String key) {
        try {
            return new JSONObject(prefs.getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static void put(JSONObject o, String k, Object v) {
        try {
            o.put(k, v);
        } catch (JSONException ignored) {
            // chave nula: não acontece aqui
        }
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
