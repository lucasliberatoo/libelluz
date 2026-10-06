import { CairnLogo } from "@/components/brand";

export function SetupNeeded() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <section className="card-soft max-w-md p-8 text-center">
        <CairnLogo className="mx-auto size-14" />
        <h1 className="mt-3 text-xl font-bold">Falta ligar o banco</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Na Vercel, abra o projeto <b>libelluz</b> → <b>Storage</b> → <b>Create</b> → <b>Neon</b>. Isso cria o{" "}
          <code>DATABASE_URL</code>. Depois é só fazer um novo deploy.
        </p>
      </section>
    </main>
  );
}
