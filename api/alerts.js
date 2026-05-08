const { fetchMacroAlerts } = require("../server").api;
const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(fetchMacroAlerts);
