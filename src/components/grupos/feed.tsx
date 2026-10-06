"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Camera, ChevronRight, Loader2, MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import { Icon3D } from "@/components/brand";
import { field, Modal } from "@/components/ui/kit";
import { cn } from "@/lib/utils";
import type { FeedItem, FeedPage } from "@/server/groups";
import { addComment, createPost, deleteComment, deletePost, getComments, loadFeed, toggleReaction, type FeedComment } from "@/server/groups-actions";
import { ago, Avatar, Empty, fmtDuration, joinNames, StreakLevel, useGroup, useMember } from "./parts";

export function Feed({ initial }: { initial: FeedPage }) {
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [loading, start] = useTransition();
  const [composing, setComposing] = useState(false);

  const more = () =>
    start(async () => {
      const p = await loadFeed(next);
      setItems((cur) => [...cur, ...p.items.filter((i) => !cur.some((c) => c.kind === i.kind && c.id === i.id))]);
      setNext(p.next);
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/questoes"
          className="card-soft flex flex-1 items-center gap-3 px-4 py-3 text-sm font-semibold transition hover:ring-2 hover:ring-primary/40"
        >
          <BookOpenCheck className="size-5 text-primary" />
          <span className="flex-1">Questões do grupo</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:brightness-110"
        >
          <Plus className="size-4" /> Publicar
        </button>
      </div>

      {items.length ? (
        items.map((it) => <FeedCard key={`${it.kind}/${it.id}`} item={it} onDeleted={() => setItems((c) => c.filter((x) => x !== it))} />)
      ) : (
        <section className="card-soft">
          <Empty icon="emoji/grupo.webp">
            Nada no feed ainda. Termine uma sessão de foco ou publique algo para o grupo!
          </Empty>
        </section>
      )}

      {next && (
        <button
          onClick={more}
          disabled={loading}
          className="mx-auto flex items-center gap-2 rounded-full border-2 border-primary/60 bg-card px-5 py-2 text-sm font-semibold text-primary hover:bg-accent disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />} Carregar mais
        </button>
      )}

      {composing && <Composer onClose={() => setComposing(false)} />}
    </div>
  );
}

function FeedCard({ item, onDeleted }: { item: FeedItem; onDeleted: () => void }) {
  const { meId, now } = useGroup();
  const m = useMember(item.userId);
  const mine = item.userId === meId;
  const [, start] = useTransition();
  const name = mine ? "Você" : (m?.firstName ?? "Alguém");

  return (
    <article className="card-soft p-4" data-feed-kind={item.kind}>
      <header className="flex items-start gap-3">
        <Avatar id={item.userId} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-bold">{m?.name ?? "Alguém"}</span>
            <StreakLevel id={item.userId} />
          </div>
          <p className="text-xs text-muted-foreground">{ago(item.at, now)}</p>
        </div>
        {mine && item.kind === "post" && (
          <button
            aria-label="Apagar post"
            onClick={() => confirm("Apagar este post?") && start(async () => (await deletePost(item.id), onDeleted()))}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </header>

      <div className="mt-3">
        {item.session && <SessionBody name={name} s={item.session} />}
        {item.post && (
          <div className="space-y-3">
            {item.post.text && <p className="whitespace-pre-wrap break-words text-[15px]">{item.post.text}</p>}
            {item.post.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.post.photo} alt="Foto do post" loading="lazy" className="max-h-[480px] w-full rounded-xl bg-muted object-cover" />
            )}
          </div>
        )}
        {item.achievement && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 p-3">
            <Icon3D name="emoji/trofeu.webp" size={36} />
            <div>
              <p className="text-[15px]">
                {name} desbloqueou <b>{achievementLabel(item.achievement.key)}</b>
              </p>
              <p className="text-amber-500">{"★".repeat(Math.max(1, Math.min(3, item.achievement.tier)))}</p>
            </div>
          </div>
        )}
      </div>

      <Interactions item={item} />
    </article>
  );
}

function SessionBody({ name, s }: { name: string; s: NonNullable<FeedItem["session"]> }) {
  const parts = [s.questions ? `${s.questions} questões` : null, s.accuracy !== null ? `${s.accuracy}%` : null].filter(Boolean);
  return (
    <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
      <Icon3D name="emoji/cronometro.webp" size={36} />
      <div className="min-w-0">
        <p className="text-[15px]">
          {name} estudou <b>{fmtDuration(s.minutes)}</b> de <b>{s.subject}</b>
          {parts.length > 0 && <span className="text-muted-foreground"> · {parts.join(" · ")}</span>}
        </p>
        {s.topic && <p className="truncate text-sm text-muted-foreground">{s.topic}</p>}
      </div>
    </div>
  );
}

