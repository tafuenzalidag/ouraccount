interface Props {
  nombre: string | null;
}

export function CategoryBadge({ nombre }: Props) {
  if (!nombre) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--radius-pill)",
        background: "var(--fill-3)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-text)",
        fontSize: 11,
        fontWeight: "var(--w-semibold)",
        letterSpacing: "0.005em",
        lineHeight: 1.4,
      }}
    >
      {nombre}
    </span>
  );
}
