export default function SettlementPage() {
  return (
    <div>
      <div
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-9)",
          boxShadow: "var(--shadow-2)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-round)",
            background: "var(--fill-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto var(--space-4)",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--t-headline-size)",
            fontWeight: "var(--w-semibold)",
            color: "var(--text-primary)",
            margin: "0 0 6px",
            letterSpacing: "var(--t-headline-track)",
          }}
        >
          Análisis próximamente
        </p>
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--t-subhead-size)",
            color: "var(--text-tertiary)",
            margin: 0,
            lineHeight: "var(--t-subhead-lh)",
          }}
        >
          Tendencias mensuales y proyección de cuotas en Fase 3
        </p>
      </div>
    </div>
  );
}
