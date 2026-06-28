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

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  function getStyle(name: string): React.CSSProperties {
    return focused === name
      ? { ...baseInput, boxShadow: "inset 0 0 0 1.5px var(--accent)" }
      : baseInput;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const data = await apiFetch<TokenResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          username: form.get("username"),
          password: form.get("password"),
          nombre: form.get("nombre"),
        }),
      });
      setToken(data.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {(["nombre", "email", "username", "password"] as const).map((name) => (
        <div key={name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-text)",
              fontSize: 13,
              fontWeight: "var(--w-semibold)",
              color: "var(--text-secondary)",
              letterSpacing: "-0.005em",
            }}
          >
            {name === "nombre" ? "Nombre" : name === "email" ? "Email" : name === "username" ? "Usuario" : "Contraseña"}
          </span>
          <input
            name={name}
            type={name === "password" ? "password" : name === "email" ? "email" : "text"}
            required
            style={getStyle(name)}
            onFocus={() => setFocused(name)}
            onBlur={() => setFocused(null)}
          />
        </div>
      ))}

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

      <button
        type="submit"
        disabled={loading}
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
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.5 : 1,
          transition: "opacity var(--dur-fast) var(--ease-standard)",
          marginTop: "var(--space-2)",
        }}
      >
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <p
        style={{
          textAlign: "center",
          fontFamily: "var(--font-text)",
          fontSize: 14,
          color: "var(--text-tertiary)",
          margin: 0,
        }}
      >
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          style={{ color: "var(--accent)", textDecoration: "none", fontWeight: "var(--w-medium)" }}
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
