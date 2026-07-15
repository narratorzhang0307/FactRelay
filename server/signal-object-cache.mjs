const SIGNAL_CACHE_TOPICS = ["ai", "technology", "finance", "climate", "science", "health", "culture", "policy"];
const CACHE_WINDOW_DAYS = 3;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_BUNDLE_BYTES = 5_000_000;
const bundleMemory = new Map();
const bundleRequests = new Map();

function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
    if (url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isRecentDate(date, now) {
  const selected = Date.parse(`${date}T00:00:00.000Z`);
  const currentDate = now.toISOString().slice(0, 10);
  const current = Date.parse(`${currentDate}T00:00:00.000Z`);
  const ageDays = (current - selected) / 86_400_000;
  return Number.isInteger(ageDays) && ageDays >= 0 && ageDays < CACHE_WINDOW_DAYS;
}

function isValidEdition(edition, topic, date) {
  return edition?.mode === "live"
    && edition.topic === topic
    && edition.calendar?.selectedDate === date
    && typeof edition.requestId === "string"
    && edition.requestId.length > 0
    && Array.isArray(edition.trace)
    && edition.trace.some((step) => step?.provider === "GonkaRouter" && step?.status === "complete")
    && Array.isArray(edition.signals)
    && edition.signals.length >= 1
    && edition.signals.length <= 5
    && edition.signals.every((signal) => signal?.headline
      && signal?.headlineZh
      && signal?.claim
      && signal?.claimZh
      && signal?.why
      && signal?.whyZh
      && isHttpUrl(signal?.source?.url));
}

function isValidBundle(bundle, date) {
  return bundle?.version === 1
    && bundle.date === date
    && bundle.editions
    && SIGNAL_CACHE_TOPICS.every((topic) => isValidEdition(bundle.editions[topic], topic, date));
}

function rememberBundle(key, bundle, now) {
  bundleMemory.set(key, { bundle, savedAt: now.getTime() });
  while (bundleMemory.size > CACHE_WINDOW_DAYS) bundleMemory.delete(bundleMemory.keys().next().value);
}

async function fetchBundle(objectUrl, date, runtime, now) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs || 3_000);
  try {
    const response = await (runtime.fetchImpl || fetch)(objectUrl, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || Number(response.headers.get("content-length") || 0) > MAX_BUNDLE_BYTES) return null;
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BUNDLE_BYTES) return null;
    const bundle = JSON.parse(body);
    if (!isValidBundle(bundle, date)) return null;
    rememberBundle(objectUrl, bundle, now);
    return bundle;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSignalObjectCache(topic, date, env = {}, runtime = {}) {
  const baseUrl = normalizeBaseUrl(env.SIGNAL_CACHE_BASE_URL);
  const now = runtime.now instanceof Date ? runtime.now : new Date();
  if (!baseUrl || !SIGNAL_CACHE_TOPICS.includes(topic) || !isRecentDate(date, now)) return null;

  const objectUrl = `${baseUrl}/${date}.json`;
  const remembered = bundleMemory.get(objectUrl);
  if (!runtime.skipMemory && remembered && now.getTime() - remembered.savedAt <= CACHE_TTL_MS) {
    return { ...structuredClone(remembered.bundle.editions[topic]), cacheHit: true, cacheLayer: "oss" };
  }

  let request = bundleRequests.get(objectUrl);
  if (!request) {
    request = fetchBundle(objectUrl, date, runtime, now);
    bundleRequests.set(objectUrl, request);
    request.then(
      () => bundleRequests.delete(objectUrl),
      () => bundleRequests.delete(objectUrl),
    );
  }
  const bundle = await request;
  return bundle ? { ...structuredClone(bundle.editions[topic]), cacheHit: true, cacheLayer: "oss" } : null;
}
