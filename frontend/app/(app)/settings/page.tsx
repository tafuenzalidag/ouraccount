"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getHouseholdId, setHouseholdId } from "@/lib/auth";
import type { HouseholdOut } from "@/types/api";

type Tab = "crear" | "unirse";

export default function SettingsPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<HouseholdOut | null>(null);
  const [tab, setTab] = useState<Tab>("crear");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Create household form
  const [nombre, setNombre] = useState("");
  const [ratioA, setRatioA] = useState("0.57");
  const [nombreA, setNombreA] = useState("");

  // Join form
  const [code, setCode] = useState("");

  // Invite code display
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    const hid = getHouseholdId();
    if (hid) {
      apiFetch<HouseholdOut>(`/api/households/${hid}`)
        .then(setHousehold)
        .catch(() => setHousehold(null));
    }
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const ratio = parseFloat(ratioA);
    if (isNaN(ratio) || ratio <= 0 || ratio >= 1) {
      setError("El ratio debe estar entre 0 y 1 (ej. 0.57)");
      return;
    }
    setLoading(true);
    try {
      const h = await apiFetch<HouseholdOut>("/api/households", {
        method: "POST",
        body: JSON.stringify({
          nombre,
          ratio_a: ratio,
          nombre_display_a: nombreA || null,
        }),
      });
      setHouseholdId(h.id);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el hogar");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const h = await apiFetch<HouseholdOut>("/api/households/join", {
        method: "POST",
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      setHouseholdId(h.id);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido o expirado");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateInvite() {
    if (!household) return;
    setInviteLoading(true);
    setInviteCode("");
    try {
      const res = await apiFetch<{ code: string }>(
        `/api/households/${household.id}/invite`,
        { method: "POST" }
      );
      setInviteCode(res.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar código");
    } finally {
      setInviteLoading(false);
    }
  }

  if (household) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <h2 className="text-xl font-semibold">Ajustes</h2>
        <div className="rounded-lg border border-white/10 p-4 space-y-1">
          <p className="text-sm text-gray-400">Hogar actual</p>
          <p className="font-medium">{household.nombre}</p>
          <p className="text-xs text-gray-500">{household.moneda}</p>
        </div>
        <div className="rounded-lg border border-white/10 p-4 space-y-3">
          <p className="font-medium">Invitar a otra persona</p>
          <p className="text-sm text-gray-400">
            Genera un código de 6 caracteres para que la otra persona se una al hogar.
          </p>
          <button
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
            className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
          >
            {inviteLoading ? "Generando…" : "Generar código de invitación"}
          </button>
          {inviteCode && (
            <div className="text-center py-3 bg-white/5 rounded-md">
              <p className="text-xs text-gray-400 mb-1">Código de invitación</p>
              <p className="text-3xl font-mono font-bold tracking-widest">{inviteCode}</p>
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h2 className="text-xl font-semibold">Configurar hogar</h2>
      <div className="flex border-b border-white/10">
        {(["crear", "unirse"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {t === "crear" ? "Crear hogar" : "Unirse con código"}
          </button>
        ))}
      </div>

      {tab === "crear" ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre del hogar</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nuestro Depto"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tu nombre (opcional)</label>
            <input
              value={nombreA}
              onChange={(e) => setNombreA(e.target.value)}
              placeholder="Tomas"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tu porcentaje de gastos</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              value={ratioA}
              onChange={(e) => setRatioA(e.target.value)}
              placeholder="0.57"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ej: 0.57 significa que pagas el 57% de los gastos del hogar
            </p>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Creando…" : "Crear hogar"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Código de invitación</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="X7K2QP"
              maxLength={6}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Uniéndose…" : "Unirse al hogar"}
          </button>
        </form>
      )}
    </div>
  );
}
