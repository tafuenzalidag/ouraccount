"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Gastos</h2>
        <Link
          href="/transactions/new"
          className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          + Nuevo
        </Link>
      </div>
      {householdId ? (
        <TransactionList transactions={txs} />
      ) : (
        <p className="text-gray-400 text-sm text-center py-8">No hay hogar configurado.</p>
      )}
    </div>
  );
}
