package app.libelluz.appblocker;

import android.app.AppOpsManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;

/** Checagem das permissões especiais que o Modo Disciplina usa. Nenhuma delas é um diálogo comum. */
final class Perms {

    private Perms() {}

    /** Configurações > Acesso ao uso (UsageStats). */
    static boolean hasUsageAccess(Context ctx) {
        AppOpsManager aom = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        if (aom == null) return false;
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = aom.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        } else {
            mode = legacyCheckOp(aom, ctx);
        }
        if (mode == AppOpsManager.MODE_DEFAULT) {
            return ctx.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED;
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @SuppressWarnings("deprecation")
    private static int legacyCheckOp(AppOpsManager aom, Context ctx) {
        return aom.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
    }

    /** Configurações > Sobrepor a outros apps. */
    static boolean canDrawOverlays(Context ctx) {
        return Settings.canDrawOverlays(ctx);
    }

    /** Notificações do app (a notificação "Modo Disciplina ativo"). Opcional: o serviço roda sem ela. */
    static boolean notificationsEnabled(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.areNotificationsEnabled();
    }

    /** Fora da otimização de bateria (o Android mata menos o serviço). Opcional, mas recomendado. */
    static boolean ignoringBatteryOptimizations(Context ctx) {
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    /** Configurações > Notificações > Acesso a notificações (para bloquear as notificações dos apps). */
    static boolean notificationAccessEnabled(Context ctx) {
        String enabled = Settings.Secure.getString(ctx.getContentResolver(), "enabled_notification_listeners");
        if (enabled == null || enabled.isEmpty()) return false;
        String pkg = ctx.getPackageName();
        for (String entry : enabled.split(":")) {
            if (entry.startsWith(pkg + "/")) return true;
        }
        return false;
    }

    /** O mínimo para o bloqueio funcionar. */
    static boolean canBlock(Context ctx) {
        return hasUsageAccess(ctx) && canDrawOverlays(ctx);
    }
}
