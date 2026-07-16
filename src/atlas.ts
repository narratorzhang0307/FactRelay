import type { VerificationResult, Verdict } from "./types";
import {
  buildDailyEditions,
  buildFactCommitment,
  type DailyKnowledgeEdition,
  type EditionFact,
  type FactCommitment,
} from "./knowledge-chain";

export const ATLAS_STORAGE_KEY = "factrelay.atlas.v1";
export const CHRONICLE_ANCHOR_STORAGE_KEY = "factatlas.chronicle.anchors.v1";

export type AtlasVisibility = "private" | "public";

export interface AtlasPlacement {
  label: string;
  lat: number;
  lng: number;
  precision: "exact" | "regional" | "country";
  confirmedByUser: true;
}

export interface AtlasNode {
  id: string;
  savedAt: string;
  placement: AtlasPlacement | null;
  result: VerificationResult;
  visibility: AtlasVisibility;
  canonicalClaim: string;
  commitment: FactCommitment | null;
}

export interface ChronicleAnchor {
  editionRoot: string;
  txHash: string;
  chainName: string;
  contractAddress: string;
  publisher: string;
  anchoredAt: string;
}

export interface AtlasNodeMetadata {
  visibility?: AtlasVisibility;
  canonicalClaim?: string;
  commitment?: FactCommitment | null;
}

export interface AtlasLink {
  from: string;
  to: string;
  kind: "shared-evidence" | "nearby";
  label: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const listeners = new Set<() => void>();

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPlacement(value: unknown): value is AtlasPlacement {
  if (!value || typeof value !== "object") return false;
  const placement = value as Partial<AtlasPlacement>;
  return typeof placement.label === "string"
    && Number.isFinite(placement.lat)
    && Number.isFinite(placement.lng)
    && Number(placement.lat) >= -90
    && Number(placement.lat) <= 90
    && Number(placement.lng) >= -180
    && Number(placement.lng) <= 180
    && ["exact", "regional", "country"].includes(String(placement.precision))
    && placement.confirmedByUser === true;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isVerificationResult(value: unknown): value is VerificationResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<VerificationResult>;
  return typeof result.id === "string"
    && typeof result.createdAt === "string"
    && !Number.isNaN(Date.parse(result.createdAt))
    && typeof result.claim === "string"
    && typeof result.summary === "string"
    && ["supported", "refuted", "mixed", "insufficient"].includes(String(result.verdict))
    && Number.isFinite(result.truthScore)
    && Number(result.truthScore) >= 0
    && Number(result.truthScore) <= 100
    && Number.isFinite(result.confidence)
    && Number(result.confidence) >= 0
    && Number(result.confidence) <= 100
    && Array.isArray(result.sources)
    && result.sources.every((source) => source && typeof source.id === "string" && typeof source.title === "string" && isHttpUrl(source.url))
    && Array.isArray(result.models)
    && Array.isArray(result.missingEvidence)
    && Array.isArray(result.trace)
    && Boolean(result.scoring && typeof result.scoring === "object");
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value);
}

function isFactCommitment(value: unknown): value is FactCommitment {
  if (!value || typeof value !== "object") return false;
  const commitment = value as Partial<FactCommitment>;
  return commitment.schema === "fact-atlas-chronicle/v1"
    && isHash(commitment.claimKey)
    && isHash(commitment.rawSnapshotHash)
    && isHash(commitment.evidenceRoot)
    && isHash(commitment.receiptRoot)
    && isHash(commitment.scorePolicyHash)
    && isHash(commitment.recordHash);
}

function migrateNode(value: unknown): AtlasNode | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Partial<AtlasNode>;
  const result = node.result;
  const valid = typeof node.id === "string"
    && typeof node.savedAt === "string"
    && !Number.isNaN(Date.parse(node.savedAt))
    && (node.placement === null || isPlacement(node.placement))
    && isVerificationResult(result)
    && result.id === node.id;
  if (!valid) return null;
  const visibility = node.visibility === "public" ? "public" : "private";
  const canonicalClaim = typeof node.canonicalClaim === "string" && node.canonicalClaim.trim()
    ? node.canonicalClaim.trim()
    : result!.claim;
  const commitment = visibility === "public" && isFactCommitment(node.commitment) ? node.commitment : null;
  return { ...node, visibility, canonicalClaim, commitment } as AtlasNode;
}

export function loadAtlasNodes(storage: StorageLike | null = browserStorage()): AtlasNode[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(ATLAS_STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(migrateNode).filter((node): node is AtlasNode => Boolean(node)) : [];
  } catch {
    return [];
  }
}

function persistAtlasNodes(nodes: AtlasNode[], storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ATLAS_STORAGE_KEY, JSON.stringify(nodes));
    listeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

export function saveAtlasNode(
  result: VerificationResult,
  placement: AtlasPlacement | null,
  storage: StorageLike | null = browserStorage(),
  now = new Date(),
  metadata: AtlasNodeMetadata = {},
): AtlasNode {
  if (placement && !isPlacement(placement)) throw new Error("Invalid Atlas placement.");
  if (!isVerificationResult(result)) throw new Error("Invalid verification result.");
  const node: AtlasNode = {
    id: result.id,
    savedAt: now.toISOString(),
    placement,
    result,
    visibility: metadata.visibility === "public" ? "public" : "private",
    canonicalClaim: metadata.canonicalClaim?.trim() || result.claim,
    commitment: metadata.visibility === "public" && metadata.commitment ? metadata.commitment : null,
  };
  const next = [node, ...loadAtlasNodes(storage).filter((existing) => existing.id !== node.id)];
  if (!persistAtlasNodes(next, storage)) {
    throw new Error("Atlas storage is unavailable. · 当前浏览器无法保存知识节点。");
  }
  return node;
}

