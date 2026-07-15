import type { VerificationResult, Verdict } from "./types";

export const ATLAS_STORAGE_KEY = "factrelay.atlas.v1";

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

function isNode(value: unknown): value is AtlasNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<AtlasNode>;
  return typeof node.id === "string"
    && typeof node.savedAt === "string"
    && (node.placement === null || isPlacement(node.placement))
    && Boolean(node.result && typeof node.result === "object" && typeof node.result.id === "string");
}

export function loadAtlasNodes(storage: StorageLike | null = browserStorage()): AtlasNode[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(ATLAS_STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isNode) : [];
  } catch {
    return [];
  }
}

function persistAtlasNodes(nodes: AtlasNode[], storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(ATLAS_STORAGE_KEY, JSON.stringify(nodes));
    listeners.forEach((listener) => listener());
  } catch {
    // The current page still keeps its result if private-mode storage is unavailable.
  }
}

export function saveAtlasNode(
  result: VerificationResult,
  placement: AtlasPlacement | null,
  storage: StorageLike | null = browserStorage(),
  now = new Date(),
): AtlasNode {
  if (placement && !isPlacement(placement)) throw new Error("Invalid Atlas placement.");
  const node: AtlasNode = {
    id: result.id,
    savedAt: now.toISOString(),
    placement,
    result,
  };
  const next = [node, ...loadAtlasNodes(storage).filter((existing) => existing.id !== node.id)];
  persistAtlasNodes(next, storage);
  return node;
}

export function removeAtlasNode(id: string, storage: StorageLike | null = browserStorage()): void {
  persistAtlasNodes(loadAtlasNodes(storage).filter((node) => node.id !== id), storage);
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
  return () => listeners.delete(listener);
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
