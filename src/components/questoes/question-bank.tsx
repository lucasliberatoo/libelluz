"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Eye, Globe, ImageIcon, Lock, Pencil, Plus, Shuffle, Trash2, Users, X } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { Chip, field, Modal, Select } from "@/components/ui/kit";
import { AREA_DOT, AREAS, type AreaOption } from "@/lib/area-tree";
import { cn } from "@/lib/utils";
import type { QuestionListItem, QuestionStats } from "@/server/questoes";
import {
  answerQuestion,
  deleteQuestion,
  drawReview,
  getQuestionFull,
  saveQuestion,
  type FullQuestion,
  type QuestionInput,
  type ReviewQuestion,
} from "@/server/questoes-actions";

const LETTERS = ["A", "B", "C", "D", "E"];
const SCOPES = [
  { k: "all", label: "Todas" },
  { k: "mine", label: "Minhas" },
  { k: "group", label: "Do grupo" },
  { k: "global", label: "Globais" },
] as const;
type Scope = (typeof SCOPES)[number]["k"];

const VIS = {
  private: { label: "Privada", icon: Lock, cls: "bg-muted text-muted-foreground" },
  group: { label: "Grupo", icon: Users, cls: "bg-primary/10 text-primary" },
  global: { label: "Global", icon: Globe, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
} as const;

const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0);

