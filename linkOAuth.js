const axios = require("axios");
const qs = require("querystring");

const CONNECT =
  process.env.STRIPE_CONNECT_BASE_URL || "https://connect.stripe.com";
class LinkOAuthError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
const env = (n) => {
  const v = process.env[n];
  if (!v) throw new LinkOAuthError(`Missing env: ${n}`, 500);
  return v.trim();
};
const result = (res, fallback) => {
  if (res.status < 200 || res.status >= 300) {
    const d = res.data || {};
    throw new LinkOAuthError(
      d.error_description || d.error || fallback,
      res.status,
      d,
    );
  }
  return res.data;
};

function authorizationUrl({
  clientId = process.env.STRIPE_CLIENT_ID,
  redirectUri = process.env.LINK_OAUTH_REDIRECT_URI,
  scope = "read_write",
  state,
}) {
  if (!clientId) throw new LinkOAuthError("Missing STRIPE_CLIENT_ID.", 400);
  if (!redirectUri)
    throw new LinkOAuthError(
      "Missing redirectUri or LINK_OAUTH_REDIRECT_URI.",
      400,
    );
  state ||= Date.now().toString(36) + Math.random().toString(36).slice(2);
  const p = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state,
    stripe_landing: "login",
  });
  return { authorization_url: `${CONNECT}/oauth/authorize?${p}`, state };
}
async function exchangeCode({ code }) {
  if (!code) throw new LinkOAuthError("Missing authorization code.");
  const r = await axios.post(
    `${CONNECT}/oauth/token`,
    qs.stringify({ grant_type: "authorization_code", code }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      },
      validateStatus: () => true,
    },
  );
  return result(r, "Token exchange failed");
}
async function refreshToken({ refreshToken }) {
  if (!refreshToken) throw new LinkOAuthError("Missing refreshToken.");
  const r = await axios.post(
    `${CONNECT}/oauth/token`,
    qs.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      },
      validateStatus: () => true,
    },
  );
  return result(r, "Token refresh failed");
}
async function revokeToken({
  stripeUserId,
  clientId = process.env.STRIPE_CLIENT_ID,
}) {
  if (!stripeUserId || !clientId)
    throw new LinkOAuthError("stripeUserId and STRIPE_CLIENT_ID are required.");
  const r = await axios.post(
    `${CONNECT}/oauth/deauthorize`,
    qs.stringify({ client_id: clientId, stripe_user_id: stripeUserId }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      },
      validateStatus: () => true,
    },
  );
  return result(r, "Revocation failed");
}
module.exports = {
  LinkOAuthError,
  authorizationUrl,
  exchangeCode,
  refreshToken,
  revokeToken,
};
