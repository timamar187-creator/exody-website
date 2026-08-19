import { tursoExecute } from "./_turso.js";

/**
 * Launch heartbeat: the beta app reports "this signed-in user opened the app"
 * so the owner sees real USAGE, not just downloads. Fire-and-forget on the
 * app side; UPDATE-only here so a heartbeat can never mint a user row —
 * accounts are created exclusively by the verified callback.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const body = typeof req.body === "object" && req.body ? req.body : {};
  const sub = String(body.sub || "");
  const version = String(body.appVersion || "").slice(0, 32);
  const platform = String(body.platform || "").slice(0, 32);
  if (!/^\d{5,32}$/.test(sub)) {
    res.status(400).json({ ok: false });
    return;
  }
  try {
    await tursoExecute([
      {
        sql: "UPDATE beta_users SET last_seen_at = ?, launches = launches + 1, app_version = ?, platform = ? WHERE sub = ?",
        args: [new Date().toISOString(), version, platform, sub],
      },
    ]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[beta/ping] failed:", e?.message);
    res.status(200).json({ ok: false });
  }
}
