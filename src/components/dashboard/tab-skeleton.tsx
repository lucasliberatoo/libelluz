const Bone = ({ className }: { className: string }) => <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />;

/** Esqueleto das abas Semana / Jornada / Ranking enquanto os dados chegam. */
export function TabSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-12 md:gap-4" aria-busy="true" aria-label="Carregando">
      <Bone className="h-64 md:col-span-8" />
      <div className="grid gap-3 md:col-span-4 md:gap-4">
        <Bone className="h-30" />
        <Bone className="h-30" />
      </div>
      <Bone className="h-24 md:col-span-12" />
    </div>
  );
}
