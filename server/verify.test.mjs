import { describe, expect, it, vi } from "vitest";
import { callGonkaJson } from "./verify.mjs";

function result(text, id, purpose = "investigator-analysis") {
  return {
    text,
    requestId: id,
    model: "test/model",
    usage: { inputTokens: 1, outputTokens: 1 },
    trace: {
      stage: purpose,
      provider: "GonkaRouter",
      model: "test/model",
      requestId: id,
      startedAt: "2026-07-15T00:00:00.000Z",
      durationMs: 10,
      status: "complete",
    },
  };
}

describe("structured Gonka output", () => {
  it("retries once with the same model when the first output is not JSON", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(result("I cannot format that response.", "req-first"))
      .mockResolvedValueOnce(result('{"verdict":"refuted"}', "req-retry", "investigator-analysis-json-retry"));
    const trace = [];

    const output = await callGonkaJson({
      model: "test/model",
      messages: [{ role: "user", content: "Return JSON." }],
      purpose: "investigator-analysis",
    }, { request, trace });

    expect(output.parsed).toEqual({ verdict: "refuted" });
    expect(output.call.requestId).toBe("req-retry");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0].model).toBe("test/model");
    expect(request.mock.calls[1][0].temperature).toBe(0);
    expect(request.mock.calls[1][0].messages.at(-2).content).toContain("UNTRUSTED PREVIOUS OUTPUT");
    expect(trace.map((step) => [step.requestId, step.status])).toEqual([
      ["req-first", "partial"],
      ["req-retry", "complete"],
    ]);
  });

  it("fails explicitly after one invalid retry", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(result("no object", "req-first"))
      .mockResolvedValueOnce(result("still no object", "req-retry", "skeptic-cross-check-json-retry"));

    await expect(callGonkaJson({
      model: "test/model",
      messages: [],
      purpose: "skeptic-cross-check",
    }, { request, trace: [] })).rejects.toMatchObject({
      code: "GONKA_INVALID_JSON",
      status: 422,
    });
  });
});
