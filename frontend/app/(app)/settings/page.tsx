"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getHouseholdId, setHouseholdId } from "@/lib/auth";
import type { HouseholdOut, PaymentMethodOut, MemberOut } from "@/types/api";

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

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOut[]>([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [members, setMembers] = useState<MemberOut[]>([]);

  // PM add form
  const [showForm, setShowForm] = useState(false);
  const [formAlias, setFormAlias] = useState("");
  const [formTipo, setFormTipo] = useState("tarjeta_credito");
  const [formBanco, setFormBanco] = useState("");
  const [formDigitos, setFormDigitos] = useState("");
  const [formEsCompartido, setFormEsCompartido] = useState(true);
  const [formOwner, setFormOwner] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // PM delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const hid = getHouseholdId();
    if (!hid) return;
    apiFetch<HouseholdOut>(`/api/households/${hid}`)
      .then(setHousehold)
      .catch(() => setHousehold(null));
    setPmLoading(true);
    apiFetch<PaymentMethodOut[]>(`/api/households/${hid}/payment-methods`)
      .then(setPaymentMethods)
      .catch(() => setPaymentMethods([]))
      .finally(() => setPmLoading(false));
    apiFetch<MemberOut[]>(`/api/households/${hid}/members`)
      .then((ms) => {
        setMembers(ms);
        if (ms.length > 0) setFormOwner(ms[0].user_id);
      })
      .catch(() => setMembers([]));
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

  async function handleAddPm(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const hid = getHouseholdId();
    if (!hid) return;
    setFormLoading(true);
    try {
      const pm = await apiFetch<PaymentMethodOut>(
        `/api/households/${hid}/payment-methods`,
        {
          method: "POST",
          body: JSON.stringify({
            alias: formAlias.trim(),
            tipo: formTipo,
            banco: formBanco.trim() || null,
            ultimos_digitos: formDigitos.trim() || null,
            es_compartido: formEsCompartido,
            owner_user_id: formEsCompartido ? null : formOwner || null,
          }),
        }
      );
      setPaymentMethods((prev) => [...prev, pm]);
      setShowForm(false);
      setFormAlias("");
      setFormBanco("");
      setFormDigitos("");
      setFormEsCompartido(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al agregar");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeletePm(pmId: string) {
    const hid = getHouseholdId();
    if (!hid) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/households/${hid}/payment-methods/${pmId}`, {
        method: "DELETE",
      });
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== pmId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
      setConfirmDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  function ownerName(ownerId: string | null): string | null {
    if (!ownerId) return null;
    return members.find((m) => m.user_id === ownerId)?.nombre_display ?? null;
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

        <div className="rounded-lg border border-white/10 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">Medios de pago</p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Agregar
              </button>
            )}
          </div>

          {pmLoading ? (
            <p className="text-sm text-gray-400">Cargando…</p>
          ) : paymentMethods.length === 0 && !showForm ? (
            <p className="text-sm text-gray-500">No hay medios de pago registrados.</p>
          ) : (
            <ul className="space-y-0 divide-y divide-white/5">
              {paymentMethods.map((pm) => (
                <li key={pm.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-sm">{pm.alias}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
                        {pm.tipo === "tarjeta_credito" ? "TC" : "CC"}
                      </span>
                      {pm.es_compartido ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">
                          compartido
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">
                          {ownerName(pm.owner_user_id) ?? "personal"}
                        </span>
                      )}
                    </div>
                    {(pm.banco || pm.ultimos_digitos) && (
                      <p className="text-xs text-gray-500">
                        {pm.banco ?? ""}
                        {pm.banco && pm.ultimos_digitos ? " · " : ""}
                        {pm.ultimos_digitos ? `••••${pm.ultimos_digitos}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 pt-0.5">
                    {confirmDeleteId === pm.id ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">¿Eliminar?</span>
                        <button
                          onClick={() => handleDeletePm(pm.id)}
                          disabled={deleteLoading}
                          className="text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(pm.id)}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showForm && (
            <form
              onSubmit={handleAddPm}
              className="border-t border-white/10 pt-4 space-y-3"
            >
              <p className="text-sm font-medium text-gray-300">Nuevo medio de pago</p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Alias *</label>
                <input
                  required
                  value={formAlias}
                  onChange={(e) => setFormAlias(e.target.value)}
                  placeholder="Ej: Tarjeta Tomás"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tipo *</label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-gray-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="tarjeta_credito">Tarjeta de crédito</option>
                  <option value="cuenta_corriente">Cuenta corriente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Banco</label>
                <input
                  value={formBanco}
                  onChange={(e) => setFormBanco(e.target.value)}
                  placeholder="Ej: Santander"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Últimos 4 dígitos</label>
                <input
                  value={formDigitos}
                  onChange={(e) =>
                    setFormDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="1234"
                  maxLength={4}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="es-compartido"
                  type="checkbox"
                  checked={formEsCompartido}
                  onChange={(e) => setFormEsCompartido(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="es-compartido" className="text-sm text-gray-300 cursor-pointer">
                  ¿Es compartido?
                </label>
              </div>
              {!formEsCompartido && members.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Dueño</label>
                  <select
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-gray-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.nombre_display}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {formLoading ? "Agregando…" : "Agregar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError("");
                    setFormAlias("");
                    setFormBanco("");
                    setFormDigitos("");
                    setFormEsCompartido(true);
                  }}
                  className="px-4 py-1.5 rounded-md border border-white/10 text-sm text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
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
