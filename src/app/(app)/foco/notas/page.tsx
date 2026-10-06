import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { allFocusNotes } from "@/server/focus-tools";
import { FocusNotesList } from "@/components/focus/focus-notes-list";

export default async function NotasFocoPage() {
  const groups = await allFocusNotes();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card-soft flex items-center gap-2 p-3">
        <Link href="/foco" aria-label="Voltar" className="rounded-full p-1.5 hover:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-tight">Notas do foco</h1>
          <p className="text-xs text-muted-foreground">Notas, insights, áudios e checklists das suas sessões</p>
        </div>
      </div>
      <FocusNotesList groups={groups} />
    </div>
  );
}
