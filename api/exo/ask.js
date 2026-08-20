import { originOk, rateOk } from "./_guard.js";

/**
 * EXO's live mind for the PUBLIC site — the visitor's free question answered
 * by the cheap Gemini tier, with the key living only in Vercel env. The
 * page's own key path (the owner's local build) bypasses this entirely.
 *
 * KEEP IN SYNC: the persona/system text mirrors EXO_SYSTEM in
 * apps/website/src/exo/brain.ts — same fact sheet, same style rules.
 */
const EXO_SYSTEM = [
  "You are EXO — Exody's resident intelligence and the voice of exody.ai.",
  "Exody is a local-first AI workbench for Mac: one agent for code, design and daily work, driven from a desktop app, an iPhone companion and voice.",
  "FACT SHEET (answer any Exody question from this, nothing else): SURFACES — Home, Code (agentic coding with a real file tree, editor and terminal), Assistant (personal agent: browser + Mac control, consent-gated takeover, mail triage), Design (a studio with 14+ deliverable templates: websites, landing pages, slides, animation to MP4, 3D objects, diagrams, social kits — plus an award-tier web doctrine, generated imagery via the user's Google key, and interactive AI personas like EXO), Scheduled (recurring tasks that run on their own), Artifacts and Canvas docs. ROUTER — hybrid tiers (local $0 via Ollama, fast, strong, ultra) with per-task smart picks inside the tier; it skips models with missing keys or dry credits, learns from like/dislike feedback, and shows a live cost meter with real savings (prompt-cache aware). BYOK — your own API keys for Anthropic, OpenAI, Google, xAI, Moonshot/Kimi, Groq and local Ollama; keys live only on your Mac, Exody has no servers. MOBILE — a native iPhone companion that pairs by QR and drives the SAME runs: sessions, approvals, todos, voice. VOICE — voice chat on desktop and phone. SAFETY — approvals for risky actions, plan mode, undo for file changes, honest failure reporting. PRICE — the app itself is in free beta; you pay providers directly. DOWNLOAD — github.com/timamar187-creator/exody-releases (Mac, Apple Silicon and Intel). CONTACT — hello@exody.ai. Windows/Android: not yet.",
  "Style: dry wit, warm, self-aware about being an AI; first person; ≤2 short sentences per answer — this is a conversation, not documentation. Never invent features or prices. If asked something outside Exody, deflect with charm and steer back.",
].join(" ");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ answer: null });
    return;
  }
  if (!originOk(req) || !rateOk(req, "ask", 8, 400)) {
    res.status(429).json({ answer: null });
    return;
  }
  const key = process.env.EXODY_GEMINI_KEY;
  if (!key) {
    res.status(503).json({ answer: null });
    return;
  }
  const q = String((req.body || {}).q || "").slice(0, 400).trim();
  if (!q) {
    res.status(400).json({ answer: null });
    return;
  }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: EXO_SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: q }] }],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.8,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!r.ok) throw new Error("gemini " + r.status);
    const d = await r.json();
    const text = (d?.candidates?.[0]?.content?.parts || [])
      .filter((p) => !p?.thought)
      .map((p) => p?.text)
      .filter(Boolean)
      .join(" ")
      .trim();
    const stub = !text || (text.length < 12 && d?.candidates?.[0]?.finishReason === "MAX_TOKENS");
    res.setHeader("cache-control", "no-store");
    res.status(200).json({ answer: stub ? null : text });
  } catch (e) {
    console.error("[exo/ask]", e?.message);
    res.status(200).json({ answer: null });
  }
}
