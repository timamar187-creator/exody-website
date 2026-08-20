import { tursoExecute } from "./_turso.js";

/**
 * Exody sign-in, step 2 of 2: Google redirects here with a code; we exchange
 * it server-side (the client secret lives only in Vercel env), read the
 * verified identity from the id_token, upsert the user into the exody-users
 * database, and bounce the browser to the app's loopback listener.
 *
 * The id_token arrives directly from Google over TLS in the token exchange,
 * so its payload is trusted without a JWKS round-trip — we still check
 * aud/iss/exp because they're free.
 *
 * Registry failures do NOT brick sign-in: the user still lands back in the
 * app (with a warn flag) — the app must never refuse to start because OUR
 * bookkeeping hiccupped.
 */
function b64urlJson(part) {
  const pad = part.length % 4 === 0 ? "" : "=".repeat(4 - (part.length % 4));
  return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8"));
}

export default async function handler(req, res) {
  const code = String(req.query?.code || "");
  const state = String(req.query?.state || "");
  const m = state.match(/^([A-Za-z0-9_-]{8,64})\.(\d{2,5})$/);
  if (!code || !m) {
    res.status(400).send("bad request");
    return;
  }
  const [, nonce, port] = m;
  const cid = process.env.EXODY_GOOGLE_CLIENT_ID || "";
  const secret = process.env.EXODY_GOOGLE_CLIENT_SECRET || "";
  if (!cid || !secret) {
    res.status(500).send("sign-in is not configured yet");
    return;
  }

  let claims;
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cid,
        client_secret: secret,
        redirect_uri: "https://exody.ai/api/auth/callback",
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tr.ok) throw new Error("token exchange " + tr.status);
    const tok = await tr.json();
    claims = b64urlJson(String(tok.id_token || "").split(".")[1] || "");
  } catch (e) {
    console.error("[auth/callback] exchange failed:", e?.message);
    res.status(502).send("Google sign-in failed — close this tab and try again from Exody.");
    return;
  }
  const okAud = claims.aud === cid;
  const okIss = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const okExp = Number(claims.exp || 0) * 1000 > Date.now() - 60000;
  if (!okAud || !okIss || !okExp || !claims.sub || !claims.email) {
    res.status(401).send("Google sign-in could not be verified.");
    return;
  }

  const profile = {
    sub: String(claims.sub),
    email: String(claims.email),
    name: String(claims.name || ""),
    picture: String(claims.picture || ""),
  };

  let warn = "";
  try {
    const now = new Date().toISOString();
    await tursoExecute([
      {
        sql:
          "INSERT INTO users (sub, email, name, picture, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, last_seen_at = excluded.last_seen_at",
        args: [profile.sub, profile.email, profile.name, profile.picture, now, now],
      },
    ]);
  } catch (e) {
    console.error("[auth/callback] registry write failed:", e?.message);
    warn = "&warn=db";
  }

  const payload = Buffer.from(JSON.stringify(profile), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  res.writeHead(302, {
    Location: `http://127.0.0.1:${port}/done?state=${nonce}&profile=${payload}${warn}`,
  });
  res.end();
}
