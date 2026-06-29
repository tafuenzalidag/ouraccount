"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { useEffect } from "react";
import { Home, Receipt, Upload, ArrowLeftRight, Settings } from "lucide-react";

const TABS = [
  { href: "/dashboard",   label: "Inicio",      Icon: Home },
  { href: "/transactions",label: "Gastos",       Icon: Receipt },
  { href: "/imports",     label: "Importar",     Icon: Upload },
  { href: "/settlement",  label: "Liquidación",  Icon: ArrowLeftRight },
  { href: "/settings",    label: "Ajustes",      Icon: Settings },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":         "Este mes",
  "/transactions":      "Gastos",
  "/transactions/new":  "Nuevo gasto",
  "/imports":           "Importar",
  "/settlement":        "Liquidación",
  "/settings":          "Ajustes",
  "/duplicates":        "Duplicados",
};

function activeTab(pathname: string) {
  if (pathname.startsWith("/duplicates")) return null;
  if (pathname.startsWith("/transactions")) return "/transactions";
  return TABS.find((t) => pathname === t.href)?.href ?? null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const title = PAGE_TITLES[pathname] ?? "NuestraCuenta";
  const active = activeTab(pathname);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "var(--background)",
        overflow: "hidden",
      }}
    >
      {/* NavBar — flat top */}
      <header
        style={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--surface)",
          boxShadow: "0 0.5px 0 var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 44,
            padding: "6px 16px",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 60 }} />

          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              fontWeight: "var(--weight-semibold)",
              color: "var(--text-strong)",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </span>

          <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end" }}>
            {pathname === "/settings" && (
              <button
                onClick={() => { clearToken(); router.replace("/login"); }}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                  fontWeight: "var(--weight-medium)",
                }}
              >
                Salir
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "var(--space-5) var(--space-4) var(--space-8)",
        }}
      >
        {children}
      </main>

      {/* TabBar — flat bottom */}
      <nav
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "stretch",
          padding: "8px 4px 10px",
          background: "var(--surface)",
          boxShadow: "0 -0.5px 0 var(--border)",
        }}
      >
        {TABS.map(({ href, label, Icon }) => {
          const sel = href === active;
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "2px 0",
                color: sel ? "var(--accent)" : "var(--text-muted)",
                textDecoration: "none",
                transition: "color var(--dur-fast) var(--ease-standard)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Icon
                size={24}
                strokeWidth={sel ? 2.5 : 1.8}
                aria-hidden
              />
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 10,
                  fontWeight: sel ? "var(--weight-semibold)" : "var(--weight-medium)",
                  letterSpacing: "0.01em",
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
