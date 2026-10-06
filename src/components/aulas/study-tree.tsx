"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronRight, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASES, RELEVANCES, relevanceRank } from "@/lib/template-tree";
import type { TreeNode } from "@/server/queries";
import { addNode, deleteNode, renameNode, resetTreeIfEmpty } from "@/server/actions";
import { setNodeMeta } from "@/server/mapa-actions";

const AREA_STYLE: Record<string, string> = {
  Matemática: "from-blue-500 to-blue-400",
  Natureza: "from-emerald-500 to-emerald-400",
  Linguagens: "from-amber-500 to-amber-400",
  Humanas: "from-rose-500 to-rose-400",
  Redação: "from-violet-500 to-violet-400",
};
const NEXT_LABEL = {
  area: "disciplina",
  subject: "tópico",
  topic: "habilidade",
  skill: "",
} as const;

/** Sub-abas de Aulas: Estrutura (árvore) e Materiais. */
export function AulasTabs({ active, children }: { active: "estrutura" | "materiais"; children?: React.ReactNode }) {
  const tabs = [
    { key: "estrutura", label: "Estrutura", href: "/aulas" },
    { key: "materiais", label: "Materiais", href: "/aulas/materiais" },
  ] as const;
  return (
    <section className="card-soft space-y-2 p-3 md:p-4">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Aulas</h1>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "rounded-full border-2 px-4 py-1 text-sm font-semibold",
              active === t.key ? "border-primary bg-primary text-primary-foreground" : "border-primary/70 text-primary hover:bg-accent",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </section>
  );
}

