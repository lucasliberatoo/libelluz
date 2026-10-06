"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BookOpen, ExternalLink, FileText, Film, Headphones, ImageIcon, Link2, Paperclip, Plus, Trash2, Upload, CloudOff } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { Chip, field, Modal, Select } from "@/components/ui/kit";
import { AREA_DOT, AREAS, type AreaOption } from "@/lib/area-tree";
import { formatBytes, KIND_LABEL, kindFromMime, kindFromUrl, MATERIAL_KINDS, youtubeId, youtubeThumb, type MaterialKind } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { MaterialItem } from "@/server/materiais";
import { addMaterialLink, deleteMaterial, finishUpload, startUpload, type MaterialMeta } from "@/server/materiais-actions";

type Storage = { enabled: boolean; used: number; quota: number; maxFile: number };
type Section = "material" | "aula";

const KIND_ICON: Record<MaterialKind, typeof FileText> = {
  pdf: FileText,
  book: BookOpen,
  video: Film,
  audio: Headphones,
  image: ImageIcon,
  link: Link2,
  other: Paperclip,
};
const KIND_TILE: Record<MaterialKind, string> = {
  pdf: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  book: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  video: "bg-primary/15 text-primary",
  audio: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  image: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  link: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  other: "bg-muted text-muted-foreground",
};

/** Sub-abas de Aulas (a página /aulas é de outra parte; aqui só links). */
function AulasTabs() {
  return (
    <nav className="flex gap-1 rounded-full bg-card p-1 shadow-sm ring-1 ring-border" aria-label="Aulas">
      <Link href="/aulas" className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-primary">
        Estrutura
      </Link>
      <span aria-current="page" className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
        Materiais
      </span>
    </nav>
  );
}

export function Materials({ items, tree, storage, missingVars }: { items: MaterialItem[]; tree: AreaOption[]; storage: Storage; missingVars: string[] }) {
  const [section, setSection] = useState<Section>("material");
  const [area, setArea] = useState("");
  const [subject, setSubject] = useState("");
  const [adding, setAdding] = useState(false);

  const areas = useMemo(() => [...new Set([...AREAS, ...tree.map((t) => t.area)])], [tree]);
  const subjects = useMemo(() => {
    const t = tree.find((x) => x.area === area)?.subjects.map((s) => s.name) ?? [];
    return [...new Set([...t, ...items.filter((i) => i.area === area && i.subject).map((i) => i.subject!)])];
  }, [tree, items, area]);
  const inSection = items.filter((i) => i.section === section);
  const shown = inSection.filter((i) => (!area || i.area === area) && (!subject || i.subject === subject));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Aulas</h1>
        <AulasTabs />
        <button
          onClick={() => setAdding(true)}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground transition hover:brightness-110"
        >
          <Plus className="size-4" /> Adicionar
        </button>
      </div>

      <StorageCard storage={storage} missingVars={missingVars} />

      <section className="card-soft space-y-3 p-3 md:p-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["material", "Materiais"],
              ["aula", "Aulas gravadas"],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} active={section === k} onClick={() => setSection(k)}>
              {label} <span className="ml-1 opacity-70">{items.filter((i) => i.section === k).length}</span>
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            label="Área"
            value={area}
            onChange={(v) => {
              setArea(v);
              setSubject("");
            }}
          >
            <option value="">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Select label="Disciplina" value={subject} onChange={setSubject} disabled={!area}>
            <option value="">Todas as disciplinas</option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
      </section>

      {shown.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <MaterialCard key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center">
          <Icon3D name="livros.png" size={56} />
          <p className="font-semibold">{inSection.length ? "Nada com esses filtros." : section === "aula" ? "Nenhuma aula ainda." : "Nenhum material ainda."}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {section === "aula"
              ? "Guarde aqui o link (ou o vídeo) de cada aula, ligado ao tópico da sua árvore."
              : "PDFs, livros, apostilas, áudios e links — com etiqueta de matéria para achar rápido."}
          </p>
          <button onClick={() => setAdding(true)} className="mt-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Adicionar {section === "aula" ? "aula" : "material"}
          </button>
        </div>
      )}

      {adding && <AddDialog tree={tree} areas={areas} storage={storage} defaults={{ section, area }} onClose={() => setAdding(false)} onSaved={setSection} />}
    </div>
  );
}

