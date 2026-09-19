import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vault CRM",
  description: "Gestión de clientes, pagos, revisiones y contabilidad",
};

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/clientes", label: "Clientes" },
  { href: "/pagos", label: "Pagos" },
  { href: "/gastos", label: "Gastos" },
  { href: "/revisiones", label: "Revisiones" },
  { href: "/contabilidad", label: "Contabilidad" },
  { href: "/importar", label: "Importar" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex">
        <aside className="hidden md:flex md:w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-6 px-2">
            <div className="text-lg font-semibold">Vault CRM</div>
            <div className="text-xs text-[var(--muted)]">Gestión de clientes</div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          <header className="flex md:hidden items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="font-semibold">Vault CRM</div>
          </header>
          <nav className="flex md:hidden gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-2 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-[var(--accent-soft)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
