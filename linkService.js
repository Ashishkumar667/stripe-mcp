const axios = require("axios");
const qs = require("querystring");
class LinkError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
class LinkService {
  constructor(token, account) {
    if (!token) throw new LinkError("Access token required.", 401);
    this.client = axios.create({
      baseURL: process.env.STRIPE_API_BASE_URL || "https://api.stripe.com",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": process.env.STRIPE_API_VERSION || "2024-06-20",
        ...(account ? { "Stripe-Account": account } : {}),
      },
    });
  }
  async get(path, params = {}) {
    try {
      return (await this.client.get(path, { params })).data;
    } catch (e) {
      this.fail(e);
    }
  }
  async post(path, body = {}) {
    try {
      return (await this.client.post(path, qs.stringify(body))).data;
    } catch (e) {
      this.fail(e);
    }
  }
  fail(e) {
    const d = e.response?.data?.error || e.response?.data || {};
    throw new LinkError(
      d.message || d.error || "Stripe API request failed",
      e.response?.status || 500,
      d,
    );
  }
  session({
    customerId,
    permissions = ["balances", "transactions", "ownership"],
    returnUrl,
  }) {
    if (!customerId) throw new LinkError("customerId is required.", 400);
    const b = {
      "account_holder[type]": "customer",
      "account_holder[customer]": customerId,
      ...(returnUrl ? { return_url: returnUrl } : {}),
    };
    permissions.forEach((p, i) => {
      b[`permissions[${i}]`] = p;
      b[`prefetch[${i}]`] = p;
    });
    return this.post("/v1/financial_connections/sessions", b);
  }
  async walletSummary({ transactionsLimit = 20 } = {}) {
    const jobs = [
      this.get("/v1/balance"),
      this.get("/v1/payment_methods", { limit: 10 }),
      this.get("/v1/balance_transactions", { limit: transactionsLimit }),
      this.get("/v1/financial_connections/accounts", { limit: 10 }),
      this.get("/v1/issuing/cards", { limit: 10, status: "active" }),
    ];
    const [
      balance,
      paymentMethods,
      recentTransactions,
      linkedBankAccounts,
      activeSpendRequests,
    ] = await Promise.all(jobs.map((p) => p.catch(() => null)));
    return {
      balance,
      paymentMethods,
      recentTransactions,
      linkedBankAccounts,
      activeSpendRequests,
    };
  }
}
const endpoints = {
  listFinancialAccounts: ["get", "/v1/financial_connections/accounts"],
  retrieveFinancialAccount: ["get", "/v1/financial_connections/accounts/{id}"],
  listFinancialTransactions: ["get", "/v1/financial_connections/transactions"],
  getUserInfo: ["get", "/v1/account"],
  getBalance: ["get", "/v1/balance"],
  listPaymentMethods: ["get", "/v1/payment_methods"],
  retrievePaymentMethod: ["get", "/v1/payment_methods/{id}"],
  listCharges: ["get", "/v1/charges"],
  retrieveCharge: ["get", "/v1/charges/{id}"],
  listBalanceTransactions: ["get", "/v1/balance_transactions"],
  listPaymentIntents: ["get", "/v1/payment_intents"],
  retrievePaymentIntent: ["get", "/v1/payment_intents/{id}"],
  listCustomers: ["get", "/v1/customers"],
  listSubscriptions: ["get", "/v1/subscriptions"],
  listInvoices: ["get", "/v1/invoices"],
  listPayouts: ["get", "/v1/payouts"],
  listDisputes: ["get", "/v1/disputes"],
  listRefunds: ["get", "/v1/refunds"],
  listIssuingCards: ["get", "/v1/issuing/cards"],
  retrieveIssuingCard: ["get", "/v1/issuing/cards/{id}"],
  listCardholders: ["get", "/v1/issuing/cardholders"],
  listIssuingTransactions: ["get", "/v1/issuing/transactions"],
  listAuthorizations: ["get", "/v1/issuing/authorizations"],
};
for (const [name, [method, path]] of Object.entries(endpoints))
  LinkService.prototype[name] = function (args = {}) {
    const p = path.replace("{id}", args.id || "");
    const q = { ...args };
    delete q.id;
    return this[method](p, q);
  };
LinkService.prototype.refreshFinancialAccountBalance = function ({ id }) {
  return this.post(`/v1/financial_connections/accounts/${id}/refresh`, {
    "features[0]": "balance",
  });
};
LinkService.prototype.refreshFinancialAccountTransactions = function ({ id }) {
  return this.post(`/v1/financial_connections/accounts/${id}/refresh`, {
    "features[0]": "transactions",
  });
};
LinkService.prototype.disconnectFinancialAccount = function ({ id }) {
  return this.post(`/v1/financial_connections/accounts/${id}/disconnect`);
};
LinkService.prototype.cancelSpendRequest = function ({ id }) {
  return this.post(`/v1/issuing/cards/${id}`, { status: "canceled" });
};
LinkService.prototype.createCustomer = function (args) {
  return this.post("/v1/customers", args);
};
LinkService.prototype.createSpendRequest = function (args) {
  if (!args.cardholderId || !args.amount)
    throw new LinkError("cardholderId and amount are required.", 400);
  return this.post("/v1/issuing/cards", {
    cardholder: args.cardholderId,
    currency: args.currency || "usd",
    type: "virtual",
    status: "active",
    "lifecycle_controls[cancel_after][payment_count]": 1,
    "spending_controls[spending_limits][0][amount]": args.amount,
    "spending_controls[spending_limits][0][interval]": "per_authorization",
    ...(args.metadata || {}),
  });
};
LinkService.prototype.approveAuthorization = function ({ id, amount }) {
  return this.post(
    `/v1/issuing/authorizations/${id}/approve`,
    amount ? { amount } : {},
  );
};
LinkService.prototype.declineAuthorization = function ({ id }) {
  return this.post(`/v1/issuing/authorizations/${id}/decline`);
};
module.exports = { LinkError, LinkService };
