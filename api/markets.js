const { fetchMarketsSafe } = require("../server").api;
const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(fetchMarketsSafe);
