"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { getHouseholdId } from "@/lib/auth";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionOut } from "@/types/api";

export default function NewTransactionPage() {
  const router = useRouter();
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    setHouseholdId(getHouseholdId());
  }, []);

  function handleCreated(_tx: TransactionOut) {
    router.push("/transactions");
  }

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.back()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginBottom: "var(--space-5)",
          fontFamily: "var(--font-text)",
          fontSize: 15,
          color: "var(--accent)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontWeight: "var(--w-medium)",
        }}
      >
        <ChevronLeft size={18} strokeWidth={2} />
        Gastos
      </button>

      {householdId ? (
        <TransactionForm householdId={householdId} onCreated={handleCreated} />
      ) : (
        <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--text-tertiary)" }}>
          No hay hogar configurado
        </p>
      )}
    </div>
  );
}