export function StudyTree({ tree, minutes }: { tree: TreeNode[]; minutes: Record<string, number> }) {
  const [, start] = useTransition();
  return (
    <div className="space-y-4">
      <AulasTabs active="estrutura">
        {tree.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Área → Disciplina → Tópico → Habilidade. Tudo editável: renomeie, mude fase e relevância, crie e apague à vontade. Toque no ▶ para estudar
            o tópico. O progresso fica no{" "}
            <Link href="/mapa" className="font-semibold text-primary underline-offset-2 hover:underline">
              Mapa
            </Link>
            .
          </p>
        )}
      </AulasTabs>
      {!tree.length ? (
        <div className="card-soft p-10 text-center">
          <p className="text-sm text-muted-foreground">Sua árvore está vazia.</p>
          <button onClick={() => start(() => resetTreeIfEmpty())} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
            Carregar árvore do ENEM
          </button>
        </div>
      ) : (
        <>
          <div className="grid items-start gap-4 md:grid-cols-2">
            {tree.map((area) => (
              <section key={area.id} className="card-soft overflow-hidden">
                <header
                  className={cn("flex items-center bg-gradient-to-r px-4 py-3 text-white", AREA_STYLE[area.name] ?? "from-primary to-blue-400")}
                >
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

function Badges({ node }: { node: TreeNode }) {
  if (node.level !== "topic" && node.level !== "skill") return null;
  const rank = relevanceRank(node.relevance);
  return (
    <>
      {node.phase && node.level === "topic" && (
        <span className="whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">{node.phase}</span>
      )}
      {node.relevance && (
        <span
          title={node.relevance}
          className={cn(
            "whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold",
            rank === 0 && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
            rank === 1 && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
            rank === 2 && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
            rank >= 3 && "bg-muted text-muted-foreground",
          )}
        >
          {node.level === "topic" ? node.relevance.split(" · ")[0] : node.relevance}
        </span>
      )}
    </>
  );
}

function NodeRow({
  node,
  subject,
  minutes,
  depth,
  parentPhase,
}: {
  node: TreeNode;
  subject: string;
  minutes: Record<string, number>;
  depth: number;
  parentPhase?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const min =
    node.level === "topic"
      ? (minutes[`${subject}/${node.name}`] ?? 0)
      : node.children.reduce((a, t) => a + (minutes[`${node.name}/${t.name}`] ?? 0), 0);
  const canOpen = node.level !== "skill";
  const hasMeta = node.level === "topic" || node.level === "skill";
  return (
    <li>
      {editing ? (
        <NodeEditor node={node} depth={depth} onClose={() => setEditing(false)} />
      ) : (
        <div className="group flex items-center gap-2 px-3 py-2" style={{ paddingLeft: 12 + depth * 18 }}>
          <button
            aria-label={open ? "Fechar" : "Abrir"}
            onClick={() => setOpen(!open)}
            className={cn("grid size-6 shrink-0 place-items-center rounded text-muted-foreground", !canOpen && "invisible")}
          >
            <ChevronRight className={cn("size-4 transition", open && "rotate-90")} />
          </button>
          <button
            onClick={() => canOpen && setOpen(!open)}
            className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-1 text-left text-sm", node.level === "subject" && "font-semibold")}
          >
            <span className="mr-0.5">
              {node.name}
              {node.level !== "skill" && node.children.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">({node.children.length})</span>
              )}
            </span>
            {hasMeta && <Badges node={node} />}
            {node.level === "skill" && node.phase && parentPhase && node.phase !== parentPhase && (
              <span className="whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">{node.phase}</span>
            )}
          </button>
          {min > 0 && <span className="text-xs tabular-nums text-muted-foreground">{(min / 60).toFixed(1).replace(".", ",")}h</span>}
          <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100">
            <button aria-label="Editar" onClick={() => setEditing(true)} className="grid size-7 place-items-center rounded hover:bg-muted">
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
              <Link
                aria-label="Estudar"
                href={`/foco?topic=${encodeURIComponent(node.name)}`}
                className="grid size-7 place-items-center rounded-full bg-primary text-white"
              >
                <Play className="size-3.5 fill-current" />
              </Link>
            )}
          </div>
        </div>
      )}
      {open && canOpen && (
        <ul className="bg-muted/40">
          {node.children.map((c) => (
            <NodeRow
              key={c.id}
              node={c}
              subject={node.level === "subject" ? node.name : subject}
              minutes={minutes}
              depth={depth + 1}
              parentPhase={node.phase}
            />
          ))}
          <AddRow parentId={node.id} label={NEXT_LABEL[node.level]} depth={depth + 1} />
        </ul>
      )}
    </li>
  );
}

/** Edição inline: nome, e (para tópicos e habilidades) fase e relevância. */
function NodeEditor({ node, depth, onClose }: { node: TreeNode; depth: number; onClose: () => void }) {
  const [name, setName] = useState(node.name);
  const [phase, setPhase] = useState(node.phase ?? "");
  const [relevance, setRelevance] = useState(node.relevance ?? "");
  const [pending, start] = useTransition();
  const hasMeta = node.level === "topic" || node.level === "skill";
  const relOptions = relevance && !RELEVANCES.includes(relevance) ? [relevance, ...RELEVANCES] : RELEVANCES;
  const save = () =>
    start(async () => {
      if (name.trim() && name.trim() !== node.name) await renameNode(node.id, name);
      if (hasMeta && (phase !== (node.phase ?? "") || relevance !== (node.relevance ?? "")))
        await setNodeMeta(node.id, {
          phase: phase || null,
          relevance: relevance || null,
        });
      onClose();
    });
  const field = "h-8 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-2 bg-accent/50 px-3 py-2.5"
      style={{ paddingLeft: 12 + depth * 18 + 32 }}
    >
      <input autoFocus aria-label="Nome" value={name} onChange={(e) => setName(e.target.value)} className={field} />
      {hasMeta && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            Fase
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className={cn(field, "mt-0.5 text-foreground")}>
              <option value="">Sem fase</option>
              {PHASES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Relevância
            <select value={relevance} onChange={(e) => setRelevance(e.target.value)} className={cn(field, "mt-0.5 text-foreground")}>
              <option value="">Sem etiqueta</option>
              {relOptions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" /> Cancelar
        </button>
        <button
          disabled={pending}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Check className="size-3.5" /> Salvar
        </button>
      </div>
    </form>
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
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={`${label === "tópico" ? "Novo" : "Nova"} ${label}…`}
        className="flex-1 bg-transparent text-sm outline-none"
      />
    </form>
  );
}
