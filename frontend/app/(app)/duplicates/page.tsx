"use client";
import { useState, useEffect } from "react";
import { getToken, getHouseholdId } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type TxSnippet = {
  external_id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  monto: number;
  origen: "manual" | "importado";
  payment_method_alias: string;
};

type DuplicatePair = {
  tx_manual: TxSnippet;
  tx_importado: TxSnippet;
};

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL")}`;
}

function TxCard({ tx, label, onDelete }: { tx: TxSnippet; label: string; onDelete: () => void }) {
  return (
    <div style={{ flex: 1, padding: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "var(--space-2)" }}>{label}</div>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-body)" }}>{tx.descripcion_raw}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{tx.fecha_operacion}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--weight-semibold)", fontSize: "var(--text-sm)", color: "var(--text-strong)", marginTop: 4 }}>{formatCLP(tx.monto)}</div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{tx.payment_method_alias}</div>
      <button
        onClick={onDelete}
        style={{
          marginTop: "var(--space-3)", width: "100%", height: 36,
          background: "var(--negative-soft)", color: "var(--red-600)",
          border: "none", borderRadius: "var(--radius-lg)",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-medium)", cursor: "pointer",
        }}
      >
        Eliminar este
      </button>
    </div>
  );
}

export default function DuplicatesPage() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? getToken() : null;
  const householdId = typeof window !== "undefined" ? getHouseholdId() : null;

  useEffect(() => {
    if (!token || !householdId) { setLoading(false); return; }
    fetch(`${API}/api/households/${householdId}/duplicate-candidates`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setPairs)
      .finally(() => setLoading(false));
  }, [token, householdId]);

  async function deleteTx(externalId: string, pairIdx: number) {
    if (!confirm("¿Seguro que quieres eliminar este gasto?")) return;
    await fetch(`${API}/api/households/${householdId}/transactions/${externalId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setPairs((prev) => prev.filter((_, i) => i !== pairIdx));
  }

  async function dismiss(pair: DuplicatePair, pairIdx: number) {
    await fetch(`${API}/api/households/${householdId}/dismiss-duplicate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_external_id_a: pair.tx_manual.external_id,
        tx_external_id_b: pair.tx_importado.external_id,
      }),
    });
    setPairs((prev) => prev.filter((_, i) => i !== pairIdx));
  }

  if (loading) return <p style={{ padding: "var(--space-4)", color: "var(--text-muted)" }}>Cargando…</p>;

  if (pairs.length === 0) {
    return (
      <div style={{
        margin: "var(--space-10) auto", textAlign: "center",
        background: "var(--surface)", borderRadius: "var(--radius-xl)",
        boxShadow: "var(--ring-card)", padding: "var(--space-8) var(--space-4)",
      }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Sin duplicados pendientes</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {pairs.map((pair, i) => (
        <div key={i} style={{
          background: "var(--surface)", borderRadius: "var(--radius-xl)",
          boxShadow: "var(--ring-card)", overflow: "hidden",
        }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <TxCard tx={pair.tx_manual} label="Manual" onDelete={() => deleteTx(pair.tx_manual.external_id, i)} />
            <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />
            <TxCard tx={pair.tx_importado} label="Importado" onDelete={() => deleteTx(pair.tx_importado.external_id, i)} />
          </div>
          <div style={{ padding: "var(--space-3)" }}>
            <button
              onClick={() => dismiss(pair, i)}
              style={{
                width: "100%", height: 36,
                background: "transparent", color: "var(--text-secondary)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-medium)", cursor: "pointer",
              }}
            >
              No son duplicados
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
