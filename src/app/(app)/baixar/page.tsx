import { Foguinho } from "@/components/brand";

// Publicado pelo workflow "APK Android" a cada nova versão da casca do app.
const APK_URL = "/libelluz.apk";

export default function BaixarPage() {
  return (
    <section className="card-soft mx-auto max-w-lg space-y-4 p-6 text-center">
      <Foguinho stage={1} className="mx-auto size-24" />
      <h1 className="text-xl font-bold">Libelluz no celular</h1>
      <div className="card-inner space-y-2 p-4 text-left text-sm">
        <p className="font-semibold">Android (APK)</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Toque em baixar e abra o arquivo.</li>
          <li>Se o Android pedir, permita instalar de &quot;fontes desconhecidas&quot;.</li>
          <li>Pronto: o app abre direto na sua conta e se atualiza sozinho com o site.</li>
        </ol>
        <a href={APK_URL} download className="mt-2 block rounded-full bg-primary py-2.5 text-center font-bold text-white">
          Baixar APK
        </a>
      </div>
      <div className="card-inner space-y-1 p-4 text-left text-sm">
        <p className="font-semibold">iPhone ou qualquer navegador</p>
        <p className="text-muted-foreground">
          Abra o site no navegador e use &quot;Adicionar à tela de início&quot; (no Chrome, &quot;Instalar app&quot;).
        </p>
      </div>
    </section>
  );
}
