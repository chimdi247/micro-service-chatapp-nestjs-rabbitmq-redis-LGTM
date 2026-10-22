// Minimal JWT payload decoder. We only ever need to read the claims
// out of our own access token (sub/email) right after login -- since
// POST /auth/login intentionally returns just { accessToken,
// refreshToken } with no user object (see services/auth-service).
// No signature verification happens client-side; the gateway/services
// are what actually verify the token on every request.

export interface AccessTokenClaims {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

const base64UrlDecode = (input: string): string => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const decoded = atob(padded + padding);
  // atob gives us a binary string; convert to UTF-8 text safely.
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
};

export const decodeAccessToken = (token: string): AccessTokenClaims | null => {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }
    const json = base64UrlDecode(payload);
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
};
