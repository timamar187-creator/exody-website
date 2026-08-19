/**
 * Beta sign-in, step 1 of 2: the Exody app opens this URL in the user's
 * browser; we bounce to Google's consent screen. The OAuth client SECRET
 * never ships in the app — the whole exchange happens server-side in
 * callback.js, which is the reason this hop exists at all.
 *
 * state = app-generated nonce, port = the app's loopback listener. Both ride
 * through Google in the OAuth state so callback.js can hand the verified
 * identity back to the right local app instance.
 */
export default function handler(req, res) {
  const state = String(req.query?.state || "");
  const port = String(req.query?.port || "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(state) || !/^\d{2,5}$/.test(port)) {
    res.status(400).send("bad request");
    return;
  }
  const cid = process.env.EXODY_GOOGLE_CLIENT_ID || "";
  if (!cid) {
    res.status(500).send("beta sign-in is not configured yet");
    return;
  }
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", cid);
  u.searchParams.set("redirect_uri", "https://exody.ai/api/beta/callback");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state + "." + port);
  u.searchParams.set("prompt", "select_account");
  res.writeHead(302, { Location: u.toString() });
  res.end();
}
