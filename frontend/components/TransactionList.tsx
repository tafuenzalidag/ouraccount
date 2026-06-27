import { TransactionOut } from "@/types/api";
import { CategoryBadge } from "./CategoryBadge";

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
}

interface Props {
  transactions: TransactionOut[];
}

export function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Sin gastos registrados.</p>;
  }
  return (
    <ul className="divide-y">
      {transactions.map((tx) => (
        <li key={tx.id} className="py-3 flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-800">{tx.descripcion_norm}</p>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-400">{tx.fecha_operacion}</span>
              <CategoryBadge nombre={tx.category_id ? "Categoría" : null} />
              {tx.es_hogar && (
                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Hogar</span>
              )}
            </div>
          </div>
          <span className={`text-sm font-semibold ${tx.monto < 0 ? "text-green-600" : "text-gray-900"}`}>
            {formatCLP(tx.monto)}
          </span>
        </li>
      ))}
    </ul>
  );
}
