package app.libelluz.appblocker;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;
import android.text.TextUtils;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Ponte entre a página /disciplina e o bloqueio nativo. Só existe no APK; no navegador
 * `Capacitor.isPluginAvailable("AppBlocker")` é falso e a página mostra o convite para baixar o app.
 */
@CapacitorPlugin(name = "AppBlocker")
public class AppBlockerPlugin extends Plugin {

    /** Sugestões que aparecem primeiro na lista de apps. */
    private static final Set<String> SUGGESTED = new HashSet<>(
        Arrays.asList(
            "com.instagram.android",
            "com.zhiliaoapp.musically", // TikTok
            "com.ss.android.ugc.trill", // TikTok (outras regiões)
            "com.google.android.youtube",
            "com.twitter.android",
            "com.x.android",
            "com.facebook.katana",
            "com.whatsapp",
            "com.snapchat.android",
            "com.reddit.frontpage",
            "com.netflix.mediaclient",
            "com.discord",
            "com.valvesoftware.android.steam.community",
            "com.pinterest",
            "com.linkedin.android",
            "com.spotify.music",
            "tv.twitch.android.app",
            "com.telegram.messenger",
            "org.telegram.messenger"
        )
    );

    private BlockerStore store() {
        return BlockerStore.get(getContext());
    }

    /* ---------- estado e permissões ---------- */

    @PluginMethod
    public void getInfo(PluginCall call) {
        Context ctx = getContext();
        JSObject perms = new JSObject();
        perms.put("usage", Perms.hasUsageAccess(ctx));
        perms.put("overlay", Perms.canDrawOverlays(ctx));
        perms.put("notifications", Perms.notificationsEnabled(ctx));
        perms.put("notificationAccess", Perms.notificationAccessEnabled(ctx));
        perms.put("battery", Perms.ignoringBatteryOptimizations(ctx));

        JSObject out = new JSObject();
        out.put("platform", "android");
        out.put("canBlock", Perms.canBlock(ctx));
        out.put("running", BlockerService.isRunning());
        out.put("perms", perms);
        call.resolve(out);
    }

    /** Abre a tela de Configurações da permissão pedida (nenhuma delas é um diálogo comum). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String which = call.getString("which", "");
        Context ctx = getContext();
        Uri self = Uri.parse("package:" + ctx.getPackageName());
        Intent i;
        switch (which == null ? "" : which) {
            case "usage":
                i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                break;
            case "overlay":
                i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, self);
                break;
            case "notifications":
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
                break;
            case "notificationAccess":
                i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                break;
            case "battery":
                i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, self);
                break;
            default:
                call.reject("Permissão desconhecida: " + which);
                return;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(i);
        } catch (Throwable t) {
            // Alguns fabricantes não têm a tela: cai para os detalhes do app.
            try {
                ctx.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, self).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Throwable t2) {
                call.reject("Não foi possível abrir as Configurações.");
                return;
            }
        }
        call.resolve();
    }

    /* ---------- lista de apps ---------- */

    @PluginMethod
    public void listApps(PluginCall call) {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> found;
        try {
            found = pm.queryIntentActivities(launcher, 0);
        } catch (Throwable t) {
            found = new ArrayList<>();
        }

        Set<String> seen = new HashSet<>();
        List<JSObject> apps = new ArrayList<>();
        final Collator collator = Collator.getInstance(Locale.forLanguageTag("pt-BR"));
        for (ResolveInfo ri : found) {
            if (ri.activityInfo == null || ri.activityInfo.packageName == null) continue;
            String pkg = ri.activityInfo.packageName;
            if (pkg.equals(ctx.getPackageName()) || !seen.add(pkg)) continue;
            CharSequence label = ri.loadLabel(pm);
            String name = label == null || TextUtils.isEmpty(label) ? pkg : label.toString();
            JSObject o = new JSObject();
            o.put("pkg", pkg);
            o.put("label", name);
            o.put("suggested", SUGGESTED.contains(pkg));
            apps.add(o);
        }
        // Sugestões primeiro, depois alfabético (sem ícones: a lista precisa ser leve).
        Collections.sort(apps, (a, b) -> {
            boolean sa = a.optBoolean("suggested");
            boolean sb = b.optBoolean("suggested");
            if (sa != sb) return sa ? -1 : 1;
            return collator.compare(a.optString("label"), b.optString("label"));
        });

        JSObject out = new JSObject();
        out.put("apps", new JSArray(apps));
        call.resolve(out);
    }

    /* ---------- configuração e sincronismo ---------- */

    @PluginMethod
    public void setConfig(PluginCall call) {
        BlockerStore store = store();

        JSArray apps = call.getArray("apps", null);
        if (apps != null) {
            List<String> packages = new ArrayList<>();
            JSObject labels = new JSObject();
            for (int i = 0; i < apps.length(); i++) {
                JSONObject o = apps.optJSONObject(i);
                if (o == null) continue;
                String pkg = o.optString("pkg", "");
                if (pkg.isEmpty()) continue;
                packages.add(pkg);
                labels.put(pkg, o.optString("label", pkg));
            }
            store.setBlocked(packages, labels);
        }

        Integer base = call.getInt("baseTokens", null);
        if (base != null) store.setBaseTokens(base);
        Integer minutes = call.getInt("minutesPerToken", null);
        if (minutes != null) store.setMinutesPerToken(minutes);
        Boolean notifs = call.getBoolean("blockNotifications", null);
        if (notifs != null) store.setBlockNotifications(notifs);

        Integer tokensLeft = call.getInt("tokensLeft", null);
        if (tokensLeft != null) store.setTokensFromServer(tokensLeft, call.getString("day", null));

        Boolean enabled = call.getBoolean("enabled", null);
        if (enabled != null) store.setEnabled(enabled);

        BlockerService.sync(getContext());
        call.resolve(state());
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(state());
    }

    /** Tira da fila os gastos que o servidor já registrou. */
    @PluginMethod
    public void ack(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        store().ack(BlockerStore.toStringList(ids));
        call.resolve(state());
    }

    private JSObject state() {
        BlockerStore store = store();
        JSObject out = new JSObject();
        out.put("enabled", store.isEnabled());
        out.put("day", store.day());
        out.put("tokensLeft", store.tokensLeft());
        out.put("baseTokens", store.baseTokens());
        out.put("minutesPerToken", store.minutesPerToken());
        out.put("blockNotifications", store.blockNotifications());
        out.put("running", BlockerService.isRunning());
        out.put("blocked", new JSArray(new ArrayList<>(store.blocked())));
        out.put("unlocks", store.unlocks());
        JSONArray pending = store.pending();
        List<Object> queue = new ArrayList<>();
        for (int i = 0; i < pending.length(); i++) {
            Object v = pending.opt(i);
            if (v != null) queue.add(v);
        }
        out.put("pending", new JSArray(queue));
        return out;
    }
}
