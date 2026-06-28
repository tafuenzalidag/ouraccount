"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { PaymentMethodOut, CategoryOut, TransactionOut } from "@/types/api";

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

const focusInput: React.CSSProperties = {
  ...baseInput,
  boxShadow: "inset 0 0 0 1.5px var(--accent)",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-text)",
  fontSize: 13,
  fontWeight: "var(--w-semibold)",
  color: "var(--text-secondary)",
  letterSpacing: "-0.005em",
  marginBottom: 6,
  display: "block",
};

interface Props {
  householdId: string;
  onCreated: (tx: TransactionOut) => void;
}

export function TransactionForm({ householdId, onCreated }: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOut[]>([]);
  const [parentCategories, setParentCategories] = useState<CategoryOut[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<PaymentMethodOut[]>(`/api/households/${householdId}/payment-methods`),
      apiFetch<CategoryOut[]>(`/api/households/${householdId}/categories`),
    ]).then(([pms, cats]) => {
      setPaymentMethods(pms);
      setParentCategories(cats.filter((c) => c.parent_id === null));
      setAllCategories(cats);
    });
  }, [householdId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const tx = await apiFetch<TransactionOut>(`/api/households/${householdId}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          fecha_operacion: form.get("fecha"),
          descripcion_raw: form.get("descripcion"),
          monto: parseInt(form.get("monto") as string, 10),
          payment_method_id: form.get("payment_method_id"),
          category_id: form.get("category_id") || null,
          es_hogar: form.get("es_hogar") === "on",
        }),
      });
      onCreated(tx);
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  function s(name: string): React.CSSProperties {
    return focused === name ? focusInput : baseInput;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* Description */}
      <div>
        <label style={labelStyle}>Descripción / Comercio</label>
        <input
          name="descripcion"
          placeholder="Ej: Jumbo"
          required
          style={s("descripcion")}
          onFocus={() => setFocused("descripcion")}
          onBlur={() => setFocused(null)}
        />
      </div>

      {/* Amount */}
      <div>
        <label style={labelStyle}>Monto (CLP)</label>
        <input
          name="monto"
          type="number"
          min="1"
          placeholder="50000"
          required
          style={s("monto")}
          onFocus={() => setFocused("monto")}
          onBlur={() => setFocused(null)}
        />
      </div>

      {/* Date */}
      <div>
        <label style={labelStyle}>Fecha</label>
        <input
          name="fecha"
          type="date"
          defaultValue={new Date().toISOString().split("T")[0]}
          required
          style={s("fecha")}
          onFocus={() => setFocused("fecha")}
          onBlur={() => setFocused(null)}
        />
      </div>

      {/* Payment method */}
      <div>
        <label style={labelStyle}>Medio de pago</label>
        <select
          name="payment_method_id"
          required
          style={{
            ...baseInput,
            appearance: "none" as const,
            WebkitAppearance: "none" as const,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 14px center",
            paddingRight: 40,
          }}
        >
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.alias}{pm.ultimos_digitos ? ` ••${pm.ultimos_digitos}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label style={labelStyle}>Categoría</label>
        <select
          name="category_id"
          style={{
            ...baseInput,
            appearance: "none" as const,
            WebkitAppearance: "none" as const,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 14px center",
            paddingRight: 40,
          }}
        >
          <option value="">Sin categoría</option>
          {parentCategories.map((parent) => {
            const children = allCategories.filter((c) => c.parent_id === parent.id);
            return children.length > 0 ? (
              <optgroup key={parent.id} label={parent.nombre}>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.nombre}</option>
                ))}
              </optgroup>
            ) : (
              <option key={parent.id} value={parent.id}>{parent.nombre}</option>
            );
          })}
        </select>
      </div>

      {/* Es hogar */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          cursor: "pointer",
          padding: "var(--space-4) var(--card-padding)",
          background: "var(--surface-card)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <input
          id="es_hogar"
          name="es_hogar"
          type="checkbox"
          defaultChecked
          style={{ width: 18, height: 18, accentColor: "var(--accent)", flexShrink: 0 }}
        />
        <div>
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", fontWeight: "var(--w-medium)", color: "var(--text-primary)", margin: 0 }}>
            Gasto del hogar
          </p>
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-caption-size)", color: "var(--text-tertiary)", margin: "2px 0 0" }}>
            Se reparte según el ratio del hogar (57/43)
          </p>
        </div>
      </label>

      {error && (
        <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-alert)", margin: 0 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || paymentMethods.length === 0}
        style={{
          width: "100%",
          padding: "13px 20px",
          background: "var(--accent)",
          color: "var(--text-on-accent)",
          border: "none",
          borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-text)",
          fontSize: 17,
          fontWeight: "var(--w-semibold)",
          letterSpacing: "-0.01em",
          cursor: (loading || paymentMethods.length === 0) ? "not-allowed" : "pointer",
          opacity: (loading || paymentMethods.length === 0) ? 0.5 : 1,
          transition: "opacity var(--dur-fast) var(--ease-standard)",
        }}
      >
        {loading ? "Guardando…" : "Guardar gasto"}
      </button>
    </form>
  );
}
