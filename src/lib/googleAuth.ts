import crypto from "node:crypto";

interface ServiceAccountCredentials {
  email: string;
  privateKey: string;
}

export class GoogleAuthConfigError extends Error {}

function getServiceAccountCredentials(): ServiceAccountCredentials {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new GoogleAuthConfigError(
      "Faltan GOOGLE_SHEETS_CLIENT_EMAIL y/o GOOGLE_SHEETS_PRIVATE_KEY en .env.local."
    );
  }
  // .env files can't hold real newlines, so the key is usually stored with literal \n escapes.
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return { email, privateKey };
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

/** Signs a Google service-account JWT and exchanges it for a short-lived OAuth2 access token. */
export async function getGoogleAccessToken(scope: string): Promise<string> {
  const { email, privateKey } = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(
    Buffer.from(JSON.stringify(claim))
  )}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google OAuth respondió ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
