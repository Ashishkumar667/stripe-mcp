const { LinkService } = require("../linkService");
const oauth = require("../linkOAuth");
const config = require("../config");

function extractToken(args) {
  return args.accessToken || args.access_token || args["access-token"];
}
function extractAccount(args) {
  return args.connectedAccountId || args.stripe_user_id || args["connected-account-id"];
}
function extractRefreshToken(args) {
  return args.refreshToken || args.refresh_token || args["refresh-token"];
}

function resourceArguments(args) {
  const { accessToken, access_token, "access-token": a1, connectedAccountId, stripe_user_id, "connected-account-id": a2, refreshToken, refresh_token, "refresh-token": a3, params, ...rest } = args;
  return params || rest;
}

function isExpiredTokenError(error) {
  return error.statusCode === 401 || error.details?.code === "platform_api_key_expired";
}

async function runWithService(args, run) {
  const accessToken = extractToken(args);
  if (!accessToken) {
    throw new Error("accessToken is required. Complete OAuth first, then provide the returned access token.");
  }
  const connectedAccountId = extractAccount(args);
  try {
    return await run(new LinkService(accessToken, connectedAccountId));
  } catch (error) {
    const refreshToken = extractRefreshToken(args);
    if (!refreshToken || !isExpiredTokenError(error)) throw error;
    const refreshed = await oauth.refreshToken({ refreshToken });
    return await run(new LinkService(refreshed.access_token, connectedAccountId));
  }
}

async function handleTool(name, args = {}) {
  const method = name.replace(/^stripe_/, "");

  if (method === "oauth_authorization_url") return oauth.authorizationUrl(args);
  if (method === "oauth_exchange_code") return oauth.exchangeCode(args);
  if (method === "oauth_refresh_token") return oauth.refreshToken(args);
  if (method === "oauth_revoke") return oauth.revokeToken(args);

  if (method === "wallet_summary") return runWithService(args, (service) => service.walletSummary(args));
  if (method === "create_financial_connections_session") {
    return runWithService(args, (service) => service.session(resourceArguments(args)));
  }

  return runWithService(args, (service) => {
    if (typeof service[method] !== "function") {
      throw new Error(`Unknown Stripe MCP tool: ${name}`);
    }
    return service[method](resourceArguments(args));
  });
}

module.exports = { handleTool };
