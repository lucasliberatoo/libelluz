package app.libelluz.appblocker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Religa o Modo Disciplina depois de reiniciar o celular ou atualizar o app. */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        BlockerService.sync(context);
    }
}
