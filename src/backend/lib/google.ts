import { createRemoteJWKSet, jwtVerify } from "jose";

/** Google sign-in is optional: it is on only when both variables are set. */
export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const GOOGLE_STATE_COOKIE = "google_oauth_state";

export function googleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Exchanges the code for tokens and returns the verified, lower-cased email, or null. */
export async function googleEmailFromCode(code: string, redirectUri: string, cfg: { clientId: string; clientSecret: string }): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) return null;
  try {
    const { payload } = await jwtVerify(tokens.id_token, jwks, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: cfg.clientId });
    if (payload.email_verified !== true || typeof payload.email !== "string") return null;
    return payload.email.toLowerCase();
  } catch {
    return null;
  }
}
