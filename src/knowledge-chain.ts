import type { AtlasPlacement } from "./atlas";
import type { VerificationResult } from "./types";

export const KNOWLEDGE_CHAIN_SCHEMA = "fact-atlas-chronicle/v1";

export interface ClaimIdentity {
  schema: "fact-atlas-claim/v1";
  statement: string;
  locationScope: string | null;
  timeScope: string | null;
}

export interface FactCommitment {
  schema: typeof KNOWLEDGE_CHAIN_SCHEMA;
  claimKey: string;
  rawSnapshotHash: string;
  evidenceRoot: string;
  receiptRoot: string;
  scorePolicyHash: string;
  recordHash: string;
}

export interface EditionFact {
  id: string;
  savedAt: string;
  claim: string;
  canonicalClaim: string;
  verdict: VerificationResult["verdict"];
  truthScore: number;
  commitment: FactCommitment;
}

export interface DailyKnowledgeEdition {
  schema: "fact-atlas-daily-edition/v1";
  date: string;
  day: number;
  factCount: number;
  factsRoot: string;
  manifestHash: string;
  policyRoot: string;
  previousEditionRoot: string;
  editionRoot: string;
  facts: EditionFact[];
  proofs: Record<string, string[]>;
}

function normalizeString(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeClaimStatement(value: string): string {
  return normalizeString(value)
    .toLocaleLowerCase("und")
    .replace(/[\p{P}\p{Z}]+/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, "$1")
    .trim();
}

function normalizeLocation(value: string | null | undefined): string | null {
  const normalized = value ? normalizeClaimStatement(value) : "";
  return normalized || null;
}

export function buildClaimIdentity(
  canonicalClaim: string,
  placement: AtlasPlacement | null,
  timeScope: string | null = null,
): ClaimIdentity {
  return {
    schema: "fact-atlas-claim/v1",
    statement: normalizeClaimStatement(canonicalClaim),
    locationScope: normalizeLocation(placement?.label),
    timeScope: timeScope ? normalizeString(timeScope) : null,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  if (typeof value === "string") return normalizeString(value);
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function toHex(bytes: ArrayBuffer): string {
  return `0x${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function sha256(value: string): Promise<string> {
  return toHex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hashValue(value: unknown): Promise<string> {
  return sha256(stableStringify(value));
}

async function hashPair(left: string, right: string): Promise<string> {
  const [first, second] = left.localeCompare(right) <= 0 ? [left, right] : [right, left];
  return sha256(`${first.slice(2)}${second.slice(2)}`);
}

async function merkleLayers(leaves: string[]): Promise<string[][]> {
  if (!leaves.length) return [[await sha256("fact-atlas:empty")]];
  const layers = [[...leaves]];
  while (layers.at(-1)!.length > 1) {
    const current = layers.at(-1)!;
    const next: string[] = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(await hashPair(current[index], current[index + 1] ?? current[index]));
    }
    layers.push(next);
  }
  return layers;
}

export async function merkleRoot(leaves: string[]): Promise<string> {
  return (await merkleLayers(leaves)).at(-1)![0];
}

export async function buildMerkleProof(leaves: string[], leafIndex: number): Promise<string[]> {
  if (leafIndex < 0 || leafIndex >= leaves.length) throw new Error("Merkle leaf index is out of range.");
  const layers = await merkleLayers(leaves);
  const proof: string[] = [];
  let index = leafIndex;
  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    const layer = layers[layerIndex];
    proof.push(layer[index % 2 === 0 ? index + 1 : index - 1] ?? layer[index]);
    index = Math.floor(index / 2);
  }
  return proof;
}

export async function verifyMerkleProof(leaf: string, proof: string[], root: string): Promise<boolean> {
  let current = leaf;
  for (const sibling of proof) current = await hashPair(current, sibling);
  return current === root;
}

export async function buildFactCommitment(
  result: VerificationResult,
  canonicalClaim: string,
  placement: AtlasPlacement | null,
): Promise<FactCommitment> {
  const claimIdentity = buildClaimIdentity(canonicalClaim, placement);
  const sourceHashes = await Promise.all(result.sources.map((source) => hashValue({
    id: source.id,
    title: source.title,
    url: source.url,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    snippet: source.snippet,
    stance: source.stance,
    reliability: source.reliability,
  })));
  const receiptHashes = await Promise.all(result.trace.map((step) => hashValue({
    stage: step.stage,
    provider: step.provider,
    model: step.model,
    requestId: step.requestId,
    startedAt: step.startedAt,
    durationMs: step.durationMs,
    status: step.status,
  })));
  const claimKey = await hashValue(claimIdentity);
  const rawSnapshotHash = await hashValue(result);
  const evidenceRoot = await merkleRoot(sourceHashes.sort());
  const receiptRoot = await merkleRoot(receiptHashes.sort());
  const scorePolicyHash = await hashValue({ formula: result.scoring.formula, schema: "fact-atlas-score-policy/v1" });
  const recordHash = await hashValue({
    schema: KNOWLEDGE_CHAIN_SCHEMA,
    claimKey,
    rawSnapshotHash,
    evidenceRoot,
    receiptRoot,
    scorePolicyHash,
    verdict: result.verdict,
    truthScore: result.truthScore,
    confidence: result.confidence,
    createdAt: result.createdAt,
  });
  return { schema: KNOWLEDGE_CHAIN_SCHEMA, claimKey, rawSnapshotHash, evidenceRoot, receiptRoot, scorePolicyHash, recordHash };
}

function editionDay(date: string): number {
  return Number(date.replaceAll("-", ""));
}

export async function buildDailyEditions(facts: EditionFact[]): Promise<DailyKnowledgeEdition[]> {
  const grouped = new Map<string, EditionFact[]>();
  for (const fact of facts) {
    const date = fact.savedAt.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), fact]);
  }
  const editions: DailyKnowledgeEdition[] = [];
  let previousEditionRoot = `0x${"0".repeat(64)}`;
  for (const date of [...grouped.keys()].sort()) {
    const editionFacts = grouped.get(date)!.sort((left, right) => left.commitment.recordHash.localeCompare(right.commitment.recordHash));
    const leaves = editionFacts.map((fact) => fact.commitment.recordHash);
    const factsRoot = await merkleRoot(leaves);
    const manifestHash = await hashValue(editionFacts.map((fact) => ({
      id: fact.id,
      claim: fact.claim,
      canonicalClaim: fact.canonicalClaim,
      verdict: fact.verdict,
      truthScore: fact.truthScore,
      claimKey: fact.commitment.claimKey,
      recordHash: fact.commitment.recordHash,
    })));
    const policyRoot = await merkleRoot([...new Set(editionFacts.map((fact) => fact.commitment.scorePolicyHash))].sort());
    const editionPayload = {
      schema: "fact-atlas-daily-edition/v1" as const,
      date,
      day: editionDay(date),
      factCount: editionFacts.length,
      factsRoot,
      manifestHash,
      policyRoot,
      previousEditionRoot,
    };
    const editionRoot = await hashValue(editionPayload);
    const proofs = Object.fromEntries(await Promise.all(editionFacts.map(async (fact, index) => [
      fact.commitment.recordHash,
      await buildMerkleProof(leaves, index),
    ])));
    editions.push({ ...editionPayload, editionRoot, facts: editionFacts, proofs });
    previousEditionRoot = editionRoot;
  }
  return editions;
}

export function shortHash(value: string | null | undefined, head = 8, tail = 6): string {
  if (!value) return "—";
  return `${value.slice(0, head + 2)}…${value.slice(-tail)}`;
}
