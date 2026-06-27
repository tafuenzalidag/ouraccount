"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
      <h2 className="text-xl font-semibold mb-4">Nuevo gasto</h2>
      {householdId ? (
        <TransactionForm householdId={householdId} onCreated={handleCreated} />
      ) : (
        <p className="text-gray-400 text-sm">No hay hogar configurado.</p>
      )}
    </div>
  );
}
