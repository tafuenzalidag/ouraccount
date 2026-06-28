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
    return (
      <div
        style={{
          background: "var(--state-safe-fill)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--card-padding)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-round)",
            background: "var(--state-safe-fill)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--state-safe)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p
            style={{
              fontFamily: "var(--font-text)",
              fontSize: "var(--t-headline-size)",
              fontWeight: "var(--w-semibold)",
              color: "var(--state-safe)",
              margin: 0,
              letterSpacing: "var(--t-headline-track)",
            }}
          >
            Al día este mes
          </p>
          <p
            style={{
              fontFamily: "var(--font-text)",
              fontSize: "var(--t-footnote-size)",
              color: "var(--text-tertiary)",
              margin: "2px 0 0",
            }}
          >
            No hay deudas pendientes
          </p>
        </div>
      </div>
    );
  }

  const deudorNombre = memberNames[settlement.deudor_user_id] ?? "Alguien";
  const acreedorNombre = memberNames[settlement.acreedor_user_id] ?? "Alguien";
  const isPaid = settlement.estado === "pagado";

  return (
    <div
      style={{
        background: isPaid ? "var(--state-safe-fill)" : "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--card-padding)",
        boxShadow: isPaid ? "none" : "var(--shadow-2)",
      }}
    >
      {/* Amount */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--t-caption-size)",
            color: "var(--text-tertiary)",
            margin: "0 0 4px",
            letterSpacing: "0.005em",
            textTransform: "uppercase" as const,
          }}
        >
          Liquidación del mes
        </p>
        <p
          style={{
            fontFamily: "var(--font-rounded)",
            fontSize: "var(--t-value-small-size)",
            fontWeight: "var(--t-value-weight)",
            letterSpacing: "var(--t-value-track)",
            fontVariantNumeric: "tabular-nums" as const,
            color: isPaid ? "var(--state-safe)" : "var(--state-alert)",
            margin: 0,
          }}
        >
          {formatCLP(settlement.monto)}
        </p>
      </div>

      {/* Who owes whom */}
      <p
        style={{
          fontFamily: "var(--font-text)",
          fontSize: "var(--t-subhead-size)",
          color: "var(--text-secondary)",
          margin: "0 0 var(--space-4)",
          lineHeight: "var(--t-subhead-lh)",
        }}
      >
        <strong style={{ color: "var(--text-primary)", fontWeight: "var(--w-semibold)" }}>
          {deudorNombre}
        </strong>{" "}
        le debe a{" "}
        <strong style={{ color: "var(--text-primary)", fontWeight: "var(--w-semibold)" }}>
          {acreedorNombre}
        </strong>
      </p>

      {/* Action */}
      {isPaid ? (
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--t-footnote-size)",
            color: "var(--state-safe)",
            fontWeight: "var(--w-semibold)",
            margin: 0,
          }}
        >
          Pagado el {settlement.pagado_en}
        </p>
      ) : (
        <button
          onClick={() => onPay(settlement.id)}
          style={{
            width: "100%",
            padding: "11px 20px",
            background: "var(--accent)",
            color: "var(--text-on-accent)",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-text)",
            fontSize: 15,
            fontWeight: "var(--w-semibold)",
            cursor: "pointer",
            letterSpacing: "-0.01em",
            transition: "transform var(--dur-fast) var(--ease-standard)",
          }}
          onPointerDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)"; }}
          onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
        >
          Marcar como pagado
        </button>
      )}
    </div>
  );
}
