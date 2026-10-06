package app.libelluz.appblocker;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * A tela do token, no estilo do Libelluz (fundo azul, cartão branco nos botões).
 * Montada em código para não depender de temas/recursos do app que hospeda o plugin.
 *
 * "Você está prestes a gastar 1 token. Restam 2. É realmente necessário? [ENTRAR] [VOLTAR]"
 */
@SuppressLint("ViewConstructor")
final class GateView extends FrameLayout {

    interface Listener {
        void onEnter();

        void onBack();

        void onOpenLibelluz();
    }

    private static final int BLUE = Color.rgb(0x2f, 0x5b, 0xff);
    private static final int BLUE_DARK = Color.rgb(0x1a, 0x37, 0xc9);
    private static final int ENTER_DELAY_S = 3; // um respiro antes de poder entrar

    private final Listener listener;
    private TextView enterButton;
    private int countdown = ENTER_DELAY_S;
    private final Runnable countdownTick = new Runnable() {
        @Override
        public void run() {
            countdown--;
            if (enterButton == null) return;
            if (countdown <= 0) {
                enterButton.setText("ENTRAR");
                enterButton.setEnabled(true);
                enterButton.setAlpha(1f);
            } else {
                enterButton.setText("ENTRAR (" + countdown + ")");
                postDelayed(this, 1000);
            }
        }
    };

    GateView(Context ctx, String appLabel, Drawable appIcon, int tokensLeft, int minutes, boolean timeUp, Listener listener) {
        super(ctx);
        this.listener = listener;
        setFocusable(true);
        setFocusableInTouchMode(true);
        setClickable(true); // nada passa para o app de baixo

        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { BLUE, BLUE_DARK });
        setBackground(bg);

        LinearLayout col = new LinearLayout(ctx);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = dp(28);
        col.setPadding(pad, pad, pad, pad);
        LayoutParams colLp = new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        addView(col, colLp);

        TextView brand = text(ctx, "LIBELLUZ · MODO DISCIPLINA", 12, true, 0.75f);
        brand.setLetterSpacing(0.12f);
        col.addView(brand, wrap(0, 20));

        // Ícone do app num quadrado branco arredondado
        FrameLayout iconBox = new FrameLayout(ctx);
        GradientDrawable iconBg = new GradientDrawable();
        iconBg.setColor(Color.WHITE);
        iconBg.setCornerRadius(dp(24));
        iconBox.setBackground(iconBg);
        iconBox.setPadding(dp(12), dp(12), dp(12), dp(12));
        ImageView icon = new ImageView(ctx);
        if (appIcon != null) icon.setImageDrawable(appIcon);
        iconBox.addView(icon, new LayoutParams(dp(56), dp(56)));
        col.addView(iconBox, wrap(0, 20));

        if (tokensLeft > 0) {
            String title = timeUp ? "Seu tempo no " + appLabel + " acabou." : "Você está prestes a gastar 1 token.";
            col.addView(text(ctx, title, 24, true, 1f), wrap(0, 10));
            col.addView(text(ctx, "Restam " + tokensLeft + ".", 20, true, 0.95f), wrap(0, 12));
            col.addView(tokenDots(ctx, tokensLeft), wrap(0, 16));
            col.addView(text(ctx, "É realmente necessário?", 22, true, 1f), wrap(0, 8));
            String sub = "1 token = " + minutes + " min no " + appLabel;
            col.addView(text(ctx, sub, 15, false, 0.8f), wrap(0, 32));
        } else {
            col.addView(text(ctx, "Seus tokens de hoje acabaram.", 24, true, 1f), wrap(0, 10));
            col.addView(text(ctx, "Estude no Libelluz para ganhar mais: o XP do dia vira token.", 16, false, 0.85f), wrap(0, 32));
        }

        LinearLayout row = new LinearLayout(ctx);
        row.setOrientation(LinearLayout.HORIZONTAL);
        col.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        if (tokensLeft > 0) {
            enterButton = button(ctx, "ENTRAR (" + ENTER_DELAY_S + ")", false);
            enterButton.setEnabled(false);
            enterButton.setAlpha(0.6f);
            enterButton.setOnClickListener(v -> {
                v.setEnabled(false);
                listener.onEnter();
            });
            row.addView(enterButton, weighted(0, 6));
        } else {
            TextView study = button(ctx, "ESTUDAR", false);
            study.setOnClickListener(v -> listener.onOpenLibelluz());
            row.addView(study, weighted(0, 6));
        }
        TextView back = button(ctx, "VOLTAR", true);
        back.setOnClickListener(v -> listener.onBack());
        row.addView(back, weighted(6, 0));
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        requestFocus();
        if (enterButton != null) postDelayed(countdownTick, 1000);
    }

    @Override
    protected void onDetachedFromWindow() {
        removeCallbacks(countdownTick);
        super.onDetachedFromWindow();
    }

    /** O botão voltar do sistema conta como VOLTAR. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) listener.onBack();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    /* ---------- peças ---------- */

    private View tokenDots(Context ctx, int n) {
        if (n > 10) return text(ctx, "🪙 × " + n, 18, true, 1f);
        LinearLayout dots = new LinearLayout(ctx);
        dots.setOrientation(LinearLayout.HORIZONTAL);
        dots.setGravity(Gravity.CENTER);
        for (int i = 0; i < n; i++) {
            View d = new View(ctx);
            GradientDrawable g = new GradientDrawable();
            g.setShape(GradientDrawable.OVAL);
            g.setColor(Color.rgb(0xff, 0xc8, 0x3d));
            g.setStroke(dp(2), Color.WHITE);
            d.setBackground(g);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(18), dp(18));
            lp.setMargins(dp(4), 0, dp(4), 0);
            dots.addView(d, lp);
        }
        return dots;
    }

    private TextView text(Context ctx, String s, int sp, boolean bold, float alpha) {
        TextView t = new TextView(ctx);
        t.setText(s);
        t.setTextColor(Color.WHITE);
        t.setAlpha(alpha);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setGravity(Gravity.CENTER);
        t.setTypeface(Typeface.create(Typeface.SANS_SERIF, bold ? Typeface.BOLD : Typeface.NORMAL));
        return t;
    }

    private TextView button(Context ctx, String label, boolean solid) {
        TextView b = new TextView(ctx);
        b.setText(label);
        b.setGravity(Gravity.CENTER);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
        b.setLetterSpacing(0.06f);
        b.setMinHeight(dp(56));
        b.setClickable(true);
        b.setFocusable(true);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(28));
        if (solid) {
            g.setColor(Color.WHITE);
            b.setTextColor(BLUE);
        } else {
            g.setColor(Color.TRANSPARENT);
            g.setStroke(dp(2), Color.WHITE);
            b.setTextColor(Color.WHITE);
        }
        b.setBackground(g);
        return b;
    }

    private LinearLayout.LayoutParams wrap(int top, int bottom) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        lp.setMargins(0, dp(top), 0, dp(bottom));
        return lp;
    }

    private LinearLayout.LayoutParams weighted(int left, int right) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMargins(dp(left), 0, dp(right), 0);
        return lp;
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
