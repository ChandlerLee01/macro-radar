const { fetchDailyBrief } = require("../server").api;
const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(fetchDailyBrief);