export async function savePublicAtlasNode(
  result: VerificationResult,
  placement: AtlasPlacement | null,
  canonicalClaim: string,
  storage: StorageLike | null = browserStorage(),
  now = new Date(),
): Promise<AtlasNode> {
  if (result.mode !== "live") {
    throw new Error("Only a live verification can enter the public Chronicle. · 只有真实核验结果才能进入公共知识链。");
  }
  const normalizedClaim = canonicalClaim.trim();
  if (normalizedClaim.length < 8) {
    throw new Error("Confirm a complete canonical claim before publishing. · 发布前请确认一条完整的规范主张。");
  }
  const commitment = await buildFactCommitment(result, normalizedClaim, placement);
  return saveAtlasNode(result, placement, storage, now, {
    visibility: "public",
    canonicalClaim: normalizedClaim,
    commitment,
  });
}

export function editionFactsFromNodes(nodes: AtlasNode[]): EditionFact[] {
  return nodes
    .filter((node) => node.visibility === "public" && node.commitment)
    .map((node) => ({
      id: node.id,
      savedAt: node.savedAt,
      claim: node.result.claim,
      canonicalClaim: node.canonicalClaim,
      verdict: node.result.verdict,
      truthScore: node.result.truthScore,
      commitment: node.commitment!,
    }));
}

export function buildAtlasEditions(nodes: AtlasNode[]): Promise<DailyKnowledgeEdition[]> {
  return buildDailyEditions(editionFactsFromNodes(nodes));
}

function isChronicleAnchor(value: unknown): value is ChronicleAnchor {
  if (!value || typeof value !== "object") return false;
  const anchor = value as Partial<ChronicleAnchor>;
  return isHash(anchor.editionRoot)
    && /^0x[0-9a-f]{64}$/i.test(String(anchor.txHash))
    && typeof anchor.chainName === "string"
    && /^0x[0-9a-f]{40}$/i.test(String(anchor.contractAddress))
    && /^0x[0-9a-f]{40}$/i.test(String(anchor.publisher))
    && typeof anchor.anchoredAt === "string"
    && !Number.isNaN(Date.parse(anchor.anchoredAt));
}

export function loadChronicleAnchors(storage: StorageLike | null = browserStorage()): ChronicleAnchor[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(CHRONICLE_ANCHOR_STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isChronicleAnchor) : [];
  } catch {
    return [];
  }
}

export function saveChronicleAnchor(anchor: ChronicleAnchor, storage: StorageLike | null = browserStorage()): void {
  if (!isChronicleAnchor(anchor) || !storage) throw new Error("Invalid Chronicle anchor. · 知识链锚点无效。");
  const next = [anchor, ...loadChronicleAnchors(storage).filter((item) => item.editionRoot !== anchor.editionRoot)];
  try {
    storage.setItem(CHRONICLE_ANCHOR_STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("Chronicle anchor storage is unavailable. · 当前浏览器无法保存链上锚点。");
  }
}

export function removeAtlasNode(id: string, storage: StorageLike | null = browserStorage()): void {
  if (!persistAtlasNodes(loadAtlasNodes(storage).filter((node) => node.id !== id), storage)) {
    throw new Error("Atlas storage is unavailable. · 当前浏览器无法更新知识节点。");
  }
}

export function clearAtlas(storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(ATLAS_STORAGE_KEY);
    listeners.forEach((listener) => listener());
  } catch {
    // Ignore unavailable private-mode storage.
  }
}

export function subscribeAtlas(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ATLAS_STORAGE_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export const VERDICT_COLOR: Record<Verdict, string> = {
  supported: "#aaff4f",
  refuted: "#f8bad6",
  mixed: "#ffe28a",
  insufficient: "#b9edf2",
};

export function greatCircleKm(a: AtlasPlacement, b: AtlasPlacement): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function buildAtlasLinks(nodes: AtlasNode[]): AtlasLink[] {
  const links: AtlasLink[] = [];
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left];
      const b = nodes[right];
      const urls = new Set(a.result.sources.map((source) => source.url));
      if (b.result.sources.some((source) => urls.has(source.url))) {
        links.push({ from: a.id, to: b.id, kind: "shared-evidence", label: "Shared source · 共用来源" });
        continue;
      }
      if (a.placement && b.placement) {
        const distance = greatCircleKm(a.placement, b.placement);
        if (distance <= 300) links.push({ from: a.id, to: b.id, kind: "nearby", label: "Same region · 同一地区" });
      }
    }
  }
  return links;
}

export function projectToGlobe(
  placement: Pick<AtlasPlacement, "lat" | "lng">,
  centerLng = 105,
): { x: number; y: number; visible: boolean } {
  const lat = placement.lat * Math.PI / 180;
  const deltaLng = (placement.lng - centerLng) * Math.PI / 180;
  return {
    x: Math.cos(lat) * Math.sin(deltaLng),
    y: -Math.sin(lat),
    visible: Math.cos(lat) * Math.cos(deltaLng) >= 0,
  };
}
