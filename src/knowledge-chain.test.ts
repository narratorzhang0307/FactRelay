import { describe, expect, it } from "vitest";
import {
  buildClaimIdentity,
  buildDailyEditions,
  buildFactCommitment,
  normalizeClaimStatement,
  stableStringify,
  verifyMerkleProof,
  type EditionFact,
} from "./knowledge-chain";
import type { AtlasPlacement } from "./atlas";
import type { VerificationResult } from "./types";

const place: AtlasPlacement = { label: "Beijing, China", lat: 39.9, lng: 116.4, precision: "regional", confirmedByUser: true };

function result(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    id: "fr_chain",
    createdAt: "2026-07-16T03:00:00.000Z",
    mode: "live",
    inputKind: "text",
    claim: "The Great Wall is visible from the Moon.",
    verdict: "refuted",
    truthScore: 9,
    confidence: 93,
    summary: "The evidence refutes the claim.",
    scoring: { modelConsensus: 4, evidenceBalance: 8, sourceCoverage: 100, modelAgreement: 98, formula: "55% consensus + 45% evidence" },
    sources: [{ id: "s1", title: "Source", url: "https://example.com/source", publisher: "Example", publishedAt: "2026-07-15", snippet: "Evidence", origin: "test", stance: "refute", reliability: 90, reason: "Primary source" }],
    models: [],
    missingEvidence: [],
    trace: [{ stage: "investigator", provider: "GonkaRouter", model: "Kimi-K2.6", requestId: "req_1", startedAt: "2026-07-16T03:00:00.000Z", durationMs: 1200, status: "complete" }],
    ...overrides,
  };
}

describe("Fact Atlas knowledge chain", () => {
  it("normalizes formatting differences without pretending paraphrases are equal", () => {
    expect(normalizeClaimStatement("北京 今天下雨。 ")).toBe(normalizeClaimStatement("北京今天下雨"));
    expect(normalizeClaimStatement("北京今天下雨")).not.toBe(normalizeClaimStatement("今天北京有降水"));
  });

  it("produces deterministic structured claim identities and JSON", () => {
    expect(buildClaimIdentity("A claim.", place)).toEqual(buildClaimIdentity(" A   claim ", place));
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  it("keeps the claim key while changing the record when evidence or score changes", async () => {
    const first = await buildFactCommitment(result(), "The Great Wall is visible from the Moon", place);
    const second = await buildFactCommitment(result({ truthScore: 12, sources: [{ ...result().sources[0], snippet: "Updated evidence" }] }), "The Great Wall is visible from the Moon.", place);
    expect(first.claimKey).toBe(second.claimKey);
    expect(first.rawSnapshotHash).not.toBe(second.rawSnapshotHash);
    expect(first.evidenceRoot).not.toBe(second.evidenceRoot);
    expect(first.recordHash).not.toBe(second.recordHash);
  });

  it("builds deterministic daily roots, proofs, and a previous-root chain", async () => {
    const firstCommitment = await buildFactCommitment(result(), result().claim, place);
    const secondResult = result({ id: "fr_second", claim: "A second claim", truthScore: 74, verdict: "supported" });
    const secondCommitment = await buildFactCommitment(secondResult, secondResult.claim, null);
    const nextDayResult = result({ id: "fr_next", claim: "A later claim", createdAt: "2026-07-17T03:00:00.000Z" });
    const nextDayCommitment = await buildFactCommitment(nextDayResult, nextDayResult.claim, null);
    const facts: EditionFact[] = [
      { id: "fr_second", savedAt: "2026-07-16T05:00:00.000Z", claim: secondResult.claim, canonicalClaim: secondResult.claim, verdict: secondResult.verdict, truthScore: secondResult.truthScore, commitment: secondCommitment },
      { id: "fr_chain", savedAt: "2026-07-16T04:00:00.000Z", claim: result().claim, canonicalClaim: result().claim, verdict: result().verdict, truthScore: result().truthScore, commitment: firstCommitment },
      { id: "fr_next", savedAt: "2026-07-17T04:00:00.000Z", claim: nextDayResult.claim, canonicalClaim: nextDayResult.claim, verdict: nextDayResult.verdict, truthScore: nextDayResult.truthScore, commitment: nextDayCommitment },
    ];
    const editions = await buildDailyEditions(facts);
    expect(editions).toHaveLength(2);
    expect(editions[1].previousEditionRoot).toBe(editions[0].editionRoot);
    const firstFact = editions[0].facts[0];
    expect(await verifyMerkleProof(firstFact.commitment.recordHash, editions[0].proofs[firstFact.commitment.recordHash], editions[0].factsRoot)).toBe(true);
    expect((await buildDailyEditions([...facts].reverse())).map((edition) => edition.editionRoot)).toEqual(editions.map((edition) => edition.editionRoot));
  });
});
