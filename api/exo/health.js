/**
 * The site's boot probe: "does this deployment have a live voice/brain?"
 * Answers ok:true only when the server key is configured — the page uses
 * this to decide between the real Charon voice (proxied) and silent typing.
 * The browser-synth robot voice is gone for good (owner, 20.08.26).
 */
export default function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  res.status(200).json({ ok: !!process.env.EXODY_GEMINI_KEY });
}
