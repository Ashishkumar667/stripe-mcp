const { LinkService } = require("../linkService");
const oauth = require("../linkOAuth");
const config = require("../config");

function createService(args) {
  if (!args.accessToken) {
    throw new Error("accessToken is required. Complete OAuth first, then provide the returned access token.");
  }
  return new LinkService(args.accessToken, args.connectedAccountId);
}

function resourceArguments(args) {
  const { accessToken, connectedAccountId, params, ...rest } = args;
  return params || rest;
}

async function handleTool(name, args = {}) {
  const method = name.replace(/^stripe_/, "");

  if (method === "oauth_authorization_url") return oauth.authorizationUrl(args);
  if (method === "oauth_exchange_code") return oauth.exchangeCode(args);
  if (method === "oauth_refresh_token") return oauth.refreshToken(args);
  if (method === "oauth_revoke") return oauth.revokeToken(args);

  const service = createService(args);
  if (method === "wallet_summary") return service.walletSummary(args);
  if (method === "create_financial_connections_session") {
    return service.session(resourceArguments(args));
  }

  if (typeof service[method] !== "function") {
    throw new Error(`Unknown Stripe MCP tool: ${name}`);
  }
  return service[method](resourceArguments(args));
}

module.exports = { handleTool };
