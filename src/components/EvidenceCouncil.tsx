import { Archive, ArrowRight, BrainCircuit, CheckCircle2, Fingerprint, Gavel, Search, ShieldCheck } from "lucide-react";
import type { ModelVerdict, VerificationResult } from "../types";

interface Props {
  result: VerificationResult | null;
  onGoRelay: () => void;
  onGoAtlas: () => void;
}

const VERDICT = {
  supported: "Supported · 获支持",
  refuted: "Refuted · 事实不符",
  mixed: "Mixed · 证据混合",
  insufficient: "Insufficient · 证据不足",
} as const;

function shortModel(model: string): string {
  return model.split("/").pop() || model;
}

function ModelRole({ model, title, titleZh, number }: { model: ModelVerdict; title: string; titleZh: string; number: string }) {
  return (
    <article className={`council-role council-model council-${number}`}>
      <div className="council-role-top"><span>{number}</span><BrainCircuit size={18} /></div>
      <small>{title} · {titleZh}</small>
      <h3>{shortModel(model.model)}</h3>
      <p>{model.summary}</p>
      <ul>{model.reasoning.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>
      <div className="council-receipt"><Fingerprint size={14} /><span>Gonka Request ID · Gonka 回执</span><code>{model.requestId || "Preview: no fabricated ID · 预览不伪造回执"}</code></div>
      <footer><strong>{VERDICT[model.verdict]}</strong><span>{model.confidence}% confidence · 信心</span></footer>
    </article>
  );
}

export function EvidenceCouncil({ result, onGoRelay, onGoAtlas }: Props) {
  const investigator = result?.models[0];
  const skeptic = result?.models[1];
  return (
    <section className="council-section" aria-labelledby="council-title">
      <header className="council-heading">
        <div>
          <span className="hero-eyebrow"><Gavel size={14} /> Evidence Council · 证据法庭</span>
          <h2 id="council-title">Fewer agents. <em>Sharper responsibilities.</em></h2>
          <p>书记员只收集公开证据，Kimi 负责调查，MiniMax 专门质疑；最后由用户决定是否写入知识星球。不是一群聊天机器人，而是一条有边界的验证程序。</p>
        </div>
        <div className="council-boundary"><ShieldCheck size={18} /><span>All AI roles run through Gonka Router.<small>所有 AI 角色仅通过 Gonka Router。</small></span></div>
      </header>

      <div className="council-flow" aria-label="Evidence Council execution flow">
        <span><b>01</b> Clerk · 书记员</span><ArrowRight size={16} />
        <span><b>02</b> Investigator · 调查</span><ArrowRight size={16} />
        <span><b>03</b> Skeptic · 质疑</span><ArrowRight size={16} />
        <span><b>04</b> Human gate · 用户确认</span>
      </div>

      {result ? (
        <>
          <div className="council-casebar">
            <span>Current hearing · 当前审理</span>
            <strong>{result.claim}</strong>
            <div><b>{result.truthScore}</b><small>/100<br />{VERDICT[result.verdict]}</small></div>
          </div>
          <div className="council-grid">
            <article className="council-role council-clerk">
              <div className="council-role-top"><span>01</span><Search size={18} /></div>
              <small>EVIDENCE CLERK · 证据书记员</small>
              <h3>Public retrieval, no AI opinion</h3>
              <p>检索公开网页与 RSS，去重并编号；只建立模型可引用的来源账本，不参与结论。</p>
              <div className="council-clerk-stats"><strong>{result.sources.length}</strong><span>retrievable sources<br />可追溯来源</span><strong>{new Set(result.sources.map((source) => source.publisher)).size}</strong><span>publishers<br />发布者</span></div>
              <footer><span>Deterministic step · 确定性步骤</span></footer>
            </article>
            {investigator && <ModelRole model={investigator} number="02" title="INVESTIGATOR" titleZh="调查方" />}
            {skeptic && <ModelRole model={skeptic} number="03" title="SKEPTIC" titleZh="质疑方" />}
            <article className="council-role council-gate">
              <div className="council-role-top"><span>04</span><CheckCircle2 size={18} /></div>
              <small>HUMAN GATE · 用户确认门</small>
              <h3>Nothing enters the Atlas automatically.</h3>
              <p>结论、证据和回执先保持可检查；地点必须由用户确认。无可靠地点时进入未落位轨道，而不是随机钉在地球上。</p>
              <div className="council-gate-actions"><button type="button" onClick={onGoAtlas}><Archive size={15} /> Place in Atlas · 写入星图</button><button type="button" onClick={onGoRelay}>Open full chain · 打开证据链</button></div>
            </article>
          </div>
        </>
      ) : (
        <div className="council-empty"><Gavel size={28} /><h3>No case is before the Council.</h3><p>先在 FactRelay 提交一条主张，再回来查看每个角色的证据、质疑与回执。</p><button type="button" onClick={onGoRelay}>Start a verification · 开始核验</button></div>
      )}
    </section>
  );
}
