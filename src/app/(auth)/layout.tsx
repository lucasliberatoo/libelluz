import { Foguinho, Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-primary/10 to-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center gap-2">
          <Foguinho stage={2} className="size-24 drop-shadow-md" />
          <Wordmark className="text-2xl" />
          <p className="text-center text-sm text-muted-foreground">Estude pro ENEM evoluindo rumo aos 160+.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
