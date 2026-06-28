"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getHouseholdId } from "@/lib/auth";
import { TransactionOut } from "@/types/api";
import { TransactionList } from "@/components/TransactionList";

export default function TransactionsPage() {
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    const hid = getHouseholdId();
    setHouseholdId(hid);
    if (!hid) return;
    apiFetch<TransactionOut[]>(`/api/households/${hid}/transactions`).then(setTxs);
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
