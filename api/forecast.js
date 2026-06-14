const { fetchMarketOutlook } = require("../server").api;
const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(fetchMarketOutlook);
