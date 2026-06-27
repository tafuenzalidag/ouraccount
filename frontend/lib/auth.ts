const TOKEN_KEY = "nc_token";
const HOUSEHOLD_KEY = "nc_household_id";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(HOUSEHOLD_KEY);
}

export function setHouseholdId(id: string): void {
  localStorage.setItem(HOUSEHOLD_KEY, id);
}
