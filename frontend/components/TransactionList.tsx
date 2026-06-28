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
    return (
      <div
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-9)",
          textAlign: "center",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--t-subhead-size)",
            color: "var(--text-tertiary)",
            margin: 0,
          }}
        >
          Sin gastos registrados
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-2)",
        overflow: "hidden",
      }}
    >
      {transactions.map((tx, i) => (
        <div key={tx.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              padding: "var(--space-4) var(--card-padding)",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "var(--t-subhead-size)",
                  fontWeight: "var(--w-medium)",
                  color: "var(--text-primary)",
                  margin: "0 0 3px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {tx.descripcion_norm}
              </p>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontFamily: "var(--font-text)",
                    fontSize: "var(--t-caption-size)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {tx.fecha_operacion}
                </span>
                {tx.category_id && <CategoryBadge nombre="Categoría" />}
                {tx.es_hogar && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--accent-tint)",
                      color: "var(--accent)",
                      fontFamily: "var(--font-text)",
                      fontSize: 11,
                      fontWeight: "var(--w-semibold)",
                    }}
                  >
                    Hogar
                  </span>
                )}
              </div>
            </div>
            <span
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "var(--t-subhead-size)",
                fontWeight: "var(--w-semibold)",
                color: tx.monto < 0 ? "var(--state-safe)" : "var(--text-primary)",
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCLP(tx.monto)}
            </span>
          </div>
          {i < transactions.length - 1 && (
            <div style={{ height: "0.5px", background: "var(--separator)", marginLeft: 16 }} />
          )}
        </div>
      ))}
    </div>
  );
}
