function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let body = "";

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(body);
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch (error) {
        reject(new Error("invalid_json"));
      }
    });

    req.on("error", reject);
  });
}

module.exports = {
  sendJson,
  readJsonBody
};
