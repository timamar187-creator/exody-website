/**
 * Minimal Turso HTTP-pipeline client — dependency-free on purpose: the
 * deploy repo is a static dist with no package.json, so these functions
 * must run on Vercel's Node runtime with nothing but globals.
 *
 * SEPARATION LAW (owner): this talks ONLY to the exody-users database.
 * EdgeCut's database is a different DB with a different token — nothing
 * here can reach it, and nothing of it may ever appear here.
 */
export async function tursoExecute(statements) {
  const base = (process.env.EXODY_TURSO_URL || "").replace(/^libsql:/, "https:").replace(/\/+$/, "");
  const token = process.env.EXODY_TURSO_TOKEN || "";
  if (!base || !token) throw new Error("turso env missing");
  const requests = statements.map((s) => ({
    type: "execute",
    stmt: {
      sql: s.sql,
      args: (s.args || []).map((v) =>
        v === null || v === undefined
          ? { type: "null" }
          : typeof v === "number"
            ? { type: "float", value: String(v) }
            : { type: "text", value: String(v) },
      ),
    },
  }));
  requests.push({ type: "close" });
  const r = await fetch(base + "/v2/pipeline", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("turso " + r.status);
  const d = await r.json();
  const bad = (d.results || []).find((x) => x.type === "error");
  if (bad) throw new Error("turso sql: " + (bad.error?.message || "unknown"));
  return d;
}
