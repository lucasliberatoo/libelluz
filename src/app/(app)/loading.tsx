// Mostra um esqueleto na hora em que a pessoa toca num link, enquanto a próxima tela carrega.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="card-soft h-28" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-soft h-48" />
        <div className="card-soft h-48" />
        <div className="card-soft h-48" />
      </div>
      <div className="card-soft h-64" />
    </div>
  );
}
