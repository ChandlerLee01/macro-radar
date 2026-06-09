const { analyzeMacroQuestion } = require("../server").api;
const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(analyzeMacroQuestion, { methods: ["POST"] });
