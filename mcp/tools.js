const baseSchema = {
  type: "object",
  properties: {
    connectedAccountId: { type: "string", description: "Optional acct_... connected account" },
    id: { type: "string", description: "Stripe resource ID" },
    params: { type: "object", additionalProperties: true },
  },
  additionalProperties: true,
};

const descriptions = {
  getBalance: "Get the Stripe balance",
  getUserInfo: "Get the Stripe account",
  listPaymentMethods: "List payment methods",
  retrievePaymentMethod: "Retrieve a payment method",
  listCharges: "List charges",
  retrieveCharge: "Retrieve a charge",
  listBalanceTransactions: "List balance transactions",
  listPaymentIntents: "List PaymentIntents",
  retrievePaymentIntent: "Retrieve a PaymentIntent",
  listCustomers: "List customers",
  createCustomer: "Create a customer",
  listSubscriptions: "List subscriptions",
  listInvoices: "List invoices",
  listPayouts: "List payouts",
  listDisputes: "List disputes",
  listRefunds: "List refunds",
  listFinancialAccounts: "List linked bank accounts",
  retrieveFinancialAccount: "Retrieve a linked bank account",
  listFinancialTransactions: "List bank transactions",
  refreshFinancialAccountBalance: "Refresh a bank balance",
  refreshFinancialAccountTransactions: "Refresh bank transactions",
  disconnectFinancialAccount: "Disconnect a linked bank account",
  listIssuingCards: "List Issuing cards",
  retrieveIssuingCard: "Retrieve an Issuing card",
  createSpendRequest: "Create a one-time virtual spend request",
  cancelSpendRequest: "Cancel an Issuing card",
  listCardholders: "List Issuing cardholders",
  listIssuingTransactions: "List Issuing transactions",
  listAuthorizations: "List Issuing authorizations",
  approveAuthorization: "Approve an Issuing authorization",
  declineAuthorization: "Decline an Issuing authorization",
};

function getTools() {
  const resourceTools = Object.entries(descriptions).map(([method, description]) => ({
    name: `stripe_${method}`,
    description,
    inputSchema: baseSchema,
  }));
  const oauthTools = [
    { name: "stripe_oauth_authorization_url", description: "Build a Stripe Connect OAuth authorization URL.", inputSchema: { type: "object", properties: { clientId: { type: "string" }, redirectUri: { type: "string" }, scope: { type: "string" }, state: { type: "string" } } } },
    { name: "stripe_oauth_exchange_code", description: "Exchange a Stripe OAuth authorization code.", inputSchema: { type: "object", required: ["code"], properties: { code: { type: "string" } } } },
    { name: "stripe_oauth_refresh_token", description: "Refresh a Stripe OAuth token.", inputSchema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } } },
    { name: "stripe_oauth_revoke", description: "Disconnect a Stripe Connect account.", inputSchema: { type: "object", required: ["stripeUserId"], properties: { stripeUserId: { type: "string" }, clientId: { type: "string" } } } },
    { name: "stripe_wallet_summary", description: "Get a combined Stripe wallet summary.", inputSchema: baseSchema },
    { name: "stripe_create_financial_connections_session", description: "Create a Financial Connections session.", inputSchema: baseSchema },
  ];
  return [...oauthTools, ...resourceTools];
}

module.exports = { getTools };
