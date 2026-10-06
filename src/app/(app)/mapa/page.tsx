import Link from "next/link";
import { auth } from "@/auth";
import { MapaView } from "@/components/mapa/mapa-view";
import { getMapa } from "@/server/mapa-queries";
import { ensureTreeEnriched } from "@/server/seed";

export default async function MapaPage() {
  const userId = (await auth())!.user!.id!;
  await ensureTreeEnriched(userId);
  const data = await getMapa(userId);
  if (!data.topics.length)
    return (
      <section className="card-soft p-10 text-center">
        <h1 className="text-xl font-bold">Mapa</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sua árvore de estudos está vazia. Carregue a árvore do ENEM em Aulas.</p>
        <Link href="/aulas" className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
          Ir para Aulas
        </Link>
      </section>
    );
  return <MapaView data={data} />;
}
