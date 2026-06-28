"use client";
import { useState, useEffect, useRef } from "react";
import { Upload, AlertTriangle } from "lucide-react";
import { getHouseholdId, getToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type InstallmentPreview = {
  descripcion: string;
  monto_total: number;
  cuota_actual: number;
  cuotas_totales: number;
  valor_cuota_mensual: number;
};

type PreviewItem = {
  fecha_operacion: string;
  descripcion_raw: string;
  descripcion_norm: string;
  lugar: string | null;
  monto: number;
  tipo_movimiento: string;
  es_interno: boolean;
  es_hogar: boolean;
  incluido: boolean;
  category_id: string | null;
  installment: InstallmentPreview | null;
  hash_dedupe: string;
  es_duplicado_posible: boolean;
};

type PreviewResponse = {
  batch_id: string;
  cuadre_ok: boolean;
  advertencia: string | null;
  items: PreviewItem[];
};

type PaymentMethod = { id: string; alias: string; tipo: string };
type Member = { user_id: string; nombre_display: string };

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL")}${n < 0 ? " abono" : ""}`;
}

const selectStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 40px 11px 14px",
  background: "var(--bg-grouped)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "inset 0 0 0 1px var(--separator)",
  border: "none",
  fontFamily: "var(--font-text)",
  fontSize: 17,
  color: "var(--text-primary)",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
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

