export async function runLegacyApiHandler(handler, request) {
  const url = new URL(request.url);
  let body;

  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
  }

  const headers = new Headers();
  let statusCode = 200;
  let responseBody = null;

  const response = {
    setHeader(name, value) {
      headers.set(name, value);
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      headers.set("Content-Type", "application/json; charset=utf-8");
      responseBody = JSON.stringify(payload);
      return this;
    },
    send(payload) {
      responseBody = payload;
      return this;
    }
  };

  await handler(
    {
      method: request.method,
      body,
      query: Object.fromEntries(url.searchParams.entries())
    },
    response
  );

  return new Response(responseBody, {
    status: statusCode,
    headers
  });
}
