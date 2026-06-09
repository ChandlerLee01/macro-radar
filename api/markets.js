const { fetchMarkets } = require("../server").api;
const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(fetchMarkets);
