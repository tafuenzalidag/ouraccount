import { SettlementPeriodOut } from "@/types/api";

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

interface Props {
  data: SettlementPeriodOut;
  memberNames: Record<string, string>;
  onPay: (id: string) => void;
}

export function SettlementCard({ data, memberNames, onPay }: Props) {
  const { settlement } = data;
  if (!settlement || settlement.monto === 0) {
    return <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">Estás al día este mes 🎉</div>;
  }
  const deudorNombre = memberNames[settlement.deudor_user_id] ?? "Alguien";
  const acreedorNombre = memberNames[settlement.acreedor_user_id] ?? "Alguien";
  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <p className="font-semibold text-gray-800">
        {deudorNombre} le debe <span className="text-blue-600">{formatCLP(settlement.monto)}</span> a {acreedorNombre}
      </p>
      {settlement.estado === "pendiente" && (
        <button
          onClick={() => onPay(settlement.id)}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
        >
          Marcar como pagado
        </button>
      )}
      {settlement.estado === "pagado" && (
        <p className="text-green-600 text-sm">Pagado el {settlement.pagado_en}</p>
      )}
    </div>
  );
}
