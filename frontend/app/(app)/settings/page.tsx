"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CreditCard, Landmark } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getHouseholdId, setHouseholdId } from "@/lib/auth";
import type { HouseholdOut, PaymentMethodOut, MemberOut } from "@/types/api";

type Tab = "crear" | "unirse";

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-text)",
  fontSize: "var(--t-footnote-size)",
  fontWeight: "var(--w-semibold)",
  color: "var(--text-tertiary)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: "var(--space-2)",
  marginTop: "var(--space-6)",
  paddingLeft: 4,
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface-card)",
  borderRadius: "var(--radius-xl)",
  boxShadow: "var(--shadow-2)",
  overflow: "hidden",
};

const baseInput: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 14px",
  background: "var(--bg-grouped)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "inset 0 0 0 1px var(--separator)",
  border: "none",
  fontFamily: "var(--font-text)",
  fontSize: 17,
  color: "var(--text-primary)",
  transition: "box-shadow var(--dur-base) var(--ease-standard)",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-text)",
  fontSize: 13,
  fontWeight: "var(--w-semibold)",
  color: "var(--text-secondary)",
  letterSpacing: "-0.005em",
  display: "block",
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  ...baseInput,
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  paddingRight: 40,
};

export default function SettingsPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<HouseholdOut | null>(null);
  const [tab, setTab] = useState<Tab>("crear");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [nombre, setNombre] = useState("");
  const [ratioA, setRatioA] = useState("57");
  const [nombreA, setNombreA] = useState("");
  const [code, setCode] = useState("");

  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOut[]>([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [members, setMembers] = useState<MemberOut[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [formAlias, setFormAlias] = useState("");
  const [formTipo, setFormTipo] = useState("tarjeta_credito");
  const [formBanco, setFormBanco] = useState("");
  const [formDigitos, setFormDigitos] = useState("");
  const [formEsCompartido, setFormEsCompartido] = useState(true);
  const [formOwner, setFormOwner] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    const hid = getHouseholdId();
    if (!hid) return;
    apiFetch<HouseholdOut>(`/api/households/${hid}`).then(setHousehold).catch(() => setHousehold(null));
    setPmLoading(true);
    apiFetch<PaymentMethodOut[]>(`/api/households/${hid}/payment-methods`)
      .then(setPaymentMethods)
      .catch(() => setPaymentMethods([]))
      .finally(() => setPmLoading(false));
    apiFetch<MemberOut[]>(`/api/households/${hid}/members`)
      .then((ms) => { setMembers(ms); if (ms.length > 0) setFormOwner(ms[0].user_id); })
      .catch(() => setMembers([]));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pct = parseFloat(ratioA);
    if (isNaN(pct) || pct < 1 || pct > 99) { setError("El porcentaje debe estar entre 1 y 99"); return; }
    setLoading(true);
    try {
      const h = await apiFetch<HouseholdOut>("/api/households", {
        method: "POST",
        body: JSON.stringify({ nombre, ratio_a: pct / 100, nombre_display_a: nombreA || null }),
      });
      setHouseholdId(h.external_id);
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
      setHouseholdId(h.external_id);
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
      const res = await apiFetch<{ code: string }>(`/api/households/${household.external_id}/invite`, { method: "POST" });
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
      const pm = await apiFetch<PaymentMethodOut>(`/api/households/${hid}/payment-methods`, {
        method: "POST",
        body: JSON.stringify({
          alias: formAlias.trim(),
          tipo: formTipo,
          banco: formBanco.trim() || null,
          ultimos_digitos: formDigitos.trim() || null,
          es_compartido: formEsCompartido,
          owner_user_id: formEsCompartido ? null : formOwner || null,
        }),
      });
      setPaymentMethods((prev) => [...prev, pm]);
      setShowForm(false);
      setFormAlias(""); setFormBanco(""); setFormDigitos(""); setFormEsCompartido(true);
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
      await apiFetch(`/api/households/${hid}/payment-methods/${pmId}`, { method: "DELETE" });
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== pmId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
      setConfirmDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  function ownerName(ownerId: string | null) {
    if (!ownerId) return null;
    return members.find((m) => m.user_id === ownerId)?.nombre_display ?? null;
  }

  function s(name: string): React.CSSProperties {
    return focused === name ? { ...baseInput, boxShadow: "inset 0 0 0 1.5px var(--accent)" } : baseInput;
  }

  /* ---- HOUSEHOLD EXISTS ---- */
  if (household) {
    return (
      <div>
        {/* Household info */}
        <p style={sectionLabel as React.CSSProperties}>Hogar</p>
        <div style={cardStyle}>
          <div style={{ padding: "var(--space-4) var(--card-padding)" }}>
            <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-headline-size)", fontWeight: "var(--w-semibold)", color: "var(--text-primary)", margin: "0 0 2px", letterSpacing: "var(--t-headline-track)" }}>
              {household.nombre}
            </p>
            <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--text-tertiary)", margin: 0 }}>
              {household.moneda}
            </p>
          </div>
        </div>

        {/* Invite section */}
        <p style={sectionLabel as React.CSSProperties}>Invitación</p>
        <div style={{ ...cardStyle, padding: "var(--card-padding)" }}>
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", color: "var(--text-secondary)", margin: "0 0 var(--space-4)", lineHeight: "var(--t-subhead-lh)" }}>
            Genera un código de 6 caracteres para que la otra persona se una al hogar.
          </p>
          <button
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
            style={{
              width: "100%",
              padding: "11px 20px",
              background: "var(--accent)",
              color: "var(--text-on-accent)",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-text)",
              fontSize: 17,
              fontWeight: "var(--w-semibold)",
              cursor: inviteLoading ? "not-allowed" : "pointer",
              opacity: inviteLoading ? 0.5 : 1,
              letterSpacing: "-0.01em",
            }}
          >
            {inviteLoading ? "Generando…" : "Generar código de invitación"}
          </button>
          {inviteCode && (
            <div
              style={{
                marginTop: "var(--space-4)",
                background: "var(--fill-4)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-5)",
                textAlign: "center",
              }}
            >
              <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-caption-size)", color: "var(--text-tertiary)", margin: "0 0 6px", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                Código de invitación
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 34, fontWeight: "var(--w-bold)", letterSpacing: "0.2em", color: "var(--text-primary)", margin: 0 }}>
                {inviteCode}
              </p>
            </div>
          )}
          {error && (
            <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-alert)", margin: "var(--space-3) 0 0" }}>
              {error}
            </p>
          )}
        </div>

        {/* Payment methods */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "var(--space-6)", marginBottom: "var(--space-2)", paddingLeft: 4 }}>
          <p style={{ ...sectionLabel as React.CSSProperties, margin: 0 }}>Medios de pago</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--font-text)",
                fontSize: 14,
                fontWeight: "var(--w-medium)",
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              Agregar
            </button>
          )}
        </div>

        <div style={cardStyle}>
          {pmLoading ? (
            <div style={{ padding: "var(--space-7)", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--text-tertiary)", margin: 0 }}>Cargando…</p>
            </div>
          ) : paymentMethods.length === 0 && !showForm ? (
            <div style={{ padding: "var(--space-7)", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", color: "var(--text-tertiary)", margin: 0 }}>
                Sin medios de pago registrados
              </p>
            </div>
          ) : (
            <>
              {paymentMethods.map((pm, i) => (
                <div key={pm.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-4) var(--card-padding)" }}>
                    {/* Icon */}
                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--fill-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {pm.tipo === "tarjeta_credito"
                        ? <CreditCard size={18} color="var(--accent)" strokeWidth={1.8} />
                        : <Landmark size={18} color="var(--text-secondary)" strokeWidth={1.8} />
                      }
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", fontWeight: "var(--w-medium)", color: "var(--text-primary)" }}>
                          {pm.alias}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: "var(--w-semibold)", padding: "1px 6px", background: "var(--fill-3)", borderRadius: "var(--radius-xs)", color: "var(--text-secondary)" }}>
                          {pm.tipo === "tarjeta_credito" ? "TC" : "CC"}
                        </span>
                        {pm.es_compartido ? (
                          <span style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: "var(--w-semibold)", padding: "1px 8px", background: "var(--accent-tint)", borderRadius: "var(--radius-pill)", color: "var(--accent)" }}>
                            compartido
                          </span>
                        ) : (
                          <span style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: "var(--w-semibold)", padding: "1px 8px", background: "var(--fill-3)", borderRadius: "var(--radius-pill)", color: "var(--text-secondary)" }}>
                            {ownerName(pm.owner_user_id) ?? "personal"}
                          </span>
                        )}
                      </div>
                      {(pm.banco || pm.ultimos_digitos) && (
                        <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-caption-size)", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
                          {pm.banco ?? ""}{pm.banco && pm.ultimos_digitos ? " · " : ""}{pm.ultimos_digitos ? `••••${pm.ultimos_digitos}` : ""}
                        </p>
                      )}
                    </div>

                    {/* Delete */}
                    {confirmDeleteId === pm.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
                        <button
                          onClick={() => handleDeletePm(pm.id)}
                          disabled={deleteLoading}
                          style={{ fontFamily: "var(--font-text)", fontSize: 14, fontWeight: "var(--w-semibold)", color: "var(--state-alert)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ fontFamily: "var(--font-text)", fontSize: 14, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(pm.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-quaternary)", flexShrink: 0 }}
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                  {(i < paymentMethods.length - 1 || showForm) && (
                    <div style={{ height: "0.5px", background: "var(--separator)", marginLeft: 16 }} />
                  )}
                </div>
              ))}

              {/* Add PM form */}
              {showForm && (
                <form onSubmit={handleAddPm} style={{ padding: "var(--card-padding)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", fontWeight: "var(--w-semibold)", color: "var(--text-primary)", margin: 0 }}>
                    Nuevo medio de pago
                  </p>

                  <div>
                    <label style={labelStyle}>Alias *</label>
                    <input required value={formAlias} onChange={(e) => setFormAlias(e.target.value)} placeholder="Ej: Tarjeta Tomás" style={s("alias")} onFocus={() => setFocused("alias")} onBlur={() => setFocused(null)} />
                  </div>

                  <div>
                    <label style={labelStyle}>Tipo *</label>
                    <select value={formTipo} onChange={(e) => setFormTipo(e.target.value)} style={selectStyle}>
                      <option value="tarjeta_credito">Tarjeta de crédito</option>
                      <option value="cuenta_corriente">Cuenta corriente</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Banco</label>
                    <input value={formBanco} onChange={(e) => setFormBanco(e.target.value)} placeholder="Ej: Santander" style={s("banco")} onFocus={() => setFocused("banco")} onBlur={() => setFocused(null)} />
                  </div>

                  <div>
                    <label style={labelStyle}>Últimos 4 dígitos</label>
                    <input
                      value={formDigitos}
                      onChange={(e) => setFormDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="1234"
                      maxLength={4}
                      style={{ ...s("digitos"), fontFamily: "var(--font-mono)" }}
                      onFocus={() => setFocused("digitos")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formEsCompartido}
                      onChange={(e) => setFormEsCompartido(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
                    />
                    <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", color: "var(--text-primary)" }}>
                      Es compartido
                    </span>
                  </label>

                  {!formEsCompartido && members.length > 0 && (
                    <div>
                      <label style={labelStyle}>Dueño</label>
                      <select value={formOwner} onChange={(e) => setFormOwner(e.target.value)} style={selectStyle}>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>{m.nombre_display}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formError && (
                    <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-alert)", margin: 0 }}>
                      {formError}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <button
                      type="submit"
                      disabled={formLoading}
                      style={{ flex: 1, padding: "11px 20px", background: "var(--accent)", color: "var(--text-on-accent)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-text)", fontSize: 17, fontWeight: "var(--w-semibold)", cursor: formLoading ? "not-allowed" : "pointer", opacity: formLoading ? 0.5 : 1 }}
                    >
                      {formLoading ? "Agregando…" : "Agregar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setFormError(""); setFormAlias(""); setFormBanco(""); setFormDigitos(""); setFormEsCompartido(true); }}
                      style={{ padding: "11px 20px", background: "var(--fill-3)", color: "var(--text-primary)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-text)", fontSize: 17, fontWeight: "var(--w-medium)", cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---- NO HOUSEHOLD: create or join ---- */
  return (
    <div>
      <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", color: "var(--text-tertiary)", marginBottom: "var(--space-5)" }}>
        Configura tu hogar para comenzar a registrar gastos compartidos.
      </p>

      {/* Tab switcher */}
      <div
        style={{
          display: "flex",
          background: "var(--fill-3)",
          borderRadius: "var(--radius-md)",
          padding: 3,
          marginBottom: "var(--space-5)",
        }}
      >
        {(["crear", "unirse"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); }}
            style={{
              flex: 1,
              padding: "7px 0",
              background: tab === t ? "var(--surface-card)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-tertiary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-text)",
              fontSize: 15,
              fontWeight: tab === t ? "var(--w-semibold)" : "var(--w-medium)",
              cursor: "pointer",
              boxShadow: tab === t ? "var(--shadow-1)" : "none",
              transition: "all var(--dur-fast) var(--ease-standard)",
            }}
          >
            {t === "crear" ? "Crear hogar" : "Unirse con código"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {tab === "crear" ? (
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <label style={labelStyle}>Nombre del hogar</label>
              <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nuestro Depto" style={s("nombre")} onFocus={() => setFocused("nombre")} onBlur={() => setFocused(null)} />
            </div>
            <div>
              <label style={labelStyle}>Tu nombre (opcional)</label>
              <input value={nombreA} onChange={(e) => setNombreA(e.target.value)} placeholder="Tomás" style={s("nombreA")} onFocus={() => setFocused("nombreA")} onBlur={() => setFocused(null)} />
            </div>
            <div>
              <label style={labelStyle}>Tu porcentaje de gastos</label>
              <div style={{ position: "relative" }}>
                <input
                  required
                  type="number"
                  step="1"
                  min="1"
                  max="99"
                  value={ratioA}
                  onChange={(e) => setRatioA(e.target.value)}
                  style={{ ...s("ratio"), paddingRight: 36 }}
                  onFocus={() => setFocused("ratio")}
                  onBlur={() => setFocused(null)}
                />
                <span style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 17,
                  color: "#8E8E93",
                  pointerEvents: "none",
                  userSelect: "none",
                }}>%</span>
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--text-muted)", margin: "6px 0 0", paddingLeft: 4 }}>
                El resto lo paga tu pareja automáticamente
              </p>
            </div>
            {error && <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-alert)", margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "13px 20px", background: "var(--accent)", color: "var(--text-on-accent)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-text)", fontSize: 17, fontWeight: "var(--w-semibold)", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: "-0.01em", marginTop: "var(--space-2)" }}>
              {loading ? "Creando…" : "Crear hogar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <label style={labelStyle}>Código de invitación</label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="X7K2QP"
                maxLength={6}
                style={{ ...s("code"), fontFamily: "var(--font-mono)", letterSpacing: "0.2em", textTransform: "uppercase" as const, fontSize: 24, textAlign: "center" as const }}
                onFocus={() => setFocused("code")}
                onBlur={() => setFocused(null)}
              />
            </div>
            {error && <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-alert)", margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "13px 20px", background: "var(--accent)", color: "var(--text-on-accent)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-text)", fontSize: 17, fontWeight: "var(--w-semibold)", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, letterSpacing: "-0.01em", marginTop: "var(--space-2)" }}>
              {loading ? "Uniéndose…" : "Unirse al hogar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
