"use client";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { PaymentMethodOut, CategoryOut, TransactionOut } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="descripcion">Descripción / Comercio</Label>
        <Input id="descripcion" name="descripcion" placeholder="Ej: Jumbo" required />
      </div>
      <div>
        <Label htmlFor="monto">Monto (CLP)</Label>
        <Input id="monto" name="monto" type="number" min="1" placeholder="50000" required />
      </div>
      <div>
        <Label htmlFor="fecha">Fecha</Label>
        <Input
          id="fecha"
          name="fecha"
          type="date"
          defaultValue={new Date().toISOString().split("T")[0]}
          required
        />
      </div>
      <div>
        <Label htmlFor="payment_method_id">Medio de pago</Label>
        <select
          id="payment_method_id"
          name="payment_method_id"
          required
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          {paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.alias}
              {pm.ultimos_digitos ? ` (${pm.ultimos_digitos})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="category_id">Categoría</Label>
        <select
          id="category_id"
          name="category_id"
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Sin categoría</option>
          {parentCategories.map((parent) => {
            const children = allCategories.filter((c) => c.parent_id === parent.id);
            return children.length > 0 ? (
              <optgroup key={parent.id} label={parent.nombre}>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.nombre}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={parent.id} value={parent.id}>
                {parent.nombre}
              </option>
            );
          })}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input id="es_hogar" name="es_hogar" type="checkbox" defaultChecked className="h-4 w-4" />
        <Label htmlFor="es_hogar">Gasto del hogar (se reparte 57/43)</Label>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || paymentMethods.length === 0}>
        {loading ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}
