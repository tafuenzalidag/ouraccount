"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { TokenResponse } from "@/types/api";

const baseInput: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "11px 14px",
  background: "var(--surface-card)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "inset 0 0 0 1px var(--separator)",
  border: "none",
  fontFamily: "var(--font-text)",
  fontSize: 17,
  color: "var(--text-primary)",
  transition: "box-shadow var(--dur-base) var(--ease-standard)",
};

const focusInput: React.CSSProperties = {
  ...baseInput,
  boxShadow: "inset 0 0 0 1.5px var(--accent)",
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const data = await apiFetch<TokenResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setToken(data.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      <Field label="Email">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          style={focused === "email" ? focusInput : baseInput}
          onFocus={() => setFocused("email")}
          onBlur={() => setFocused(null)}
        />
      </Field>

      <Field label="Contraseña">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={focused === "password" ? focusInput : baseInput}
          onFocus={() => setFocused("password")}
          onBlur={() => setFocused(null)}
        />
      </Field>

      {error && (
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "var(--t-footnote-size)",
            color: "var(--state-alert)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <PrimaryButton disabled={loading} style={{ marginTop: "var(--space-2)" }}>
        {loading ? "Entrando…" : "Iniciar sesión"}
      </PrimaryButton>

      <p
        style={{
          textAlign: "center",
          fontFamily: "var(--font-text)",
          fontSize: 14,
          color: "var(--text-tertiary)",
          margin: 0,
        }}
      >
        ¿Sin cuenta?{" "}
        <Link
          href="/register"
          style={{ color: "var(--accent)", textDecoration: "none", fontWeight: "var(--w-medium)" }}
        >
          Regístrate
        </Link>
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-text)",
          fontSize: 13,
          fontWeight: "var(--w-semibold)",
          color: "var(--text-secondary)",
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        width: "100%",
        padding: "13px 20px",
        background: "var(--accent)",
        color: "var(--text-on-accent)",
        border: "none",
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-text)",
        fontSize: 17,
        fontWeight: "var(--w-semibold)",
        letterSpacing: "-0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity var(--dur-fast) var(--ease-standard)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
