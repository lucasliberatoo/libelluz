import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { FocusProvider } from "@/components/focus/focus-provider";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Libelluz",
  description: "Estude para o ENEM evoluindo rumo aos 160+.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2f5bff" },
    { media: "(prefers-color-scheme: dark)", color: "#141a2e" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <FocusProvider>
            <AppShell>{children}</AppShell>
          </FocusProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
