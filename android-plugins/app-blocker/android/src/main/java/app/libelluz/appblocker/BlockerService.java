package app.libelluz.appblocker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import java.util.Set;

/**
 * Serviço em primeiro plano do Modo Disciplina.
 *
 * A cada ~1s pergunta ao UsageStatsManager qual app está na frente. Se for um app bloqueado e sem
 * token válido, mostra a {@link GateView} por cima (janela de overlay). Não depende de
 * AccessibilityService: o Play Protect atrapalha a instalação de APKs fora da loja que pedem acessibilidade.
 */
public class BlockerService extends Service {

    private static final String TAG = "LibelluzBlocker";

    static final String ACTION_SYNC = "app.libelluz.appblocker.SYNC";
    static final String ACTION_STOP = "app.libelluz.appblocker.STOP";

    private static final String CHANNEL_ID = "libelluz_disciplina";
    private static final int NOTIF_ID = 4812;
    private static final long POLL_MS = 900L;
    /** Janela de eventos lida na primeira volta (o suficiente para saber o app atual). */
    private static final long FIRST_LOOKBACK_MS = 60_000L;

    private static volatile boolean running;

    private BlockerStore store;
    private UsageStatsManager usage;
    private WindowManager windows;
    private Handler handler;

    private GateView gate;
    private String gatePkg;
    private long lastEventAt;
    private String foreground = "";

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            try {
                step();
            } catch (Throwable t) {
                Log.w(TAG, "falha no ciclo do bloqueio", t);
            }
            if (handler != null) handler.postDelayed(this, POLL_MS);
        }
    };

    /** Liga ou desliga o serviço conforme o estado salvo e as permissões. */
    static void sync(Context ctx) {
        BlockerStore store = BlockerStore.get(ctx);
        boolean should = store.isEnabled() && !store.blocked().isEmpty() && Perms.canBlock(ctx);
        Intent i = new Intent(ctx, BlockerService.class).setAction(should ? ACTION_SYNC : ACTION_STOP);
        try {
            if (should && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else if (should) {
                ctx.startService(i);
            } else if (running) {
                ctx.startService(i);
            }
        } catch (Throwable t) {
            // Ex.: o Android não deixa iniciar serviço em primeiro plano com o app em segundo plano.
            Log.w(TAG, "não foi possível sincronizar o serviço", t);
        }
    }

    static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        store = BlockerStore.get(this);
        usage = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        windows = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!running) {
            startInForeground();
            running = true;
            handler.removeCallbacks(tick);
            handler.post(tick);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (handler != null) handler.removeCallbacks(tick);
        hideGate();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /* ---------- notificação discreta ---------- */

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Modo Disciplina", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Avisa que o bloqueio de apps está ativo.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : legacyBuilder();
        b
            .setSmallIcon(R.drawable.ic_stat_disciplina)
            .setContentTitle("Modo Disciplina ativo")
            .setContentText("Tokens de hoje: " + store.tokensLeft())
            .setOngoing(true)
            .setShowWhen(false);
        PendingIntent open = libelluzIntent();
        if (open != null) b.setContentIntent(open);
        try {
            startForeground(NOTIF_ID, b.build());
        } catch (Throwable t) {
            Log.w(TAG, "startForeground recusado", t);
        }
    }

    @SuppressWarnings("deprecation")
    private Notification.Builder legacyBuilder() {
        return new Notification.Builder(this);
    }

    private PendingIntent libelluzIntent() {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i == null) return null;
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 0, i, flags);
    }

    /* ---------- ciclo ---------- */

    private void step() {
        readForeground();
        if (!store.isEnabled()) {
            hideGate();
            stopSelf();
            return;
        }
        String pkg = foreground;
        if (pkg.isEmpty() || pkg.equals(getPackageName())) {
            hideGate();
            return;
        }
        Set<String> blocked = store.blocked();
        if (!blocked.contains(pkg)) {
            hideGate();
            return;
        }
        long until = store.unlockedUntil(pkg);
        long now = System.currentTimeMillis();
        if (until > now) {
            hideGate(); // ainda dentro do tempo pago com o token
            return;
        }
        showGate(pkg, until > 0);
    }

    /** Último app que veio para a frente, pelos eventos do UsageStats. */
    private void readForeground() {
        if (usage == null) return;
        long now = System.currentTimeMillis();
        long since = lastEventAt > 0 ? lastEventAt + 1 : now - FIRST_LOOKBACK_MS;
        UsageEvents events;
        try {
            events = usage.queryEvents(since, now + 1);
        } catch (Throwable t) {
            return; // sem permissão de acesso ao uso
        }
        if (events == null) return;
        UsageEvents.Event ev = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(ev);
            int type = ev.getEventType();
            boolean resumed = type == UsageEvents.Event.ACTIVITY_RESUMED || type == UsageEvents.Event.MOVE_TO_FOREGROUND;
            if (resumed && ev.getPackageName() != null) {
                foreground = ev.getPackageName();
            }
            if (ev.getTimeStamp() > lastEventAt) lastEventAt = ev.getTimeStamp();
        }
    }

    /* ---------- overlay ---------- */

    private void showGate(final String pkg, boolean timeUp) {
        if (gate != null && pkg.equals(gatePkg)) return;
        if (windows == null || !Perms.canDrawOverlays(this)) return;
        hideGate();

        GateView view = new GateView(
            this,
            labelOf(pkg),
            iconOf(pkg),
            store.tokensLeft(),
            store.minutesPerToken(),
            timeUp,
            new GateView.Listener() {
                @Override
                public void onEnter() {
                    boolean ok = store.spendToken(pkg) != null;
                    hideGate();
                    if (!ok) showGate(pkg, false); // acabaram os tokens: troca para a tela "sem tokens"
                }

                @Override
                public void onBack() {
                    hideGate();
                    goHome();
                }

                @Override
                public void onOpenLibelluz() {
                    hideGate();
                    openLibelluz();
                }
            }
        );

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : legacyOverlayType(),
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        lp.gravity = Gravity.TOP | Gravity.START;
        try {
            windows.addView(view, lp);
            gate = view;
            gatePkg = pkg;
        } catch (Throwable t) {
            Log.w(TAG, "não foi possível mostrar a tela do token", t);
        }
    }

    @SuppressWarnings("deprecation")
    private static int legacyOverlayType() {
        return WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
    }

    private void hideGate() {
        if (gate == null) return;
        try {
            windows.removeView(gate);
        } catch (Throwable ignored) {
            // já estava fora da tela
        }
        gate = null;
        gatePkg = null;
    }

    private void goHome() {
        Intent home = new Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_HOME)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(home);
        } catch (Throwable t) {
            Log.w(TAG, "não foi possível voltar para a tela inicial", t);
        }
    }

    private void openLibelluz() {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i == null) return;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (Throwable t) {
            Log.w(TAG, "não foi possível abrir o Libelluz", t);
        }
    }

    private String labelOf(String pkg) {
        String saved = store.labelOf(pkg);
        if (!saved.equals(pkg)) return saved;
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Throwable t) {
            return pkg;
        }
    }

    private Drawable iconOf(String pkg) {
        try {
            return getPackageManager().getApplicationIcon(pkg);
        } catch (Throwable t) {
            return null;
        }
    }
}
