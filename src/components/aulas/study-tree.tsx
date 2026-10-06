"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronRight, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/server/queries";
import { addNode, deleteNode, renameNode, resetTreeIfEmpty } from "@/server/actions";

const AREA_STYLE: Record<string, string> = {
  Matemática: "from-blue-500 to-blue-400",
  Natureza: "from-emerald-500 to-emerald-400",
  Linguagens: "from-amber-500 to-amber-400",
  Humanas: "from-rose-500 to-rose-400",
  Redação: "from-violet-500 to-violet-400",
};
const NEXT_LABEL = { area: "disciplina", subject: "tópico", topic: "habilidade", skill: "" } as const;

export function StudyTree({ tree, minutes }: { tree: TreeNode[]; minutes: Record<string, number> }) {
  const [tab, setTab] = useState<"Estrutura" | "Materiais">("Estrutura");
  const [, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Aulas</h1>
        {(["Estrutura", "Materiais"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full border-2 px-4 py-1 text-sm font-semibold",
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-primary/70 text-primary",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Materiais" ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">
          Upload de PDFs, vídeos e links chega na Fase 2.
        </div>
      ) : !tree.length ? (
        <div className="card-soft p-10 text-center">
          <p className="text-sm text-muted-foreground">Sua árvore está vazia.</p>
          <button onClick={() => start(() => resetTreeIfEmpty())} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
            Carregar árvore do ENEM
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Área → Disciplina → Tópico → Habilidade. Tudo editável: renomeie, crie e apague à vontade. Toque no ▶ para estudar o tópico.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {tree.map((area) => (
              <section key={area.id} className="card-soft overflow-hidden">
                <header className={cn("flex items-center bg-gradient-to-r px-4 py-3 text-white", AREA_STYLE[area.name] ?? "from-primary to-blue-400")}>
                  <h2 className="flex-1 text-lg font-bold">{area.name}</h2>
                  <span className="text-xs opacity-90">{area.children.length} disciplinas</span>
                </header>
                <ul className="divide-y">
                  {area.children.map((s) => (
                    <NodeRow key={s.id} node={s} subject={s.name} minutes={minutes} depth={0} />
                  ))}
                </ul>
                <AddRow parentId={area.id} label="disciplina" />
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NodeRow({ node, subject, minutes, depth }: { node: TreeNode; subject: string; minutes: Record<string, number>; depth: number }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [, start] = useTransition();
  const min = node.level === "topic" ? minutes[`${subject}/${node.name}`] ?? 0 : node.children.reduce((a, t) => a + (minutes[`${node.name}/${t.name}`] ?? 0), 0);
  const canOpen = node.level !== "skill";
  const save = () => {
    setEditing(false);
    if (name.trim() && name !== node.name) start(() => renameNode(node.id, name));
  };
  return (
    <li>
      <div className="group flex items-center gap-2 px-3 py-2" style={{ paddingLeft: 12 + depth * 18 }}>
        <button
          aria-label={open ? "Fechar" : "Abrir"}
          onClick={() => setOpen(!open)}
          className={cn("grid size-6 place-items-center rounded text-muted-foreground", !canOpen && "invisible")}
        >
          <ChevronRight className={cn("size-4 transition", open && "rotate-90")} />
        </button>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="flex-1 rounded bg-muted px-2 py-0.5 text-sm outline-none"
          />
        ) : (
          <button onClick={() => canOpen && setOpen(!open)} className={cn("flex-1 text-left text-sm", node.level === "subject" && "font-semibold")}>
            {node.name}
            {node.level !== "skill" && node.children.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({node.children.length})</span>
            )}
          </button>
        )}
        {min > 0 && <span className="text-xs tabular-nums text-muted-foreground">{(min / 60).toFixed(1).replace(".", ",")}h</span>}
        <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
          <button aria-label="Renomear" onClick={() => setEditing(true)} className="grid size-7 place-items-center rounded hover:bg-muted">
            <Pencil className="size-3.5" />
          </button>
          <button
            aria-label="Apagar"
            onClick={() => confirm(`Apagar "${node.name}" e tudo dentro?`) && start(() => deleteNode(node.id))}
            className="grid size-7 place-items-center rounded hover:bg-muted"
          >
            <Trash2 className="size-3.5" />
          </button>
          {node.level === "topic" && (
            <Link aria-label="Estudar" href={`/foco?topic=${encodeURIComponent(node.name)}`} className="grid size-7 place-items-center rounded-full bg-primary text-white">
              <Play className="size-3.5 fill-current" />
            </Link>
          )}
        </div>
      </div>
      {open && canOpen && (
        <ul className="bg-muted/40">
          {node.children.map((c) => (
            <NodeRow key={c.id} node={c} subject={node.level === "subject" ? node.name : subject} minutes={minutes} depth={depth + 1} />
          ))}
          <AddRow parentId={node.id} label={NEXT_LABEL[node.level]} depth={depth + 1} />
        </ul>
      )}
    </li>
  );
}

function AddRow({ parentId, label, depth = 0 }: { parentId: string; label: string; depth?: number }) {
  const [v, setV] = useState("");
  const [, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = v.trim();
        if (!n) return;
        setV("");
        start(() => addNode(parentId, n));
      }}
      className="flex items-center gap-2 px-3 py-1.5"
      style={{ paddingLeft: 12 + depth * 18 + 32 }}
    >
      <Plus className="size-4 text-muted-foreground" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={`Nova ${label}…`} className="flex-1 bg-transparent text-sm outline-none" />
    </form>
  );
}
