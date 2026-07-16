# Fact Atlas · 技术概览

> **一句话定位：** Fact Atlas 是由 Gonka 去中心化 AI 推理网络驱动的事实核验与私人知识地图，也是一套面向公共知识版本的轻量混合式 DApp。

## 先看这四件事

1. **这是一个可验证的个人知识库。** 用户通过 Relay 主动提交主张，或从 Signals 的每日主题卡片中选择候选信息；所有内容经过证据核验与人工确认后进入 Atlas。
2. **所有语义推理统一经过 GonkaRouter。** Kimi-K2.6 负责调查，MiniMax-M2.7 负责质疑，两个模型的分歧会完整保留。
3. **Truth Score 由确定性代码计算。** 模型引用无效来源编号时会被拒绝；证据不足时分数向 50 收缩，并降低置信度。
4. **公共知识形成可验证的每日知识链。** 公开事实按日生成 Merkle Root，并通过 `previousEditionRoot` 连接前序版本；智能合约保存紧凑承诺与修订历史。

## 三个 Tab 组成一条知识闭环

| Tab | 核心职责 | 关键输出 |
| --- | --- | --- |
| **Relay · 探索** | 接收文字、公开链接或截图；检索公开证据；组织调查与质疑 | 来源账本、Truth Score、模型分歧、Gonka 回执 |
| **Atlas · 星图** | 保存经用户确认的核验快照；组织私人知识地图与公共 Chronicle | 私人事实节点、空间落位、Daily Edition、Merkle Proof |
| **Signals · 发现** | 主 Agent 调度八个主题子 Agent，每日发现值得关注的公开信息 | 日期化主题卡片、原始来源、重要性排序回执 |

知识路径保持一致：

```text
主动提交 / 每日发现
  → 公开证据检索
  → Kimi 调查
  → MiniMax 质疑
  → 确定性 Truth Score
  → 用户确认
  → Private Atlas 或 Public Chronicle
```

## Gonka 接入证据

- GonkaRouter 统一入口：[`server/gonka.mjs`](../server/gonka.mjs)
- 双模型核验流程：[`server/verify.mjs`](../server/verify.mjs)
- 确定性评分：[`server/scoring.mjs`](../server/scoring.mjs)
- Agent / Skill 编排：[`server/agent-architecture.mjs`](../server/agent-architecture.mjs)
- Signals 日期与主题引擎：[`server/signals.mjs`](../server/signals.mjs)

每次 Gonka 调用保留上游 response ID、模型名称、执行阶段、耗时和状态。Request ID 用于追溯推理调用，公开证据负责支撑事实结论。

## DApp 与知识链

Fact Atlas 采用链上承诺与链下证据相结合的实现方式：

### 链下

- 网页抓取、RSS 检索、截图和完整证据；
- Kimi / MiniMax 输入输出与 Gonka 回执；
- 确定性 Truth Score；
- 私人 Atlas、地点信息和 Mapbox 渲染；
- Signals 主题卡片与三日缓存。

### 链上

- 发布者地址；
- UTC 日期与同日修订号；
- `editionRoot` 与 `previousEditionRoot`；
- `manifestHash` 与 `policyRoot`；
- 事实数量与区块时间。

### 三层哈希

1. **ClaimKey**：根据用户确认的 canonical claim、可选地点范围与时间范围生成稳定事实身份；
2. **Record Hash**：绑定原始快照、证据根、回执根、评分规则、结论、分数、置信度和时间；
3. **Edition Root**：把当天所有公开记录组织成 Merkle Root，并连接上一版知识根。

同一天允许追加修订，旧版本继续保留。第三方可以使用 proof bundle 复算记录哈希、验证 Merkle inclusion proof，并与合约事件对照。

## 智能合约

合约：[`contracts/FactAtlasChronicle.sol`](../contracts/FactAtlasChronicle.sol)

`commitEdition` 会检查：

- 事实数量与根值有效；
- 日期位于允许区间；
- `previousEditionRoot` 等于发布者当前链头；
- 日期只能前进，或为当天追加 revision；
- 成功提交后发出 `EditionCommitted` 事件。

合约没有管理员、Token、质押和自动事实裁决。钱包承担公共版本发布者身份与交易签名；Private Atlas 无需钱包。

## 当前实现状态

| 能力 | 状态 | 入口 |
| --- | --- | --- |
| ClaimKey、Record Hash、Merkle Edition 与 Proof | 已实现并测试 | [`src/knowledge-chain.ts`](../src/knowledge-chain.ts) |
| 钱包与 Ethers v6 合约调用 | 已实现 | [`src/chronicle-chain.ts`](../src/chronicle-chain.ts) |
| Atlas Private / Public 入库流程 | 已实现 | [`src/atlas.ts`](../src/atlas.ts) |
| Chronicle 与 proof bundle UI | 已实现 | [`src/components/FactAtlas.tsx`](../src/components/FactAtlas.tsx) |
| Solidity 合约 | 已实现并可编译 | [`contracts/FactAtlasChronicle.sol`](../contracts/FactAtlasChronicle.sol) |
| Base Sepolia 部署脚本 | 已实现，强制 chain ID 84532 | [`scripts/deploy-chronicle.mjs`](../scripts/deploy-chronicle.mjs) |
| 测试链合约地址 | 当前公开构建未配置 | UI 显示 `Contract-ready` |

当前构建不会伪造链上状态。配置真实合约地址后，界面才会显示交易哈希、发布者地址、链 ID、合约地址与区块浏览器链接。

## 推荐阅读顺序

1. 打开 [在线 Demo](https://fact-atlas.throughtheglass.art)，依次查看 Relay、Atlas、Signals；
2. 阅读 [作品介绍与技术说明 Word 版](FactAtlas_作品介绍与技术说明_DApp深化版.docx)；
3. 查看 [`KNOWLEDGE_CHAIN.md`](KNOWLEDGE_CHAIN.md) 了解协议、隐私与威胁边界；
4. 检查 [`FactAtlasChronicle.sol`](../contracts/FactAtlasChronicle.sol) 与 [`knowledge-chain.ts`](../src/knowledge-chain.ts)；
5. 运行测试与构建：

```bash
npm test -- --run
npm run contract:compile
npm run build
```

## 核心边界

区块链记录发布者、时间、版本顺序和内容完整性。公开证据决定事实强度，模型分歧保持可见，确定性代码约束最终评分，用户保留入库与公开的最终决定权。
