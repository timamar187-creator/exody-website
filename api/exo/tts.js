import { originOk, rateOk } from "./_guard.js";

/**
 * EXO's real voice for the PUBLIC site — Gemini TTS ("Charon"), key in
 * Vercel env only. GET with the text in the query ON PURPOSE: the response
 * carries a long s-maxage, so Vercel's edge caches each unique line and a
 * scripted line is synthesized ONCE globally — visitors after the first hit
 * the CDN, not the owner's quota (cost principles: capability stays, cost
 * drops).
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ data: null });
    return;
  }
  if (!originOk(req) || !rateOk(req, "tts", 60, 1500)) {
    res.status(429).json({ data: null });
    return;
  }
  const key = process.env.EXODY_GEMINI_KEY;
  if (!key) {
    res.status(503).json({ data: null });
    return;
  }
  const text = String(req.query?.text || "").slice(0, 320).trim();
  if (!text) {
    res.status(400).json({ data: null });
    return;
  }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } },
            },
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!r.ok) throw new Error("tts " + r.status);
    const d = await r.json();
    const b64 = (d?.candidates?.[0]?.content?.parts || []).find((p) => p?.inlineData?.data)
      ?.inlineData?.data;
    if (!b64) throw new Error("tts returned no audio");
    // A week in the visitor's browser, a month at the edge — per unique line.
    res.setHeader("cache-control", "public, max-age=604800, s-maxage=2592000, immutable");
    res.status(200).json({ data: b64 });
  } catch (e) {
    console.error("[exo/tts]", e?.message);
    res.setHeader("cache-control", "no-store");
    res.status(200).json({ data: null });
  }
}
