// Esqueleto enquanto as estatísticas carregam.
const Bone = ({ className }: { className: string }) => <div className={`animate-pulse rounded-xl bg-muted ${className}`} />;

export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Carregando estatísticas">
      <div className="card-soft flex flex-col gap-3 p-4 md:flex-row md:items-center md:px-6">
        <div className="flex items-center gap-3">
          <Bone className="size-10" />
          <div className="space-y-2">
            <Bone className="h-5 w-32" />
            <Bone className="h-3 w-40" />
          </div>
        </div>
        <div className="flex gap-2 md:ml-auto">
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className="h-8 w-16 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card-soft space-y-2 p-3 md:p-4">
            <Bone className="h-3 w-20" />
            <Bone className="h-7 w-16" />
            <Bone className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="card-soft space-y-3 p-4 md:p-5">
        <Bone className="h-5 w-48" />
        <Bone className="h-56 w-full md:h-64" />
      </div>
      <div className="card-soft space-y-3 p-4 md:p-5">
        <Bone className="h-5 w-40" />
        <Bone className="h-28 w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="card-soft space-y-3 p-4 md:p-5">
            <Bone className="h-5 w-40" />
            {Array.from({ length: 4 }, (_, j) => (
              <Bone key={j} className="h-6 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
