require("dotenv").config();
const express = require("express");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { getTools } = require("./mcp/tools");
const { handleTool } = require("./mcp/toolHandler");
const config = require("./config");

function headerValue(headers, name) {
  if (!headers) return "";
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function applyConnectorCredentials(args, ...headerSources) {
  const headers = Object.assign({}, ...headerSources.filter(Boolean));
  const access = headerValue(headers, "access-token") || headerValue(headers, "x-access-token");
  const refresh = headerValue(headers, "refresh-token") || headerValue(headers, "x-refresh-token");
  const authorization = headerValue(headers, "authorization");
  if (access) {
    args.accessToken = access;
  } else if (authorization.startsWith("Bearer ")) {
    args.accessToken = authorization.slice("Bearer ".length);
  }
  if (refresh) {
    args.refreshToken = refresh;
  }
  const account = headerValue(headers, "connected-account-id") || headerValue(headers, "stripe-account");
  if (account && !args.connectedAccountId && !args.stripe_user_id && !args["connected-account-id"]) {
    args.connectedAccountId = account;
  }
}

function createMcpServer(httpHeaders) {
  const server = new Server({ name: "stripe-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    try {
      const args = { ...(request.params.arguments || {}) };
      applyConnectorCredentials(args, httpHeaders, extra?.requestInfo?.headers);
      const result = await handleTool(request.params.name, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: error.message, statusCode: error.statusCode || 500, details: error.details }) }] };
    }
  });
  return server;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.all("/mcp", async (request, response) => {
    const server = createMcpServer(request.headers);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    response.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  });
  app.get("/health", (_request, response) => response.json({ ok: true, service: "stripe-mcp" }));
  app.get("/link/oauth/callback", (request, response) => response.json({ code: request.query.code, state: request.query.state }));
  app.listen(config.port, () => console.error(`Stripe MCP listening on http://localhost:${config.port}/mcp`));
}

startServer().catch((error) => { console.error("Failed to start Stripe MCP:", error); process.exit(1); });
