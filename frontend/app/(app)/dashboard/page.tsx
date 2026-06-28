"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
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

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-text)",
  fontSize: "var(--t-footnote-size)",
  fontWeight: "var(--w-semibold)",
  color: "var(--text-tertiary)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: "var(--space-3)",
  marginTop: "var(--space-6)",
  paddingLeft: 4,
};

export default function DashboardPage() {
  const router = useRouter();
  const [settlement, setSettlement] = useState<SettlementPeriodOut | null>(null);
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const [totalMes, setTotalMes] = useState(0);
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
        const recent = t.slice(0, 5);
        setTxs(recent);
        const total = t.reduce((acc, tx) => acc + tx.monto, 0);
        setTotalMes(total);
        setMemberNames(Object.fromEntries(members.map((m) => [m.user_id, m.nombre_display])));
      })
      .catch(() => setError("Error cargando datos"));
  }, [router]);

  async function handlePay(id: string) {
    const hid = householdId!;
    await apiFetch(`/api/settlements/${id}/pay`, { method: "POST" });
    const { desde, hasta } = currentMonthRange();
    const s = await apiFetch<SettlementPeriodOut>(`/api/households/${hid}/settlement?desde=${desde}&hasta=${hasta}`);
    setSettlement(s);
  }

  if (error) {
    return (
      <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-alert)" }}>
        {error}
      </p>
    );
  }

  return (
    <div>
      {/* Total del mes */}
      <div
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-5)",
          boxShadow: "var(--shadow-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--t-caption-size)",
            color: "var(--text-tertiary)",
            margin: "0 0 4px",
            letterSpacing: "0.04em",
            textTransform: "uppercase" as const,
          }}
        >
          Gastos del mes
        </p>
        <p
          style={{
            fontFamily: "var(--font-rounded)",
            fontSize: "var(--t-value-size)",
            fontWeight: "var(--t-value-weight)",
            letterSpacing: "var(--t-value-track)",
            fontVariantNumeric: "tabular-nums" as const,
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: "var(--t-value-lh)",
          }}
        >
          {formatCLP(totalMes)}
        </p>
      </div>

      {/* Liquidación */}
      {settlement && (
        <SettlementCard data={settlement} memberNames={memberNames} onPay={handlePay} />
      )}

      {/* Últimos gastos */}
      <p style={sectionLabel as React.CSSProperties}>Últimos gastos</p>

      <div
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-2)",
          overflow: "hidden",
          marginBottom: "var(--space-5)",
        }}
      >
        {txs.length === 0 ? (
          <p
            style={{
              fontFamily: "var(--font-text)",
              fontSize: "var(--t-footnote-size)",
              color: "var(--text-tertiary)",
              textAlign: "center",
              padding: "var(--space-7)",
              margin: 0,
            }}
          >
            Sin gastos registrados aún
          </p>
        ) : (
          <>
            {txs.map((tx, i) => (
              <div key={tx.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-4) var(--card-padding)",
                    gap: "var(--space-3)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-text)",
                        fontSize: "var(--t-subhead-size)",
                        fontWeight: "var(--w-medium)",
                        color: "var(--text-primary)",
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tx.descripcion_norm}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-text)",
                        fontSize: "var(--t-caption-size)",
                        color: "var(--text-tertiary)",
                        margin: "2px 0 0",
                      }}
                    >
                      {tx.fecha_operacion}
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-text)",
                      fontSize: "var(--t-subhead-size)",
                      fontWeight: "var(--w-semibold)",
                      color: tx.monto < 0 ? "var(--state-safe)" : "var(--text-primary)",
                      flexShrink: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatCLP(tx.monto)}
                  </span>
                </div>
                {i < txs.length - 1 && (
                  <div style={{ height: "0.5px", background: "var(--separator)", marginLeft: 16 }} />
                )}
              </div>
            ))}

            {/* Ver todos link */}
            <div style={{ height: "0.5px", background: "var(--separator)" }} />
            <Link
              href="/transactions"
              style={{
                display: "block",
                padding: "var(--space-4) var(--card-padding)",
                fontFamily: "var(--font-text)",
                fontSize: "var(--t-subhead-size)",
                color: "var(--accent)",
                textDecoration: "none",
                fontWeight: "var(--w-medium)",
              }}
            >
              Ver todos los gastos
            </Link>
          </>
        )}
      </div>

      {/* FAB — agregar gasto */}
      <Link
        href="/transactions/new"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-3)",
          width: "100%",
          padding: "13px 20px",
          background: "var(--accent)",
          color: "var(--text-on-accent)",
          borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-text)",
          fontSize: 17,
          fontWeight: "var(--w-semibold)",
          letterSpacing: "-0.01em",
          textDecoration: "none",
          boxShadow: "var(--shadow-2)",
          transition: "transform var(--dur-fast) var(--ease-standard)",
        }}
      >
        <Plus size={20} strokeWidth={2.5} />
        Agregar gasto
      </Link>
    </div>
  );
}
