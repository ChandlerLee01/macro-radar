function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function createApiRoute(handler) {
  return async function apiRoute(_request, response) {
    try {
      sendJson(response, 200, await handler());
    } catch (error) {
      sendJson(response, 502, { error: error.message });
    }
  };
}

module.exports = createApiRoute;