/** Seletor Questões | Simulados (o mesmo vai em /simulados). */
export function QuestoesTabs({ active }: { active: "questoes" | "simulados" }) {
  return (
    <nav className="flex gap-1 rounded-full bg-card p-1 shadow-sm ring-1 ring-border" aria-label="Questões e Simulados">
      {(
        [
          ["questoes", "/questoes", "Questões"],
          ["simulados", "/simulados", "Simulados"],
        ] as const
      ).map(([k, href, label]) => (
        <Link
          key={k}
          href={href}
          aria-current={active === k ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            active === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function QuestionBank({
  items,
  stats,
  tree,
  admin,
}: {
  items: QuestionListItem[];
  stats: QuestionStats;
  tree: AreaOption[];
  admin: boolean;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [area, setArea] = useState("");
  const [subject, setSubject] = useState("");
  const [editing, setEditing] = useState<FullQuestion | "new" | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const areas = useMemo(() => [...new Set([...AREAS, ...tree.map((t) => t.area), ...items.map((i) => i.area)])], [tree, items]);
  const subjects = useMemo(() => {
    const fromTree = tree.find((t) => t.area === area)?.subjects.map((s) => s.name) ?? [];
    const fromItems = items.filter((i) => i.area === area && i.subject).map((i) => i.subject!);
    return [...new Set([...fromTree, ...fromItems])];
  }, [tree, items, area]);

  const shown = items.filter(
    (i) =>
      (scope === "all" ||
        (scope === "mine" && i.mine) ||
        (scope === "group" && i.visibility === "group") ||
        (scope === "global" && i.visibility === "global")) &&
      (!area || i.area === area) &&
      (!subject || i.subject === subject),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <QuestoesTabs active="questoes" />
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setReviewing(true)}
            disabled={!shown.length}
            className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 text-sm font-bold text-primary transition hover:bg-accent disabled:opacity-40"
          >
            <Shuffle className="size-4" /> Revisar
          </button>
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
          >
            <Plus className="size-4" /> Nova questão
          </button>
        </div>
      </div>

      <StatsCard stats={stats} />

      <section className="card-soft space-y-3 p-3 md:p-4">
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:px-0">
          {SCOPES.map((s) => (
            <Chip key={s.k} active={scope === s.k} onClick={() => setScope(s.k)}>
              {s.label}
              <span className="ml-1 opacity-70">
                {
                  items.filter((i) =>
                    s.k === "all" ? true : s.k === "mine" ? i.mine : i.visibility === s.k,
                  ).length
                }
              </span>
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={area}
            onChange={(v) => {
              setArea(v);
              setSubject("");
            }}
            label="Área"
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Select value={subject} onChange={setSubject} label="Disciplina" disabled={!area}>
            <option value="">Todas as disciplinas</option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
      </section>

      {shown.length ? (
        <ul className="space-y-3">
          {shown.map((q) => (
            <QuestionCard key={q.id} q={q} onEdit={setEditing} />
          ))}
        </ul>
      ) : (
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center">
          <Icon3D name="emoji/alvo.webp" size={56} />
          <p className="font-semibold">{items.length ? "Nenhuma questão com esses filtros." : "Seu banco ainda está vazio."}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Cadastre as questões que você errou ou achou boas (+2 XP cada) e revise depois. Compartilhar com o grupo vale +3 XP.
          </p>
        </div>
      )}

      {editing && (
        <QuestionEditor
          initial={editing === "new" ? null : editing}
          tree={tree}
          areas={areas}
          admin={admin}
          defaultArea={area}
          onClose={() => setEditing(null)}
        />
      )}
      {reviewing && <ReviewDialog scope={scope} area={area} subject={subject} onClose={() => setReviewing(false)} />}
    </div>
  );
}

function StatsCard({ stats }: { stats: QuestionStats }) {
  return (
    <section className="card-soft grid gap-3 p-3 md:grid-cols-[auto_1fr] md:p-4">
      <div className="grid grid-cols-3 gap-2 md:w-[360px]">
        <Stat icon="emoji/livro.webp" value={stats.mine} label="cadastradas" />
        <Stat icon="emoji/check.webp" value={stats.attempts} label="respondidas" />
        <Stat icon="emoji/alvo.webp" value={stats.attempts ? `${pct(stats.correct, stats.attempts)}%` : "—"} label="de acerto" />
      </div>
      <div className="card-inner p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Acerto por área (revisões)</p>
        {stats.byArea.length ? (
          <ul className="space-y-1.5">
            {stats.byArea.map((a) => (
              <li key={a.area} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 truncate font-medium">{a.area}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-card">
                  <span className={cn("block h-full rounded-full", AREA_DOT[a.area] ?? "bg-primary")} style={{ width: `${pct(a.correct, a.total)}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                  {pct(a.correct, a.total)}% · {a.correct}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Use o modo Revisar para ver seu acerto por área.</p>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: string; value: React.ReactNode; label: string }) {
  return (
    <div className="card-inner flex flex-col items-center gap-0.5 p-2.5 text-center">
      <Icon3D name={icon} size={26} />
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function QuestionCard({ q, onEdit }: { q: QuestionListItem; onEdit: (f: FullQuestion) => void }) {
  const [full, setFull] = useState<FullQuestion | null>(null);
  const [open, setOpen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [pending, start] = useTransition();
  const V = VIS[q.visibility];
  const load = (then: (f: FullQuestion) => void) =>
    full
      ? then(full)
      : start(async () => {
          const f = await getQuestionFull(q.id);
          if (f) {
            setFull(f);
            then(f);
          }
        });
  return (
    <li className="card-soft p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={cn("size-2.5 rounded-full", AREA_DOT[q.area] ?? "bg-primary")} />
        <span className="font-semibold">{q.area}</span>
        {q.subject && <span className="text-muted-foreground">· {q.subject}</span>}
        {q.topic && <span className="truncate text-muted-foreground">· {q.topic}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {q.last && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                q.last === "right" ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-destructive/15 text-destructive",
              )}
            >
              {q.last === "right" ? "Acertou" : "Errou"}
            </span>
          )}
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", V.cls)}>
            <V.icon className="size-3" /> {V.label}
          </span>
        </span>
      </div>
      <p className={cn("whitespace-pre-line text-sm", !open && "line-clamp-3")}>{q.statement || <i className="text-muted-foreground">(enunciado em imagem)</i>}</p>
      {open && full && (
        <div className="mt-3 space-y-3">
          <Images images={full.images} />
          <ol className="space-y-1.5">
            {full.alternatives.map((a, i) => (
              <li
                key={i}
                className={cn(
                  "flex gap-2 rounded-xl border px-3 py-2 text-sm",
                  showAnswer && i === full.answer && "border-green-500 bg-green-500/10",
                )}
              >
                <b className="text-primary">{LETTERS[i]}</b>
                <span className="whitespace-pre-line">{a}</span>
              </li>
            ))}
          </ol>
          {showAnswer ? (
            full.explanation && (
              <div className="card-inner whitespace-pre-line p-3 text-sm">
                <b>Explicação: </b>
                {full.explanation}
              </div>
            )
          ) : (
            <button onClick={() => setShowAnswer(true)} className="text-sm font-semibold text-primary">
              Mostrar gabarito
            </button>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {q.imageCount > 0 && (
          <span className="flex items-center gap-1">
            <ImageIcon className="size-3.5" /> {q.imageCount}
          </span>
        )}
        <span>{q.alternatives.length} alternativas</span>
        {q.source && <span className="truncate">· {q.source}</span>}
        {!q.mine && <span>· por {q.author}</span>}
        <span className="ml-auto flex gap-1">
          <IconBtn
            label={open ? "Recolher" : "Ver questão"}
            onClick={() => (open ? setOpen(false) : load(() => setOpen(true)))}
            disabled={pending}
          >
            {open ? <ChevronDown className="size-4 rotate-180" /> : <Eye className="size-4" />}
          </IconBtn>
          {q.mine && (
            <>
              <IconBtn label="Editar" onClick={() => load(onEdit)} disabled={pending}>
                <Pencil className="size-4" />
              </IconBtn>
              <IconBtn
                label="Apagar"
                danger
                disabled={pending}
                onClick={() => {
                  if (confirm("Apagar esta questão? As respostas dela também somem.")) start(() => deleteQuestion(q.id));
                }}
              >
                <Trash2 className="size-4" />
              </IconBtn>
            </>
          )}
        </span>
      </div>
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-full transition disabled:opacity-50",
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

function Images({ images }: { images: string[] }) {
  if (!images.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={`Imagem ${i + 1} da questão`} className="max-h-96 w-full rounded-xl border bg-white object-contain" />
      ))}
    </div>
  );
}

/** Reduz a imagem no navegador (JPEG ~1024px), como a foto do diário. */
async function compressImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.78);
}


function QuestionEditor({
  initial,
  tree,
  areas,
  admin,
  defaultArea,
  onClose,
}: {
  initial: FullQuestion | null;
  tree: AreaOption[];
  areas: string[];
  admin: boolean;
  defaultArea: string;
  onClose: () => void;
}) {
  const [area, setArea] = useState(initial?.area ?? (defaultArea || tree[0]?.area || AREAS[0]));
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [nodeId, setNodeId] = useState(initial?.nodeId ?? "");
  const [statement, setStatement] = useState(initial?.statement ?? "");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [alts, setAlts] = useState<string[]>(() => LETTERS.map((_, i) => initial?.alternatives[i] ?? ""));
  const [answer, setAnswer] = useState<number>(initial?.answer ?? 0);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [visibility, setVisibility] = useState<"private" | "group" | "global">(initial?.visibility ?? "private");
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const subjects = tree.find((t) => t.area === area)?.subjects ?? [];
  const topics = subjects.find((s) => s.name === subject)?.topics ?? [];
  const topicName = topics.find((t) => t.id === nodeId)?.name ?? (nodeId ? initial?.topic : null) ?? null;

  const save = () =>
    start(async () => {
      setError("");
      const input: QuestionInput = {
        id: initial?.id,
        area,
        subject: subject || null,
        topic: topicName,
        nodeId: nodeId || null,
        statement,
        images,
        alternatives: alts,
        answer,
        explanation,
        source,
        visibility,
      };
      const r = await saveQuestion(input);
      if (r.error) return setError(r.error);
      if (r.xp) {
        setDone(r.xp);
        setTimeout(onClose, 900);
      } else onClose();
    });

  return (
    <Modal title={initial ? "Editar questão" : "Nova questão"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            label="Área"
            value={area}
            className="md:max-w-none"
            onChange={(v) => {
              setArea(v);
              setSubject("");
              setNodeId("");
            }}
          >
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Select
            label="Disciplina"
            value={subject}
            className="md:max-w-none"
            onChange={(v) => {
              setSubject(v);
              setNodeId("");
            }}
          >
            <option value="">Disciplina…</option>
            {initial?.subject && !subjects.some((s) => s.name === initial.subject) && <option>{initial.subject}</option>}
            {subjects.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select label="Tópico" value={nodeId} onChange={setNodeId} disabled={!topics.length} className="md:max-w-none">
            <option value="">Tópico…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        <textarea
          aria-label="Enunciado"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={5}
          maxLength={10000}
          placeholder="Enunciado da questão…"
          className={field}
        />

        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Imagem ${i + 1}`} className="size-20 rounded-xl border object-cover" />
              <button
                aria-label="Remover imagem"
                onClick={() => setImages(images.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-0.5 text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {images.length < 3 && (
            <label className="grid size-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed text-center text-[11px] text-muted-foreground hover:border-primary hover:text-primary">
              <span>
                <ImageIcon className="mx-auto mb-0.5 size-5" />
                Imagem
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = [...(e.target.files ?? [])].slice(0, 3 - images.length);
                  e.target.value = "";
                  const out = await Promise.all(files.map(compressImage));
                  setImages((cur) => [...cur, ...out].slice(0, 3));
                }}
              />
            </label>
          )}
          <p className="self-end text-[11px] text-muted-foreground">até 3 imagens</p>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Alternativas — toque na letra para marcar o gabarito</legend>
          {alts.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <button
                type="button"
                aria-label={`Gabarito ${LETTERS[i]}`}
                aria-pressed={answer === i}
                onClick={() => setAnswer(i)}
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition",
                  answer === i ? "border-green-500 bg-green-500 text-white" : "border-primary/40 text-primary hover:border-primary",
                )}
              >
                {answer === i ? <Check className="size-4" /> : LETTERS[i]}
              </button>
              <textarea
                aria-label={`Alternativa ${LETTERS[i]}`}
                value={a}
                rows={1}
                onChange={(e) => setAlts(alts.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={i < 2 ? `Alternativa ${LETTERS[i]}` : `Alternativa ${LETTERS[i]} (opcional)`}
                className={cn(field, "min-h-9 resize-y py-1.5")}
              />
            </div>
          ))}
        </fieldset>

        <textarea
          aria-label="Explicação"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Explicação / resolução (aparece depois de responder)"
          className={field}
        />
        <input aria-label="Fonte" value={source} onChange={(e) => setSource(e.target.value)} maxLength={200} placeholder="Fonte (ex.: ENEM 2022, livro X, cap. 3)" className={field} />

        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Quem vê</p>
          <div className="flex flex-wrap gap-2">
            {(["private", "group", ...(admin ? (["global"] as const) : [])] as const).map((v) => {
              const V = VIS[v];
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-semibold",
                    visibility === v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  <V.icon className="size-3.5" />
                  {v === "private" ? "Só eu" : v === "group" ? "Compartilhar com o grupo (+3 XP)" : "Global (admin)"}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <button onClick={save} disabled={pending || done !== null} className="w-full rounded-full bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-60">
          {done !== null ? `Salva! +${done} XP` : pending ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar questão (+2 XP)"}
        </button>
      </div>
    </Modal>
  );
}

type Result = { choice: number; correct: boolean; answer: number; explanation: string | null; xp: number };

function ReviewDialog({ scope, area, subject, onClose }: { scope: Scope; area: string; subject: string; onClose: () => void }) {
  const [q, setQ] = useState<ReviewQuestion | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [res, setRes] = useState<Result | null>(null);
  const [score, setScore] = useState({ right: 0, done: 0, xp: 0 });
  const [pending, start] = useTransition();

  const next = (exclude: string[]) =>
    start(async () => {
      const r = await drawReview({ scope, area: area || undefined, subject: subject || undefined, exclude });
      setTotal(r.total);
      setQ(r.question);
      setRes(null);
    });
  useEffect(() => {
    next([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (i: number) =>
    q &&
    !res &&
    start(async () => {
      const r = await answerQuestion(q.id, i);
      if (!r) return;
      setRes({ choice: i, ...r });
      setSeen((s) => [...s, q.id]);
      setScore((s) => ({ right: s.right + (r.correct ? 1 : 0), done: s.done + 1, xp: s.xp + r.xp }));
    });

  return (
    <Modal title="Revisar questões" onClose={onClose}>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {score.done} respondidas · {score.right} certas{score.xp ? ` · +${score.xp} XP` : ""}
        </span>
        {total !== null && <span className="ml-auto">{total} no sorteio · erradas e novas saem mais</span>}
      </div>
      {!q ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{pending ? "Sorteando…" : "Nenhuma questão com gabarito para revisar nesses filtros."}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("size-2.5 rounded-full", AREA_DOT[q.area] ?? "bg-primary")} />
            <b>{q.area}</b>
            {q.subject && <span className="text-muted-foreground">· {q.subject}</span>}
            {q.topic && <span className="text-muted-foreground">· {q.topic}</span>}
            {!q.last && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Nova</span>}
            {q.last === "wrong" && <span className="ml-auto rounded-full bg-destructive/15 px-2 py-0.5 font-semibold text-destructive">Errou da última vez</span>}
          </div>
          {q.statement && <p className="whitespace-pre-line text-sm">{q.statement}</p>}
          <Images images={q.images} />
          <ol className="space-y-2">
            {q.alternatives.map((a, i) => {
              const isAnswer = res && i === res.answer;
              const isWrongPick = res && i === res.choice && !res.correct;
              return (
                <li key={i}>
                  <button
                    onClick={() => choose(i)}
                    disabled={!!res || pending}
                    className={cn(
                      "flex w-full gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition",
                      !res && "hover:border-primary hover:bg-accent",
                      isAnswer && "border-green-500 bg-green-500/10",
                      isWrongPick && "border-destructive bg-destructive/10",
                      res && !isAnswer && !isWrongPick && "opacity-60",
                    )}
                  >
                    <b className="text-primary">{LETTERS[i]}</b>
                    <span className="whitespace-pre-line">{a}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {res && (
            <div className={cn("rounded-2xl p-3 text-sm", res.correct ? "bg-green-500/10" : "bg-destructive/10")}>
              <p className="flex items-center gap-2 font-bold">
                <Icon3D name={res.correct ? "emoji/estrela.webp" : "emoji/revisao.webp"} size={22} />
                {res.correct ? "Acertou!" : `Errou — a resposta é ${LETTERS[res.answer]}.`}
                {res.xp > 0 && <span className="ml-auto text-amber-600 dark:text-amber-400">+{res.xp} XP</span>}
              </p>
              {res.explanation && <p className="mt-2 whitespace-pre-line">{res.explanation}</p>}
              {q.source && <p className="mt-2 text-xs text-muted-foreground">Fonte: {q.source}</p>}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-full border-2 py-2 text-sm font-semibold">
              Encerrar
            </button>
            <button
              onClick={() => next(res ? seen : [...seen, q.id])}
              disabled={pending}
              className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {res ? "Próxima" : "Pular"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