export default function ImportsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPm, setSelectedPm] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payerUserId, setPayerUserId] = useState("");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hid = getHouseholdId();
    setHouseholdId(hid);
    if (!hid) return;
    const token = getToken();
    fetch(`${API}/api/households/${hid}/payment-methods`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: PaymentMethod[]) => {
        setPaymentMethods(data);
        if (data.length > 0) setSelectedPm(data[0].id);
      })
      .catch(() => setError("Error cargando medios de pago"));
    fetch(`${API}/api/households/${hid}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: Member[]) => {
        setMembers(data);
        if (data.length > 0) setPayerUserId(data[0].user_id);
      })
      .catch(() => {});
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const file = fileRef.current?.files?.[0];
    if (!file || !householdId || !selectedPm) {
      setError("Selecciona un archivo PDF y un medio de pago");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("payment_method_id", selectedPm);
      const token = getToken();
      const resp = await fetch(`${API}/api/households/${householdId}/imports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail ?? "Error subiendo PDF");
      }
      const data: PreviewResponse = await resp.json();
      setPreview(data);
      setItems(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setUploading(false);
    }
  }

  function toggleIncluido(idx: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, incluido: !item.incluido } : item))
    );
  }

  async function handleConfirm() {
    if (!preview || !payerUserId) {
      setError("Debes seleccionar quién pagó la tarjeta");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const token = getToken();
      const resp = await fetch(`${API}/api/imports/${preview.batch_id}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ payer_user_id: payerUserId, items }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail ?? "Error confirmando");
      }
      const result = await resp.json();
      setSuccess(
        `${result.transactions_created} transacciones creadas, ${result.duplicates_skipped} duplicados omitidos, ${result.excluded_skipped} excluidos.`
      );
      setPreview(null);
      setItems([]);
      setPayerUserId("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

      {/* Success banner */}
      {success && (
        <div
          style={{
            background: "var(--state-safe-fill)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4) var(--card-padding)",
          }}
        >
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", color: "var(--state-safe)", fontWeight: "var(--w-semibold)", margin: 0 }}>
            Importación exitosa
          </p>
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {success}
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "var(--state-alert-fill)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4) var(--card-padding)",
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={16} color="var(--state-alert)" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-alert)", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Upload form */}
      {!preview && (
        <div
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--card-padding)",
            boxShadow: "var(--shadow-2)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          <div>
            <label htmlFor="pm-select" style={labelStyle}>Medio de pago</label>
            <select
              id="pm-select"
              value={selectedPm}
              onChange={(e) => setSelectedPm(e.target.value)}
              style={selectStyle}
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.alias} ({pm.tipo === "tarjeta_credito" ? "TC" : "CC"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pdf-file" style={labelStyle}>Cartola PDF (Santander)</label>
            <div
              style={{
                border: "1.5px dashed var(--separator-opaque)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-7)",
                textAlign: "center",
                background: "var(--fill-4)",
              }}
            >
              <Upload size={24} color="var(--text-tertiary)" style={{ margin: "0 auto var(--space-3)" }} />
              <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", color: "var(--text-secondary)", margin: "0 0 var(--space-2)" }}>
                Selecciona un archivo
              </p>
              <input
                ref={fileRef}
                id="pdf-file"
                type="file"
                accept=".pdf"
                style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--text-tertiary)" }}
              />
            </div>
          </div>

          <button
            onClick={handleUpload as unknown as React.MouseEventHandler}
            disabled={uploading}
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
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.5 : 1,
            }}
          >
            {uploading ? "Procesando…" : "Subir y parsear"}
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

          {/* Cuadre warning */}
          {!preview.cuadre_ok && (
            <div
              style={{
                background: "var(--state-caution-fill)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-4) var(--card-padding)",
                display: "flex",
                gap: "var(--space-3)",
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle size={16} color="var(--state-caution)" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--state-caution)", margin: 0, fontWeight: "var(--w-medium)" }}>
                {preview.advertencia ?? "El cuadre de montos no coincide con el total declarado."}
              </p>
            </div>
          )}

          {/* Count */}
          <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-footnote-size)", color: "var(--text-tertiary)", margin: 0, paddingLeft: 4 }}>
            {items.filter((i) => i.incluido).length} de {items.length} movimientos seleccionados
          </p>

          {/* Items list */}
          <div
            style={{
              background: "var(--surface-card)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-2)",
              overflow: "hidden",
            }}
          >
            {items.map((item, idx) => (
              <div key={item.hash_dedupe}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-3)",
                    padding: "var(--space-4) var(--card-padding)",
                    opacity: item.incluido ? 1 : 0.4,
                    background: item.es_duplicado_posible ? "var(--state-caution-fill)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.incluido}
                    onChange={() => toggleIncluido(idx)}
                    style={{ width: 18, height: 18, accentColor: "var(--accent)", marginTop: 2, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", fontWeight: "var(--w-medium)", color: "var(--text-primary)", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.descripcion_norm}
                    </p>
                    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-caption-size)", color: "var(--text-tertiary)" }}>
                        {item.fecha_operacion}
                      </span>
                      {item.es_duplicado_posible && (
                        <span style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: "var(--w-semibold)", color: "var(--state-caution)" }}>
                          posible duplicado
                        </span>
                      )}
                      {item.installment && (
                        <span style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: "var(--w-semibold)", color: "var(--state-on-strong)" }}>
                          cuota {item.installment.cuota_actual}/{item.installment.cuotas_totales}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-subhead-size)", fontWeight: "var(--w-semibold)", color: item.monto < 0 ? "var(--state-safe)" : "var(--text-primary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {formatCLP(item.monto)}
                  </span>
                </label>
                {idx < items.length - 1 && (
                  <div style={{ height: "0.5px", background: "var(--separator)", marginLeft: 16 }} />
                )}
              </div>
            ))}
          </div>

          {/* Payer selection */}
          <div
            style={{
              background: "var(--surface-card)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--card-padding)",
              boxShadow: "var(--shadow-2)",
            }}
          >
            <label htmlFor="payer-id" style={{ ...labelStyle, marginBottom: "var(--space-3)" }}>
              ¿Quién pagó la tarjeta?
            </label>
            {members.length > 0 ? (
              <select
                id="payer-id"
                value={payerUserId}
                onChange={(e) => setPayerUserId(e.target.value)}
                style={selectStyle}
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.nombre_display}</option>
                ))}
              </select>
            ) : (
              <input
                id="payer-id"
                type="text"
                value={payerUserId}
                onChange={(e) => setPayerUserId(e.target.value)}
                placeholder="UUID del pagador"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "11px 14px",
                  background: "var(--bg-grouped)",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "inset 0 0 0 1px var(--separator)",
                  border: "none",
                  fontFamily: "var(--font-mono)",
                  fontSize: 15,
                  color: "var(--text-primary)",
                }}
              />
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                flex: 1,
                padding: "13px 20px",
                background: "var(--accent)",
                color: "var(--text-on-accent)",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-text)",
                fontSize: 17,
                fontWeight: "var(--w-semibold)",
                cursor: confirming ? "not-allowed" : "pointer",
                opacity: confirming ? 0.5 : 1,
              }}
            >
              {confirming ? "Confirmando…" : "Confirmar"}
            </button>
            <button
              onClick={() => { setPreview(null); setItems([]); setError(null); setPayerUserId(""); }}
              style={{
                padding: "13px 20px",
                background: "var(--fill-3)",
                color: "var(--text-primary)",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-text)",
                fontSize: 17,
                fontWeight: "var(--w-medium)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