function StorageCard({ storage, missingVars }: { storage: Storage; missingVars: string[] }) {
  if (!storage.enabled)
    return (
      <div className="card-soft flex items-start gap-3 p-3 text-sm">
        <CloudOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">Upload de arquivos ainda não configurado — use links.</p>
          {missingVars.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Admin: faltam as variáveis <code className="font-mono">{missingVars.join(", ")}</code> (veja docs/r2.md).
            </p>
          )}
        </div>
      </div>
    );
  const p = Math.min(100, (storage.used / storage.quota) * 100);
  return (
    <div className="card-soft flex items-center gap-3 p-3 text-sm">
      <Upload className="size-5 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <span className="font-medium">Seu espaço de arquivos</span>
          <span className="tabular-nums text-muted-foreground">
            {formatBytes(storage.used)} de {formatBytes(storage.quota)}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", p > 90 ? "bg-destructive" : "bg-primary")} style={{ width: `${p}%` }} />
        </div>
      </div>
    </div>
  );
}

function MaterialCard({ m }: { m: MaterialItem }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const yt = youtubeId(m.url);
  const Icon = KIND_ICON[m.kind];
  const href = m.isFile ? `/api/materiais/${m.id}` : (m.url ?? "#");
  return (
    <li className={cn("card-soft flex flex-col overflow-hidden", pending && "opacity-50")}>
      <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
        {yt ? (
          <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-950">
            <Thumb id={yt} className="size-full object-cover transition group-hover:opacity-90" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-11 place-items-center rounded-full bg-black/60 text-white">
                <Film className="size-5" />
              </span>
            </span>
          </div>
        ) : (
          <div className={cn("grid h-24 place-items-center", KIND_TILE[m.kind])}>
            <Icon className="size-9" />
          </div>
        )}
      </a>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <a href={href} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-semibold leading-snug hover:text-primary">
          {m.title}
        </a>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", KIND_TILE[m.kind])}>{KIND_LABEL[m.kind]}</span>
          {m.area && (
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <span className={cn("size-2 rounded-full", AREA_DOT[m.area] ?? "bg-primary")} />
              {m.subject ?? m.area}
            </span>
          )}
          {m.topic && <span className="truncate text-muted-foreground">· {m.topic}</span>}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span>{m.isFile ? `Arquivo · ${formatBytes(m.size ?? 0)}` : linkHost(m.url)}</span>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Abrir" className="ml-auto grid size-8 place-items-center rounded-full hover:bg-accent hover:text-primary">
            <ExternalLink className="size-4" />
          </a>
          <button
            aria-label="Apagar"
            disabled={pending}
            onClick={() => {
              if (confirm(`Apagar "${m.title}"?${m.isFile ? " O arquivo também será apagado." : ""}`))
                start(async () => {
                  const r = await deleteMaterial(m.id);
                  if (r.error) setError(r.error);
                });
            }}
            className="grid size-8 place-items-center rounded-full hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

/** Miniatura do YouTube; some se não carregar (sem internet, vídeo removido). */
function Thumb({ id, alt = "", className }: { id: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={youtubeThumb(id)} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}

function linkHost(url: string | null) {
  try {
    return new URL(url!).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

/** PUT direto do navegador para o R2, com progresso. */
function putFile(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha no envio (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Falha de rede no envio (confira o CORS do bucket)"));
    xhr.send(file);
  });
}

function AddDialog({
  tree,
  areas,
  storage,
  defaults,
  onClose,
  onSaved,
}: {
  tree: AreaOption[];
  areas: string[];
  storage: Storage;
  defaults: { section: Section; area: string };
  onClose: () => void;
  onSaved: (s: Section) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MaterialKind>("link");
  const [kindTouched, setKindTouched] = useState(false);
  const [section, setSection] = useState<Section>(defaults.section);
  const [area, setArea] = useState(defaults.area);
  const [subject, setSubject] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const subjects = tree.find((t) => t.area === area)?.subjects ?? [];
  const topics = subjects.find((s) => s.name === subject)?.topics ?? [];
  const yt = mode === "link" ? youtubeId(url) : null;

  const submit = () =>
    start(async () => {
      setError("");
      const meta: MaterialMeta = { title, kind, section, area: area || null, subject: subject || null, nodeId: nodeId || null };
      if (mode === "link") {
        const r = await addMaterialLink({ ...meta, url });
        if (r.error) return setError(r.error);
        onSaved(section);
        return onClose();
      }
      if (!file) return setError("Escolha um arquivo");
      if (file.size > storage.maxFile) return setError(`Arquivo grande demais (máx. ${formatBytes(storage.maxFile)}). Use um link.`);
      if (storage.used + file.size > storage.quota) return setError("Sem espaço livre para esse arquivo.");
      const s = await startUpload({ name: file.name, size: file.size, mime: file.type });
      if (s.error || !s.url || !s.key) return setError(s.error ?? "Erro ao preparar o envio");
      try {
        setProgress(0);
        await putFile(s.url, file, setProgress);
      } catch (e) {
        setProgress(null);
        return setError((e as Error).message);
      }
      const r = await finishUpload({ ...meta, key: s.key, mime: file.type });
      setProgress(null);
      if (r.error) return setError(r.error);
      router.refresh();
      onSaved(section);
      onClose();
    });

  return (
    <Modal title={section === "aula" ? "Adicionar aula" : "Adicionar material"} onClose={pending ? () => {} : onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          <button
            onClick={() => setMode("link")}
            className={cn("flex items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold", mode === "link" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
          >
            <Link2 className="size-4" /> Link
          </button>
          <button
            onClick={() => storage.enabled && setMode("file")}
            disabled={!storage.enabled}
            title={storage.enabled ? undefined : "Upload de arquivos ainda não configurado — use links"}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
              mode === "file" ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            <Upload className="size-4" /> Arquivo
          </button>
        </div>
        {!storage.enabled && <p className="text-xs text-muted-foreground">Upload de arquivos ainda não configurado — use links.</p>}

        {mode === "link" ? (
          <>
            <input
              aria-label="Link"
              value={url}
              inputMode="url"
              autoFocus
              onChange={(e) => {
                setUrl(e.target.value);
                if (!kindTouched) setKind(kindFromUrl(e.target.value));
              }}
              placeholder="Cole o link (YouTube, Google Drive, site…)"
              className={field}
            />
            {yt && <Thumb key={yt} id={yt} alt="Miniatura do vídeo" className="aspect-video w-full max-w-xs rounded-xl bg-muted object-cover" />}
          </>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-6 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
            <Upload className="size-5" />
            {file ? (
              <span className="font-medium text-foreground">
                {file.name} · {formatBytes(file.size)}
              </span>
            ) : (
              <span>Escolher PDF, vídeo, áudio… (até {formatBytes(storage.maxFile)})</span>
            )}
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) {
                  if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
                  if (!kindTouched) setKind(kindFromMime(f.type, f.name));
                }
              }}
            />
          </label>
        )}

        <input aria-label="Título" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Título" className={field} />

        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            label="Tipo"
            value={kind}
            className="md:max-w-none"
            onChange={(v) => {
              setKind(v as MaterialKind);
              setKindTouched(true);
            }}
          >
            {MATERIAL_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
          <Select label="Seção" value={section} onChange={(v) => setSection(v as Section)} className="md:max-w-none">
            <option value="material">Material (PDF, livro, apostila…)</option>
            <option value="aula">Aula (vídeo/link de um tópico)</option>
          </Select>
        </div>
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
            <option value="">Área…</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Select
            label="Disciplina"
            value={subject}
            disabled={!subjects.length}
            className="md:max-w-none"
            onChange={(v) => {
              setSubject(v);
              setNodeId("");
            }}
          >
            <option value="">Disciplina…</option>
            {subjects.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select label="Tópico" value={nodeId} onChange={setNodeId} disabled={!topics.length} className="md:max-w-none">
            <option value="">{section === "aula" ? "Tópico da aula…" : "Tópico (opcional)"}</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        {progress !== null && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Enviando… {Math.round(progress * 100)}%</p>
          </div>
        )}
        {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <button
          onClick={submit}
          disabled={pending || !title.trim() || (mode === "link" ? !url.trim() : !file)}
          className="w-full rounded-full bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-60"
        >
          {pending ? (mode === "file" ? "Enviando…" : "Salvando…") : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