/** Nome legível da conquista a partir da chave (o catálogo de conquistas pode trocar por um título). */
function achievementLabel(key: string) {
  const t = key.replace(/[-_:.]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "uma conquista";
}

function Interactions({ item }: { item: FeedItem }) {
  const { members, meId } = useGroup();
  const [reactions, setReactions] = useState(item.reactions);
  const [count, setCount] = useState(item.comments);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const t = { kind: item.kind, id: item.id };

  const react = (emoji: string) => {
    // otimista: muda já, confirma no servidor
    setReactions((rs) =>
      rs.map((r) =>
        r.emoji !== emoji
          ? r
          : r.mine
            ? { ...r, mine: false, count: r.count - 1, users: r.users.filter((u) => u !== meId) }
            : { ...r, mine: true, count: r.count + 1, users: [...r.users, meId] },
      ),
    );
    start(async () => {
      await toggleReaction(t, emoji);
    });
  };

  const who = [...new Set(reactions.flatMap((r) => r.users))].map((u) => (u === meId ? "você" : (members.get(u)?.firstName ?? "alguém")));

  return (
    <div className="mt-3">
      {who.length > 0 && <p className="mb-2 text-xs text-muted-foreground">{joinNames(who)} reagi{who.length > 1 ? "ram" : "u"}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {reactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => react(r.emoji)}
            aria-pressed={r.mine}
            aria-label={`Reagir com ${r.emoji}`}
            title={r.users.map((u) => (u === meId ? "você" : (members.get(u)?.firstName ?? "alguém"))).join(", ") || undefined}
            className={cn(
              "flex h-8 items-center gap-1 rounded-full border px-2.5 text-sm transition active:scale-95",
              r.mine ? "border-primary bg-primary/10 font-bold text-primary" : "bg-background hover:bg-accent",
            )}
          >
            <span className="text-base leading-none">{r.emoji}</span>
            {r.count > 0 && <span className="tabular-nums">{r.count}</span>}
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MessageCircle className="size-4" />
          {count > 0 ? (
            <>
              {count} <span className="hidden sm:inline">{count === 1 ? "comentário" : "comentários"}</span>
            </>
          ) : (
            "Comentar"
          )}
        </button>
      </div>
      {open && <Comments target={t} onCount={setCount} />}
    </div>
  );
}

function Comments({ target, onCount }: { target: { kind: FeedItem["kind"]; id: string }; onCount: (n: number) => void }) {
  const { now } = useGroup();
  const [list, setList] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { kind, id } = target;
  useEffect(() => {
    let alive = true;
    getComments({ kind, id }).then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, [kind, id]);
  const set = (l: FeedComment[]) => (setList(l), onCount(l.length));

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    start(async () => {
      try {
        set(await addComment(target, text));
        setText("");
      } catch {
        setError("Não deu para comentar. Tente de novo.");
      }
    });
  };

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {list === null ? (
        <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
      ) : (
        list.map((c) => (
          <div key={c.id} className="flex gap-2">
            <Avatar id={c.userId} size={28} />
            <div className="min-w-0 flex-1 rounded-2xl bg-muted/60 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <CommentAuthor id={c.userId} />
                <span className="text-muted-foreground">{ago(c.at, Math.max(now, c.at))}</span>
                {c.mine && (
                  <button
                    aria-label="Apagar comentário"
                    onClick={() => start(async () => (await deleteComment(c.id), set(list.filter((x) => x.id !== c.id))))}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{c.text}</p>
            </div>
          </div>
        ))
      )}
      <form onSubmit={send} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Escreva um comentário…"
          aria-label="Comentário"
          className={cn(field, "rounded-full")}
        />
        <button
          disabled={pending || !text.trim()}
          aria-label="Enviar comentário"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function CommentAuthor({ id }: { id: string }) {
  const m = useMember(id);
  return <span className="font-bold">{m?.firstName ?? "Alguém"}</span>;
}

/** Reduz a foto no navegador (JPEG, máx. 1024px), como a foto do diário. */
async function compressPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

function Composer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await createPost({ text, photo });
      if ("error" in r) return setError(r.error ?? "Erro");
      onClose();
      router.refresh();
    });

  return (
    <Modal title="Publicar no grupo" onClose={onClose}>
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          autoFocus
          placeholder="Foto da mesa, uma conquista, um desabafo…"
          aria-label="Texto do post"
          className={field}
        />
        {photo ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Prévia da foto" className="max-h-72 w-full rounded-xl object-cover" />
            <button
              aria-label="Tirar foto"
              onClick={() => setPhoto(null)}
              className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-semibold text-primary hover:bg-accent">
            <Camera className="size-5" /> Adicionar foto
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setPhoto(await compressPhoto(f));
                } catch {
                  setError("Não deu para abrir essa imagem.");
                }
              }}
            />
          </label>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={pending || (!text.trim() && !photo)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Publicar
          </button>
        </div>
      </div>
    </Modal>
  );
}
