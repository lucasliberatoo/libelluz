import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { auth, isAdminEmail } from "@/auth";
import { getDb, schema } from "@/db";
import { createInvite } from "@/server/actions";

export default async function ConvitesPage() {
  const s = await auth();
  if (!isAdminEmail(s?.user?.email)) redirect("/");
  const db = getDb();
  const [list, people] = await Promise.all([
    db.query.invites.findMany({ orderBy: desc(schema.invites.createdAt) }),
    db.query.users.findMany({ columns: { id: true, name: true, email: true } }),
  ]);
  const who = new Map(people.map((p) => [p.id, p.name ?? p.email]));
  return (
    <section className="card-soft space-y-4 p-5">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-xl font-bold">Convites</h1>
        <form action={createInvite}>
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">Gerar convite</button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">Cada código vale para uma pessoa. Mande o código e o link /cadastro.</p>
      <ul className="divide-y">
        {list.map((i) => (
          <li key={i.code} className="flex items-center gap-3 py-2">
            <code className="rounded-lg bg-muted px-2 py-1 font-mono text-sm font-bold tracking-widest">{i.code}</code>
            <span className="flex-1 text-sm text-muted-foreground">
              {i.usedBy ? `usado por ${who.get(i.usedBy) ?? "alguém"}` : "disponível"}
            </span>
          </li>
        ))}
        {!list.length && <li className="py-4 text-sm text-muted-foreground">Nenhum convite ainda.</li>}
      </ul>
    </section>
  );
}
