require("dotenv").config();
const express = require("express");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { getTools } = require("./mcp/tools");
const { handleTool } = require("./mcp/toolHandler");
const config = require("./config");

function createMcpServer() {
  const server = new Server({ name: "stripe-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await handleTool(request.params.name, request.params.arguments || {});
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
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  app.all("/mcp", (request, response) => transport.handleRequest(request, response, request.body));
  app.get("/health", (_request, response) => response.json({ ok: true, service: "stripe-mcp" }));
  app.listen(config.port, () => console.error(`Stripe MCP listening on http://localhost:${config.port}/mcp`));
}

startServer().catch((error) => { console.error("Failed to start Stripe MCP:", error); process.exit(1); });
