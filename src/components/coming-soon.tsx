import { CairnLogo } from "@/components/brand";

export function ComingSoon({ title, phase, children }: { title: string; phase: string; children?: React.ReactNode }) {
  return (
    <section className="card-soft grid place-items-center gap-2 p-10 text-center">
      <CairnLogo className="size-12 text-primary/60" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{children ?? "Esta tela ainda vai ser construída."}</p>
      <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{phase}</span>
    </section>
  );
}
