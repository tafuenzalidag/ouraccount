"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { useEffect } from "react";

const NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/transactions", label: "Gastos" },
  { href: "/imports", label: "Importar" },
  { href: "/settlement", label: "Liquidación" },
  { href: "/settings", label: "Ajustes" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <span className="font-bold text-lg">NuestraCuenta</span>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">
          Salir
        </button>
      </header>
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">{children}</main>
      <nav className="bg-white border-t flex justify-around py-2">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`text-sm px-3 py-1 rounded ${pathname === n.href ? "font-bold text-blue-600" : "text-gray-500"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
