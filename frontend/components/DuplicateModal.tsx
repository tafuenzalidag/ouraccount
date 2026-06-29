// frontend/components/DuplicateModal.tsx
"use client";

type TxSnippet = {
  external_id: string;
  fecha_operacion: string;
  descripcion_raw: string;
  monto: number;
  origen: "manual" | "importado";
  payment_method_alias: string;
};

type FuzzyPair = {
  importItem: { fecha_operacion: string; descripcion_raw: string; monto: number };
  matches: TxSnippet[];
};

type Props = {
  pairs: FuzzyPair[];
  onClose: () => void;
};

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString("es-CL")}`;
}

export function DuplicateModal({ pairs, onClose }: Props) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "oklch(0.145 0 0 / 0.40)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0 0 env(safe-area-inset-bottom)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
          width: "100%", maxWidth: "var(--app-max-width)",
          maxHeight: "80dvh", overflowY: "auto",
          padding: "var(--space-6) var(--space-4) var(--space-8)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: "var(--radius-pill)",
          background: "var(--border)", margin: "0 auto var(--space-5)",
        }} />

        <h2 style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-xl)",
          fontWeight: "var(--weight-semibold)", color: "var(--text-strong)",
          marginBottom: "var(--space-2)",
        }}>
          Posibles duplicados encontrados
        </h2>
        <p style={{
          fontSize: "var(--text-sm)", color: "var(--text-secondary)",
          marginBottom: "var(--space-6)", lineHeight: "var(--leading-normal)",
        }}>
          Estas transacciones de la cartola podrían coincidir con gastos ya registrados.
          Revísalos antes de confirmar.
        </p>

        {pairs.map((pair, i) => (
          <div key={i} style={{
            marginBottom: "var(--space-5)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--ring-card)",
            overflow: "hidden",
          }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              background: "var(--surface-muted)",
              padding: "var(--space-2) var(--space-3)",
              gap: "var(--space-4)",
            }}>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Ya registrado</span>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>En la cartola</span>
            </div>

            {pair.matches.map((match, j) => (
              <div key={j} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                padding: "var(--space-3)",
                gap: "var(--space-4)",
                borderTop: j > 0 ? "1px solid var(--border)" : undefined,
              }}>
                {/* Existing tx */}
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-body)" }}>{match.descripcion_raw}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{match.fecha_operacion}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-strong)", marginTop: 4 }}>{formatCLP(match.monto)}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{match.payment_method_alias}</div>
                </div>
                {/* Import item */}
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-body)" }}>{pair.importItem.descripcion_raw}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{pair.importItem.fecha_operacion}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-strong)", marginTop: 4 }}>{formatCLP(pair.importItem.monto)}</div>
                </div>
              </div>
            ))}
          </div>
        ))}

        <button
          onClick={onClose}
          style={{
            width: "100%", height: 48,
            background: "var(--accent)", color: "var(--text-on-accent)",
            border: "none", borderRadius: "var(--radius-lg)",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-base)",
            fontWeight: "var(--weight-semibold)", cursor: "pointer",
            marginTop: "var(--space-4)",
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
