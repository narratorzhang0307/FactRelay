import { Blocks, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Globe2, KeyRound, Link2, MapPin, Orbit, Search, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { requestJson } from "../api";
import {
  buildAtlasEditions,
  buildAtlasLinks,
  loadChronicleAnchors,
  loadAtlasNodes,
  removeAtlasNode,
  saveChronicleAnchor,
  saveAtlasNode,
  savePublicAtlasNode,
  subscribeAtlas,
  VERDICT_COLOR,
  type AtlasNode,
  type AtlasPlacement,
  type AtlasVisibility,
} from "../atlas";
import { commitDailyEdition, getChronicleConfiguration, hasInjectedWallet } from "../chronicle-chain";
import { shortHash, type DailyKnowledgeEdition } from "../knowledge-chain";
import type { VerificationResult } from "../types";

const AtlasMapboxGlobe = lazy(() => import("./AtlasMapboxGlobe").then((module) => ({ default: module.AtlasMapboxGlobe })));

interface GeocodeCandidate {
  id: string;
  label: string;
  lat: number;
  lng: number;
  precision: AtlasPlacement["precision"];
  source: string;
}

interface Props {
  currentResult: VerificationResult | null;
  onOpenResult: (result: VerificationResult) => void;
}

const VERDICT_LABEL = {
  supported: "Supported · 获支持",
  refuted: "Refuted · 事实不符",
  mixed: "Mixed · 证据混合",
  insufficient: "Insufficient · 证据不足",
} as const;

const ORBIT_POSITIONS = [
  { left: "12%", top: "20%" },
  { left: "80%", top: "16%" },
  { left: "85%", top: "70%" },
  { left: "14%", top: "76%" },
] as const;

function shortPlace(label: string): string {
  return label.split(",").slice(0, 2).join(", ").slice(0, 48);
}

export function FactAtlas({ currentResult, onOpenResult }: Props) {
  const [nodes, setNodes] = useState<AtlasNode[]>(loadAtlasNodes);
  const [selectedId, setSelectedId] = useState("");
  const [centerLng, setCenterLng] = useState(105);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [layer, setLayer] = useState<AtlasVisibility>("private");
  const [canonicalClaim, setCanonicalClaim] = useState(currentResult?.claim || "");
  const [saveBusy, setSaveBusy] = useState(false);
  const [editions, setEditions] = useState<DailyKnowledgeEdition[]>([]);
  const [editionBusy, setEditionBusy] = useState(false);
  const [selectedEditionRoot, setSelectedEditionRoot] = useState("");
  const [anchors, setAnchors] = useState(loadChronicleAnchors);
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [anchorMessage, setAnchorMessage] = useState("");
  const chainConfig = getChronicleConfiguration();

  useEffect(() => subscribeAtlas(() => setNodes(loadAtlasNodes())), []);
  const visibleNodes = useMemo(() => nodes.filter((node) => node.visibility === layer), [layer, nodes]);
  useEffect(() => {
    if (!selectedId && visibleNodes[0]) setSelectedId(visibleNodes[0].id);
    if (selectedId && !visibleNodes.some((node) => node.id === selectedId)) setSelectedId(visibleNodes[0]?.id || "");
  }, [selectedId, visibleNodes]);
  useEffect(() => {
    setCandidates([]);
    setLookupError("");
    setQuery(currentResult?.claim.toLowerCase().includes("great wall") ? "Great Wall of China" : "");
    setCanonicalClaim(currentResult?.claim || "");
  }, [currentResult?.id, currentResult?.claim]);

  useEffect(() => {
    let active = true;
    setEditionBusy(true);
    void buildAtlasEditions(nodes)
      .then((next) => {
        if (!active) return;
        setEditions(next);
        setSelectedEditionRoot((current) => next.some((edition) => edition.editionRoot === current) ? current : next.at(-1)?.editionRoot || "");
      })
      .finally(() => { if (active) setEditionBusy(false); });
    return () => { active = false; };
  }, [nodes]);

  const links = useMemo(() => buildAtlasLinks(visibleNodes), [visibleNodes]);
  const selected = visibleNodes.find((node) => node.id === selectedId) || null;
  const selectedEdition = editions.find((edition) => edition.editionRoot === selectedEditionRoot) || editions.at(-1) || null;
  const selectedAnchor = selectedEdition ? anchors.find((anchor) => anchor.editionRoot === selectedEdition.editionRoot) : null;
  const currentSaved = currentResult ? nodes.some((node) => node.id === currentResult.id) : false;
  const placedCount = visibleNodes.filter((node) => node.placement).length;
  const unplaced = visibleNodes.filter((node) => !node.placement);

  const rotate = (direction: -1 | 1) => setCenterLng((value) => {
    const next = value + direction * 30;
    return ((next + 180) % 360 + 360) % 360 - 180;
  });

  const lookup = async () => {
    if (query.trim().length < 2) return;
    setLookupBusy(true);
    setLookupError("");
    setCandidates([]);
    try {
      const payload = await requestJson<{ candidates: GeocodeCandidate[] }>(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const nextCandidates = Array.isArray(payload.candidates) ? payload.candidates : [];
      setCandidates(nextCandidates);
      if (!nextCandidates.length) setLookupError("No place matched. Save it unplaced or try a broader name. · 未找到地点，可留在轨道或换一个更宽泛的名称。");
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Place lookup failed. · 地点检索失败。");
    } finally {
      setLookupBusy(false);
    }
  };

  const store = async (placement: AtlasPlacement | null) => {
    if (!currentResult) return;
    setSaveBusy(true);
    try {
      const node = layer === "public"
        ? await savePublicAtlasNode(currentResult, placement, canonicalClaim)
        : saveAtlasNode(currentResult, placement);
      setNodes(loadAtlasNodes());
      setSelectedId(node.id);
      setStorageError("");
      if (placement) setCenterLng(placement.lng);
      setCandidates([]);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Fact Atlas could not save this node. · 知识节点保存失败。");
    } finally {
      setSaveBusy(false);
    }
  };

  const downloadEdition = (edition: DailyKnowledgeEdition) => {
    const blob = new Blob([JSON.stringify(edition, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fact-atlas-edition-${edition.date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const anchorEdition = async (edition: DailyKnowledgeEdition) => {
    setAnchorBusy(true);
    setAnchorMessage("");
    try {
      const transaction = await commitDailyEdition(edition);
      saveChronicleAnchor({
        editionRoot: edition.editionRoot,
        txHash: transaction.txHash,
        chainName: transaction.chainName,
        contractAddress: transaction.contractAddress,
        publisher: transaction.account,
        anchoredAt: new Date().toISOString(),
      });
      setAnchors(loadChronicleAnchors());
      setAnchorMessage(`Edition anchored: ${shortHash(transaction.txHash)} · 每日版本已上链`);
    } catch (error) {
      setAnchorMessage(error instanceof Error ? error.message : "Chronicle transaction failed. · 知识链交易失败。");
    } finally {
      setAnchorBusy(false);
    }
  };

  const removeSelected = () => {
    if (!selected) return;
    try {
      removeAtlasNode(selected.id);
      setNodes(loadAtlasNodes());
      setStorageError("");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Fact Atlas could not remove this node. · 知识节点删除失败。");
    }
  };

  return (
    <section className="atlas-section" id="atlas" aria-labelledby="atlas-title">
      <header className="atlas-heading">
        <div>
          <span className="hero-eyebrow"><Orbit size={14} /> Fact Atlas · 知识星球</span>
          <h2 id="atlas-title">Verify a claim. <em>Place only what survives.</em></h2>
          <p>Keep private knowledge on-device, or publish a user-approved daily evidence commitment. The chain preserves integrity and revision order; evidence still decides the fact. · 私人知识留在设备；明确公开的事实才进入每日知识链。链记录完整性与修订顺序，事实仍由证据决定。</p>
        </div>
        <div className="atlas-stats" aria-label="Fact Atlas statistics">
          <div><strong>{visibleNodes.length}</strong><span>{layer === "public" ? "Public facts" : "Private facts"}<br />{layer === "public" ? "公共事实" : "私人事实"}</span></div>
          <div><strong>{placedCount}</strong><span>Placed<br />已落位</span></div>
          <div><strong>{layer === "public" ? editions.length : links.length}</strong><span>{layer === "public" ? "Daily editions" : "Explainable links"}<br />{layer === "public" ? "每日版本" : "可解释关系"}</span></div>
        </div>
      </header>

      {storageError && <p className="atlas-storage-error" role="alert">{storageError}</p>}

      <div className="atlas-grid">
        <div className="atlas-globe-card">
          <div className="atlas-toolbar">
            <span><Globe2 size={15} /> {layer === "public" ? "Public Chronicle · 公共知识链" : "Private knowledge globe · 私人知识地球"}</span>
            <div>
              <div className="atlas-layer-switch" role="group" aria-label="Atlas visibility layer · 星图可见性层">
                <button type="button" className={layer === "private" ? "active" : ""} onClick={() => setLayer("private")}><KeyRound size={13} /> Private · 私人</button>
                <button type="button" className={layer === "public" ? "active" : ""} onClick={() => setLayer("public")}><Blocks size={13} /> Chronicle · 知识链</button>
              </div>
              <button type="button" onClick={() => rotate(-1)} aria-label="Rotate globe left · 向左旋转"><ChevronLeft size={17} /></button>
              <code>{centerLng >= 0 ? `${Math.round(centerLng)}°E` : `${Math.abs(Math.round(centerLng))}°W`}</code>
              <button type="button" onClick={() => rotate(1)} aria-label="Rotate globe right · 向右旋转"><ChevronRight size={17} /></button>
            </div>
          </div>

          <div className="atlas-globe-wrap">
            <Suspense fallback={<div className="atlas-mapbox-fallback"><div className="atlas-fallback-sphere" /><Orbit size={20} /><strong>Loading dark knowledge globe… · 正在加载深色知识地球</strong></div>}>
              <AtlasMapboxGlobe nodes={visibleNodes} links={links} selectedId={selectedId} centerLng={centerLng} onSelect={setSelectedId} />
            </Suspense>

            {unplaced.length > 0 && (
              <div className="atlas-orbit" aria-label="Unplaced facts · 未落位事实">
                {unplaced.slice(0, 4).map((node, index) => (
                  <button key={node.id} type="button" style={ORBIT_POSITIONS[index]} onClick={() => setSelectedId(node.id)} title={node.result.claim}>
                    {node.result.truthScore}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="atlas-legend">
            {Object.entries(VERDICT_COLOR).map(([verdict, color]) => <span key={verdict}><i style={{ background: color }} />{VERDICT_LABEL[verdict as keyof typeof VERDICT_LABEL]}</span>)}
          </div>
        </div>

        <div className="atlas-side">
          <article className="atlas-save-card">
            <span className="block-stamp"><span>NEW NODE · 新节点</span><code>{currentResult ? currentResult.id.slice(-10).toUpperCase() : "NO CASE"}</code></span>
            <h3>{currentSaved ? "This case is in your Atlas." : "Place the current case."}<small>{currentSaved ? "当前案例已进入知识星球。" : "把当前核验结果放入知识星球。"}</small></h3>
            {currentResult ? (
              <>
                <p className="atlas-current-claim">{currentResult.claim}</p>
                <div className="atlas-current-meta"><span style={{ background: VERDICT_COLOR[currentResult.verdict] }}>{currentResult.truthScore}</span><strong>{VERDICT_LABEL[currentResult.verdict]}</strong><small>{currentResult.mode === "live" ? "Live receipts preserved · 已保留真实回执" : "Preview fixture · 预览样例"}</small></div>
                <div className="atlas-visibility-choice" role="group" aria-label="Save visibility · 保存可见性">
                  <button type="button" className={layer === "private" ? "active" : ""} onClick={() => setLayer("private")}><KeyRound size={14} /><span><strong>Private Atlas</strong><small>Device only · 仅当前设备</small></span></button>
                  <button type="button" className={layer === "public" ? "active" : ""} onClick={() => setLayer("public")} disabled={currentResult.mode !== "live"}><Blocks size={14} /><span><strong>Public Chronicle</strong><small>User-approved commitment · 用户确认后发布</small></span></button>
                </div>
                {layer === "public" && (
                  <label className="atlas-canonical-field" htmlFor="atlas-canonical-claim">
                    Canonical claim · 规范主张
                    <textarea id="atlas-canonical-claim" value={canonicalClaim} onChange={(event) => setCanonicalClaim(event.target.value)} rows={3} />
                    <small>ClaimKey tolerates formatting changes only. Confirm equivalent wording yourself. · ClaimKey 只忽略格式差异；同义改写需由你确认。</small>
                  </label>
                )}
                <form onSubmit={(event) => { event.preventDefault(); void lookup(); }} className="atlas-place-form">
                  <label htmlFor="atlas-place">Place name · 地点名称</label>
                  <div><input id="atlas-place" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Great Wall of China / 中国长城" /><button type="submit" disabled={lookupBusy || query.trim().length < 2}><Search size={15} />{lookupBusy ? "…" : "Find · 查找"}</button></div>
                </form>
                {lookupError && <p className="atlas-lookup-error">{lookupError}</p>}
                {candidates.length > 0 && <div className="atlas-candidates">{candidates.map((candidate) => (
                  <button key={candidate.id} type="button" disabled={saveBusy} onClick={() => void store({ label: candidate.label, lat: candidate.lat, lng: candidate.lng, precision: candidate.precision, confirmedByUser: true })}>
                    <MapPin size={15} /><span><strong>{shortPlace(candidate.label)}</strong><small>{candidate.lat.toFixed(4)}, {candidate.lng.toFixed(4)} · {candidate.source}</small></span><Check size={15} />
                  </button>
                ))}</div>}
                <button type="button" className="atlas-unplaced-button" disabled={saveBusy} onClick={() => void store(null)}><Orbit size={15} />{saveBusy ? "Building commitment… · 正在生成承诺" : "Save unplaced · 暂不落位"}</button>
              </>
            ) : <p className="atlas-no-case">Run or open a verification first. · 请先运行或打开一个核验案例。</p>}
          </article>

          <article className="atlas-node-card">
            <span className="block-stamp"><span>SELECTED · 已选节点</span><code>{selected ? selected.savedAt.slice(0, 10) : "EMPTY"}</code></span>
            {selected ? (
              <>
                <div className="atlas-node-score" style={{ background: VERDICT_COLOR[selected.result.verdict] }}><strong>{selected.result.truthScore}</strong><span>/100</span></div>
                <h3>{selected.result.claim}</h3>
                <p>{selected.result.summary}</p>
                <div className="atlas-node-facts">
                  <span>{selected.visibility === "public" ? <Blocks size={13} /> : <KeyRound size={13} />}{selected.visibility === "public" ? "Public Chronicle · 公共知识链" : "Private on device · 设备私有"}</span>
                  <span><MapPin size={13} />{selected.placement ? shortPlace(selected.placement.label) : "Unplaced orbit · 未落位轨道"}</span>
                  <span><ExternalLink size={13} />{selected.result.sources.length} sources · 来源</span>
                  <span><Orbit size={13} />{selected.result.trace.filter((step) => step.requestId).length} Gonka receipts · 回执</span>
                  {selected.commitment && <span><ShieldCheck size={13} />Record {shortHash(selected.commitment.recordHash)} · 记录指纹</span>}
                </div>
                <div className="atlas-node-actions">
                  <button type="button" onClick={() => onOpenResult(selected.result)}>Open evidence chain · 打开证据链</button>
                  <button type="button" aria-label="Remove fact node · 删除事实节点" onClick={removeSelected}><Trash2 size={15} /></button>
                </div>
              </>
            ) : <p className="atlas-no-case">Your private Atlas is empty. Saving a fact stores its full evidence snapshot in this browser. · 你的私人知识星球还是空的；保存后，完整证据快照只留在当前浏览器。</p>}
          </article>
        </div>
      </div>

      <section className="chronicle-board" aria-labelledby="chronicle-title">
        <header>
          <div>
            <span className="hero-eyebrow"><Link2 size={14} /> Daily Knowledge Chain · 每日知识链</span>
            <h3 id="chronicle-title">One public day, one verifiable edition.</h3>
            <p>Public facts are grouped by date. Every edition links its facts root, manifest, score policy and previous edition root. Revisions append; history is never silently overwritten. · 公共事实按日期组成每日版本，修订只追加，不静默覆盖历史。</p>
          </div>
          <div className="chronicle-trust-note"><ShieldCheck size={19} /><span><strong>Integrity, not an oracle.</strong><small>证明内容与顺序未被篡改，不替代事实判断。</small></span></div>
        </header>

        <div className="chronicle-layout">
          <nav className="chronicle-timeline" aria-label="Daily editions · 每日版本">
            {editionBusy && <span className="chronicle-empty">Building local roots… · 正在生成本地根</span>}
            {!editionBusy && editions.length === 0 && <span className="chronicle-empty">Publish a live verified fact to start the chain. · 将一条真实核验事实设为公开，开始知识链。</span>}
            {[...editions].reverse().map((edition, index) => (
              <button key={edition.editionRoot} type="button" className={selectedEdition?.editionRoot === edition.editionRoot ? "active" : ""} onClick={() => setSelectedEditionRoot(edition.editionRoot)}>
                <span>{String(editions.length - index).padStart(2, "0")}</span>
                <strong>{edition.date}</strong>
                <small>{edition.factCount} facts · {edition.factCount} 条事实</small>
                <i />
              </button>
            ))}
          </nav>

          <article className="chronicle-edition-card">
            {selectedEdition ? (
              <>
                <div className="chronicle-edition-head"><span>DAILY EDITION · 每日版本</span><code>{selectedEdition.date}</code></div>
                <div className="chronicle-edition-number"><strong>{String(editions.findIndex((edition) => edition.editionRoot === selectedEdition.editionRoot) + 1).padStart(2, "0")}</strong><span><b>{selectedEdition.factCount}</b> FACT COMMITMENTS<br />事实承诺</span></div>
                <dl className="chronicle-hashes">
                  <div><dt>Edition root · 版本根</dt><dd>{shortHash(selectedEdition.editionRoot, 12, 10)}</dd></div>
                  <div><dt>Facts root · 事实根</dt><dd>{shortHash(selectedEdition.factsRoot, 12, 10)}</dd></div>
                  <div><dt>Manifest · 清单</dt><dd>{shortHash(selectedEdition.manifestHash, 12, 10)}</dd></div>
                  <div><dt>Previous · 前序</dt><dd>{shortHash(selectedEdition.previousEditionRoot, 12, 10)}</dd></div>
                </dl>
                <div className="chronicle-actions">
                  <button type="button" onClick={() => downloadEdition(selectedEdition)}><Download size={15} /> Export proof bundle · 导出证明包</button>
                  <button type="button" className="chronicle-anchor-button" disabled={!chainConfig.ready || !hasInjectedWallet() || anchorBusy || Boolean(selectedAnchor)} onClick={() => void anchorEdition(selectedEdition)}><WalletCards size={15} />{selectedAnchor ? "Anchored · 已上链" : anchorBusy ? "Confirming… · 等待确认" : "Anchor edition · 发布版本"}</button>
                </div>
                <p className="chronicle-contract-status"><i className={chainConfig.ready ? "ready" : ""} />{chainConfig.ready ? `${chainConfig.chainName} · ${shortHash(chainConfig.contractAddress)}` : "Contract-ready; deployment address not configured in this build. · 合约已可编译，当前构建尚未配置部署地址。"}</p>
                {selectedAnchor && <p className="chronicle-anchor-receipt"><ShieldCheck size={14} /> TX {shortHash(selectedAnchor.txHash, 10, 8)} · {selectedAnchor.chainName}</p>}
                {anchorMessage && <p className="chronicle-anchor-message">{anchorMessage}</p>}
              </>
            ) : <div className="chronicle-card-empty"><Blocks size={30} /><strong>No public edition yet.</strong><span>Private Atlas nodes remain completely separate. · 私人节点与公共知识链完全分离。</span></div>}
          </article>

          <aside className="chronicle-proof-stack">
            <h4>Three commitments · 三层承诺</h4>
            <div><span>01</span><strong>ClaimKey</strong><small>规范事实身份；只消除标点、大小写和空格差异。</small></div>
            <div><span>02</span><strong>Snapshot Hash</strong><small>精确快照指纹；任何证据、分数或回执变化都会改变。</small></div>
            <div><span>03</span><strong>Edition Root</strong><small>每天的 Merkle 根，并链接上一版本形成知识链。</small></div>
          </aside>
        </div>
      </section>
    </section>
  );
}
