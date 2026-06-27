"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getHouseholdId } from "@/lib/auth";
import { SettlementCard } from "@/components/SettlementCard";
import { SettlementPeriodOut, TransactionOut } from "@/types/api";

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

function currentMonthRange() {
  const now = new Date();
  const desde = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  return { desde, hasta };
}

export default function DashboardPage() {
  const router = useRouter();
  const [settlement, setSettlement] = useState<SettlementPeriodOut | null>(null);
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const hid = getHouseholdId();
    if (!hid) { router.push("/settings"); return; }
    setHouseholdId(hid);
    const { desde, hasta } = currentMonthRange();
    Promise.all([
      apiFetch<SettlementPeriodOut>(`/api/households/${hid}/settlement?desde=${desde}&hasta=${hasta}`),
      apiFetch<TransactionOut[]>(`/api/households/${hid}/transactions`),
      apiFetch<Array<{ user_id: string; nombre_display: string }>>(`/api/households/${hid}/members`),
    ])
      .then(([s, t, members]) => {
        setSettlement(s);
        setTxs(t.slice(0, 5));
        setMemberNames(Object.fromEntries(members.map((m) => [m.user_id, m.nombre_display])));
      })
      .catch(() => setError("Error cargando datos"));
  }, [router]);

  async function handlePay(id: string) {
    await apiFetch(`/api/settlements/${id}/pay`, { method: "POST" });
    const hid = householdId!;
    const { desde, hasta } = currentMonthRange();
    const s = await apiFetch<SettlementPeriodOut>(`/api/households/${hid}/settlement?desde=${desde}&hasta=${hasta}`);
    setSettlement(s);
  }

  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Este mes</h2>

      {settlement && (
        <SettlementCard
          data={settlement}
          memberNames={memberNames}
          onPay={handlePay}
        />
      )}

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-gray-700">Últimos gastos</h3>
          <Link href="/transactions" className="text-sm text-blue-600">Ver todos</Link>
        </div>
        {txs.length === 0 && <p className="text-gray-400 text-sm">Sin gastos registrados aún.</p>}
        {txs.map((tx) => (
          <div key={tx.id} className="flex justify-between items-center py-2 border-b last:border-0">
            <div>
              <p className="text-sm font-medium">{tx.descripcion_norm}</p>
              <p className="text-xs text-gray-400">{tx.fecha_operacion}</p>
            </div>
            <span className={`text-sm font-medium ${tx.monto < 0 ? "text-green-600" : "text-gray-800"}`}>
              {formatCLP(tx.monto)}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/transactions/new"
        className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-medium hover:bg-blue-700"
      >
        + Agregar gasto
      </Link>
    </div>
  );
}
