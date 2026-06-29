"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getHouseholdId, getToken } from "@/lib/auth";
import { TransactionOut } from "@/types/api";
import { TransactionList } from "@/components/TransactionList";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function TransactionsPage() {
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);

  useEffect(() => {
    const hid = getHouseholdId();
    setHouseholdId(hid);
    if (!hid) return;
    apiFetch<TransactionOut[]>(`/api/households/${hid}/transactions`).then(setTxs);
  }, []);

  useEffect(() => {
    const token = getToken();
    const hid = getHouseholdId();
    if (!token || !hid) return;
    fetch(`${API}/api/households/${hid}/duplicate-candidates`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: unknown[]) => setDuplicateCount(data.length))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* New button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
        <Link
          href="/transactions/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "7px 14px",
            background: "var(--accent)",
            color: "var(--text-on-accent)",
            borderRadius: "var(--radius-pill)",
            fontFamily: "var(--font-text)",
            fontSize: 15,
            fontWeight: "var(--w-semibold)",
            textDecoration: "none",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Nuevo
        </Link>
      </div>

      {duplicateCount > 0 && (
        <Link
          href="/duplicates"
          style={{
            display: "block", marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--accent-soft)", borderRadius: "var(--radius-lg)",
            color: "var(--accent)", fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-medium)", textDecoration: "none",
            border: "1px solid var(--blue-100)",
          }}
        >
          {duplicateCount} posible{duplicateCount > 1 ? "s" : ""} duplicado{duplicateCount > 1 ? "s" : ""} detectado{duplicateCount > 1 ? "s" : ""} — Revisar →
        </Link>
      )}

      {householdId ? (
        <TransactionList transactions={txs} />
      ) : (
        <div
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-9)",
            textAlign: "center",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", color: "var(--text-tertiary)", margin: 0 }}>
            No hay hogar configurado
          </p>
        </div>
      )}
    </div>
  );
}
