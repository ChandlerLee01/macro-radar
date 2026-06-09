function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

async function parseBody(request) {
  if (typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("Request body must be valid JSON");
      error.statusCode = 400;
      throw error;
    }
  }

  if (!request.body && !request.readable) return {};
  if (typeof request[Symbol.asyncIterator] !== "function") return {};

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function createApiRoute(handler, options = {}) {
  const allowedMethods = options.methods || ["GET"];

  return async function apiRoute(request, response) {
    const method = request.method || "GET";
    if (!allowedMethods.includes(method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const body = method === "GET" ? {} : await parseBody(request);
      sendJson(response, 200, await handler(body, request));
    } catch (error) {
      sendJson(response, error.statusCode || 502, { error: error.message });
    }
  };
}

module.exports = createApiRoute;
