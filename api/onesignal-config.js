const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(async () => ({
  appId: process.env.ONESIGNAL_APP_ID || "",
  configured: Boolean(process.env.ONESIGNAL_APP_ID),
}));
