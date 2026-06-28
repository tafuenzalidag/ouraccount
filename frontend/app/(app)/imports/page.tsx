"use client";
import { useState, useEffect, useRef } from "react";
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

type PaymentMethod = {
  id: string;
  alias: string;
  tipo: string;
};

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL")}${n < 0 ? " (abono)" : ""}`;
}

export default function ImportsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPm, setSelectedPm] = useState("");
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
      prev.map((item, i) =>
        i === idx ? { ...item, incluido: !item.incluido } : item
      )
    );
  }

  async function handleConfirm() {
    if (!preview || !payerUserId) {
      setError("Debes ingresar el ID del pagador (usuario que pagó la tarjeta)");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const token = getToken();
      const resp = await fetch(`${API}/api/imports/${preview.batch_id}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payer_user_id: payerUserId, items }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail ?? "Error confirmando");
      }
      const result = await resp.json();
      setSuccess(
        `Importación exitosa: ${result.transactions_created} transacciones creadas, ` +
          `${result.duplicates_skipped} duplicados omitidos, ` +
          `${result.excluded_skipped} excluidos.`
      );
      setPreview(null);
      setItems([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Importar cartola PDF</h1>

      {!preview && (
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Medio de pago</label>
            <select
              value={selectedPm}
              onChange={(e) => setSelectedPm(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.alias} ({pm.tipo})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Archivo PDF (cartola Santander)</label>
            <input ref={fileRef} type="file" accept=".pdf" className="block" />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {uploading ? "Procesando..." : "Subir y parsear"}
          </button>
        </form>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}

      {preview && (
        <div className="space-y-4">
          {!preview.cuadre_ok && preview.advertencia && (
            <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
              ⚠️ {preview.advertencia}
            </div>
          )}

          <p className="text-sm text-gray-500">
            {items.filter((i) => i.incluido).length} de {items.length} movimientos seleccionados.
            Desmarca los que no quieres importar.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">✓</th>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Descripción</th>
                  <th className="p-2">Monto</th>
                  <th className="p-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`border-t ${!item.incluido ? "opacity-40" : ""} ${item.es_duplicado_posible ? "bg-yellow-50" : ""}`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={item.incluido}
                        onChange={() => toggleIncluido(idx)}
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">{item.fecha_operacion}</td>
                    <td className="p-2">
                      <div>{item.descripcion_norm}</div>
                      {item.es_duplicado_posible && (
                        <span className="text-xs text-yellow-700">posible duplicado</span>
                      )}
                      {item.installment && (
                        <span className="text-xs text-blue-600">
                          cuota {item.installment.cuota_actual}/{item.installment.cuotas_totales}
                        </span>
                      )}
                    </td>
                    <td className={`p-2 whitespace-nowrap ${item.monto < 0 ? "text-green-600" : ""}`}>
                      {formatCLP(item.monto)}
                    </td>
                    <td className="p-2 text-xs text-gray-500">{item.tipo_movimiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ID del usuario que pagó la tarjeta
              <span className="text-gray-400 font-normal ml-1">(pega el user ID desde la URL o settings)</span>
            </label>
            <input
              type="text"
              value={payerUserId}
              onChange={(e) => setPayerUserId(e.target.value)}
              placeholder="uuid del pagador"
              className="border rounded px-3 py-2 w-full font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {confirming ? "Confirmando..." : "Confirmar importación"}
            </button>
            <button
              onClick={() => { setPreview(null); setItems([]); setError(null); }}
              className="border px-4 py-2 rounded text-gray-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
