import { describe, expect, it } from "vitest";
import { ApiClientError, readJsonResponse } from "./api";

describe("client API boundary", () => {
  it("parses successful JSON responses", async () => {
    await expect(readJsonResponse<{ ok: boolean }>(new Response('{"ok":true}'))).resolves.toEqual({ ok: true });
  });

  it("preserves structured server error metadata", async () => {
    const response = new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Slow down.", details: "Retry later." } }), { status: 429 });
    const error = await readJsonResponse(response).catch((reason) => reason);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: "RATE_LIMITED", status: 429, details: "Retry later.", message: "Slow down. Retry later." });
  });

  it("rejects malformed and empty successful responses", async () => {
    await expect(readJsonResponse(new Response("<html>broken</html>"))).rejects.toMatchObject({ code: "INVALID_JSON" });
    await expect(readJsonResponse(new Response(""))).rejects.toMatchObject({ code: "EMPTY_RESPONSE" });
  });

  it("falls back to an HTTP status when an error body is not JSON", async () => {
    await expect(readJsonResponse(new Response("gateway unavailable", { status: 502 }))).rejects.toMatchObject({ code: "REQUEST_FAILED", status: 502 });
  });
});
