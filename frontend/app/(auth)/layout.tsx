export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-grouped)",
        padding: "var(--gutter)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          background: "var(--surface-card)",
          borderRadius: "var(--radius-2xl)",
          boxShadow: "var(--shadow-3)",
          padding: "var(--space-8)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "var(--space-7)" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--t-title2-size)",
              fontWeight: "var(--w-bold)",
              color: "var(--text-primary)",
              letterSpacing: "var(--t-title2-track)",
              margin: 0,
            }}
          >
            NuestraCuenta
          </h1>
          <p
            style={{
              fontFamily: "var(--font-text)",
              fontSize: "var(--t-footnote-size)",
              color: "var(--text-tertiary)",
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            Gastos compartidos del hogar
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
