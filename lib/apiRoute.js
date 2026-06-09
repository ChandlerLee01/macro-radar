function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "object") return request.body;
  if (typeof request.body !== "string") return {};

  try {
    return JSON.parse(request.body);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function createApiRoute(handler, options = {}) {
  const allowedMethods = options.methods || ["GET"];

  return async function apiRoute(request, response) {
    if (!allowedMethods.includes(request.method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      sendJson(response, 200, await handler(parseBody(request), request));
    } catch (error) {
      sendJson(response, error.statusCode || 502, { error: error.message });
    }
  };
}

module.exports = createApiRoute;
