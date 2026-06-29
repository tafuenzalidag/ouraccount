"use client";
import { useState, useEffect, useRef } from "react";
import { Upload, AlertTriangle } from "lucide-react";
import { getHouseholdId, getToken } from "@/lib/auth";
import { DuplicateModal } from "@/components/DuplicateModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type TxSnippet = {
  external_id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  monto: number;
  origen: "manual" | "importado";
  payment_method_alias: string;
};

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
  fuzzy_matches: TxSnippet[];
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
  background: "var(--surface-muted)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "inset 0 0 0 1px var(--border)",
  border: "none",
  fontFamily: "var(--font-sans)",
  fontSize: 17,
  color: "var(--text-body)",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: "var(--weight-semibold)",
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
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [fuzzyPairs, setFuzzyPairs] = useState<{ importItem: PreviewItem; matches: TxSnippet[] }[]>([]);
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
      const pairs = data.items
        .map((item: PreviewItem) => ({ importItem: item, matches: item.fuzzy_matches }))
        .filter((p) => p.matches.length > 0);
      setFuzzyPairs(pairs);
      if (pairs.length > 0) setShowDuplicateModal(true);
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
            background: "var(--positive-soft)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4) var(--space-4)",
          }}
        >
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--positive)", fontWeight: "var(--weight-semibold)", margin: 0 }}>
            Importación exitosa
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {success}
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "var(--negative-soft)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-4) var(--space-4)",
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={16} color="var(--negative)" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--negative)", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Upload form */}
      {!preview && (
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-4)",
            boxShadow: "var(--shadow-sm)",
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
                border: "1.5px dashed var(--border-strong)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-7)",
                textAlign: "center",
                background: "var(--background)",
              }}
            >
              <Upload size={24} color="var(--text-muted)" style={{ margin: "0 auto var(--space-3)" }} />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: "0 0 var(--space-2)" }}>
                Selecciona un archivo
              </p>
              <input
                ref={fileRef}
                id="pdf-file"
                type="file"
                accept=".pdf"
                style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}
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
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              fontWeight: "var(--weight-semibold)",
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
                padding: "var(--space-4) var(--space-4)",
                display: "flex",
                gap: "var(--space-3)",
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle size={16} color="var(--state-caution)" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--state-caution)", margin: 0, fontWeight: "var(--weight-medium)" }}>
                {preview.advertencia ?? "El cuadre de montos no coincide con el total declarado."}
              </p>
            </div>
          )}

          {/* Count */}
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: 0, paddingLeft: 4 }}>
            {items.filter((i) => i.incluido).length} de {items.length} movimientos seleccionados
          </p>

          {/* Items list */}
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-sm)",
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
                    padding: "var(--space-4) var(--space-4)",
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
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", fontWeight: "var(--weight-medium)", color: "var(--text-body)", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.descripcion_norm}
                    </p>
                    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        {item.fecha_operacion}
                      </span>
                      {item.es_duplicado_posible && (
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: "var(--weight-semibold)", color: "var(--state-caution)" }}>
                          posible duplicado
                        </span>
                      )}
                      {item.fuzzy_matches.length > 0 && (
                        <span style={{
                          fontSize: "var(--text-xs)", padding: "2px 6px",
                          background: "var(--accent-soft)", color: "var(--accent)",
                          borderRadius: "var(--radius-pill)", marginLeft: 6,
                        }}>
                          ⚠ posible duplicado
                        </span>
                      )}
                      {item.installment && (
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: "var(--weight-semibold)", color: "var(--text-on-accent)" }}>
                          cuota {item.installment.cuota_actual}/{item.installment.cuotas_totales}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", fontWeight: "var(--weight-semibold)", color: item.monto < 0 ? "var(--positive)" : "var(--text-body)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {formatCLP(item.monto)}
                  </span>
                </label>
                {idx < items.length - 1 && (
                  <div style={{ height: "0.5px", background: "var(--border)", marginLeft: 16 }} />
                )}
              </div>
            ))}
          </div>

          {/* Payer selection */}
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-4)",
              boxShadow: "var(--shadow-sm)",
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
                  background: "var(--surface-muted)",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "inset 0 0 0 1px var(--border)",
                  border: "none",
                  fontFamily: "var(--font-mono)",
                  fontSize: 15,
                  color: "var(--text-body)",
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
                fontFamily: "var(--font-sans)",
                fontSize: 17,
                fontWeight: "var(--weight-semibold)",
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
                background: "var(--surface-muted)",
                color: "var(--text-body)",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-sans)",
                fontSize: 17,
                fontWeight: "var(--weight-medium)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showDuplicateModal && fuzzyPairs.length > 0 && (
        <DuplicateModal
          pairs={fuzzyPairs}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}
    </div>
  );
}
