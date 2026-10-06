package app.libelluz.appblocker;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

/**
 * Bloqueio das notificações dos apps escolhidos: enquanto não há token valendo para o app,
 * a notificação é cancelada assim que chega. Opcional — depende de
 * "Configurações > Notificações > Acesso a notificações".
 */
public class NotifBlockerService extends NotificationListenerService {

    private static final String TAG = "LibelluzNotif";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        try {
            BlockerStore store = BlockerStore.get(this);
            if (!store.isEnabled() || !store.blockNotifications()) return;
            String pkg = sbn.getPackageName();
            if (pkg == null || pkg.equals(getPackageName())) return;
            if (!store.blocked().contains(pkg)) return;
            if (store.unlockedUntil(pkg) > System.currentTimeMillis()) return; // token valendo: deixa passar
            cancelNotification(sbn.getKey());
        } catch (Throwable t) {
            Log.w(TAG, "não foi possível bloquear a notificação", t);
        }
    }
}
