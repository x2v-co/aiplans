# 2026 年 4 月 AI 编程订阅怎么选：4 款深度实测 + 3 款调研

> **披露**：本文提到的 7 款产品里，部分链接含我的推荐码，你通过我的链接订阅，双方都会拿到折扣（不影响我对产品的评价）。4 款是我亲手在项目里跑了至少两周的"实测"，3 款是我只看过文档、定价、口碑的"调研"，每张卡片上会明确标注。
>
> 作者：**此方一泉**（agent 开发者） · 发布日期：2026-04-22 · 数据底座：[aiplans.dev](https://aiplans.dev)

---

## TL;DR（30 秒读完）

- **Claude Code 重度用户、天天撞配额** → **Claude Max 20x（$200/月）**。每天被 Pro 档 5 小时窗口卡 ≥ 2 次的人，Max 20x 一个月回本。
- **想用上最新的 GLM-5 + Qwen3.5** → **阿里云百炼 Coding Plan Pro（¥200/月，90k 请求/月）**。2026 年 4 月国内唯一直连 GLM-5 / Qwen3.5 的聚合订阅（火山还停在 GLM-4.7 整整落后一代）。配额紧张，**建议早上抢**。
- **agent 开发者、需要并行开 2-3 个 agent** → **MiniMax Token Plan Max（¥119/月）**。M2.7 按 agent 并发数标价，接 Claude Code / Cursor / Codex CLI 都能跑。
- **想要"Claude Code 外壳 + 国产模型"组合** → **GLM Coding Plan（z.ai，$3-30/月）**。
- **免费方案、预算 = ¥0** → **Gemini Code Assist 个人版（每天 6000 次补全 + 240 次对话）**，主力撞配额时当兜底。
- **想一张卡搞定 AI 对话 + 写代码** → **ChatGPT Plus + Codex（$20/月）**。
- **字节生态或需要国内合规** → **火山引擎（豆包 / Seed）**。

---

## 方法论：实测 vs 调研，我区分得很清楚

市面上大多数"AI 编程订阅对比"文章有两个通病：一是把没用过的产品也写得头头是道，二是把月付价写出来就完事，从不提"实际能跑多少次请求"和"撞上限时是什么体验"。我这篇至少先把前一个问题解决。

- **实测（4 款）**：我本人在真实项目里连续使用 ≥ 2 周，至少撞过一次配额上限，至少遇到过一个踩坑点。卡片里的"实测额度 / 踩坑点"一栏是我自己的使用记录。
- **调研（3 款）**：我没订阅，但我查了官方文档、官方定价页、至少 5 条社区反馈，并在 aiplans.dev 上交叉对比了 API 价格。卡片会明确标注"未亲测"。

所有价格数据截至 2026-04-22，由 [aiplans.dev](https://aiplans.dev) 的 scraper 每天从官方页面抓取。如果你发现某个数字对不上，说明官方又改价了，评论区告诉我，我当天更新。

**我为什么是我**：我是 agent 开发者，过去一年大部分时间在写 AI agent 相关的业务代码和工具链。4 款实测的选品全部以"能不能稳定跑 agent"为第一标准，不是"能不能写漂亮的 hello world"。所以本文对 agent 场景的判断会比通用型对比文更具体，代价是：如果你的需求是"补全一下 HTML 组件"，本文的推荐顺序可能跟你感觉不一样。

---

## 4 款实测

### 1. Claude Max 20x【实测】

- **月成本（2026-04 [官方定价](https://claude.com/pricing)）**：Max **起步 $100/月（Max 5x）/ $200/月（Max 20x）**；作为参照 Pro $17/月（年付）或 $20/月（月付）。本文重点聊 Max 20x。
- **实测额度**：Claude Code 每天跑 8 小时 agent 场景，连续两周只撞过 2 次 5 小时窗口上限。相比之下 Pro $20 档平均每 4-5 小时就撞一次。
- **踩坑点**：① Max 20x **不是无限**，官方 5 小时滚动窗口依然存在，只是配额是 Pro 的 20 倍；② 每天跑 > 10 小时 agent 的重度用户，月底最后一周仍可能触顶；③ 同一账号多终端并行跑任务会更快烧完窗口；④ **Max 5x（$100）是被很多人忽略的档位** —— 如果你每天被 Pro 卡 1-2 次但到不了"天天撞墙"的程度，Max 5x 可能比 Max 20x 更合适，不用硬上 $200。
- **推荐人群**：Claude Code 重度用户、每天被 Pro 档配额卡 ≥ 2 次的人、需要极致代码能力（尤其 Go / Python / Rust 重构场景）的 agent 开发者。如果你每天只用 1-2 小时，Pro 就够了，Max 20x 是亏的。
- **为什么我选它不选 API**：Max 订阅对"跑代码 + 读仓库"这种重 token 场景有隐性补贴，同样工作量用 API 打账单通常是订阅价的 2-3 倍。
- **推荐链接**：[/go/v2ex/2026-04-coding-plans/claude-max](https://aiplans.dev/go/v2ex/2026-04-coding-plans/claude-max)
- **aiplans.dev 截图**：{{TODO：Claude Pro / Max / Max 20x 三档对比截图（aiplans.dev 更新后贴）}}

### 2. GLM Coding Plan（z.ai 海外版 / 智谱国内版）【实测】

- **月成本（2026-04 官方数据）**：**海外版 z.ai**：Lite 起步 $18/月（Pro / Max 档更高，官方未公开具体数字，实际定价看 [z.ai 订阅页](https://z.ai/subscribe)）；**国内版智谱**：档位类似但人民币定价。
- **实测额度（z.ai 官方公布的 prompt 配额）**：Lite ~80 prompts/5h · ~400/周；Pro ~400 prompts/5h · ~2000/周；Max ~1600 prompts/5h · ~8000/周。**官方文档明确注："1 个 prompt 会触发 15-20 次模型调用"**，这意味着实际 API 调用量是 prompt 数的 15-20 倍 —— 这个口径在其他订阅里是看不到的。
- **模型池（2026-04 当前）**：**GLM-5.1、GLM-5-Turbo、GLM-4.7、GLM-4.5-Air**。GLM-5.1 是当前顶级档，在 z.ai 上**比阿里云百炼的 GLM-5 还领先一个小版本**（这是 z.ai 作为智谱原厂海外的优势），代价是海外版价格比国内智谱贵 1.5-2 倍。
- **踩坑点**：① **国内版也要抢** —— 智谱国内 GLM Coding Plan 开订阅偶发排队，高峰期要跟百炼 Coding Plan 一起早上开；② **海外版 z.ai 贵不少** —— 同档位海外约是国内版的 1.5-2 倍，不刚需海外直连请优先国内版；③ "1 prompt = 15-20 次调用"这个乘数是所有同类产品里口径最**诚实**的，但新手容易低估"一次 Claude Code 会话能烧多少 prompts"；④ 长上下文（> 64K）偶发截断；⑤ 首 token 延迟海外节点偶发 > 2s（国内版无感）。
- **推荐人群**：个人开发者、想把 Claude Code 当"GLM 外壳"用的人、**要用上 GLM-5.1 最前沿模型的原厂用户**。我给 3 个朋友推过 z.ai Pro，3 个都续订了第二个月。
- **怎么接 Claude Code**：设置 `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_SONNET_MODEL` 等环境变量到 z.ai 的 GLM 模型上（具体 key-value 见 z.ai [devpack 文档](https://docs.z.ai/devpack/overview)），3 分钟完成，不改一行业务代码。**不是 `ANTHROPIC_BASE_URL` 一个变量就行，这是很多人踩坑的地方**。
- **国内 vs 海外怎么选**：身在国内刚需最前沿 GLM-5.1 且能接受海外节点延迟 → z.ai；国内直连不追最新小版本 → 阿里云百炼 Coding Plan（¥200 带 GLM-5 + 其他三家模型，性价比更高）；只想便宜试水国产模型 → 智谱国内版。
- **推荐链接**：[/go/v2ex/2026-04-coding-plans/glm](https://aiplans.dev/go/v2ex/2026-04-coding-plans/glm)
- **aiplans.dev 截图**：{{TODO：智谱国内版 vs z.ai 海外版价差对比截图}}

### 3. 阿里云百炼 Coding Plan Pro【实测】

- **月成本**：Pro **¥200/月**（Lite ¥40 档已于 2026-03-20 停售，新用户直接 Pro）
- **实测额度**：6000 次请求 / 5 小时，45000 次 / 周，90000 次 / 月 —— **三层配额叠加**，月底不怕突然撞墙。
- **模型池（这是它最强的点）**：一个订阅里可切换 **GLM-5、Qwen3.5-Plus、Qwen3-Max、Qwen3-Coder-Plus、Qwen3-Coder-Next、Kimi-K2.5、MiniMax-M2.5**。写 Go 用 Qwen3-Coder，大 repo 重构用 GLM-5，Agent 链路用 MiniMax，同一个 API Key。
- **决定性优势**：**这是 2026 年 4 月国内市场唯一能直接用上 GLM-5 + Qwen3.5 这批最新模型的订阅**。对比同类聚合型产品（比如火山引擎），百炼的模型池比火山领先**整整一代**（火山还停在 GLM-4.7）。Agent 工作流里"能不能用最新模型"的差距，比便宜 ¥50 重要得多。
- **踩坑点**：① **模型是限量抢的，早上最稳**（GLM-5 和 Qwen3.5 高峰期会排队甚至购买受限，我自己的经验是北京时间早 9-11 点开新订阅最顺利，下午容易撞配额紧张）；② 模型需要在请求里显式指定 `model: glm-5` 这种，没写就走默认，不同模型响应速度差 2-3 倍；③ 聚合型产品偶发**模型更新延迟** —— 但百炼这点做得还行，GLM-5 基本跟智谱原厂同步上线；④ Lite ¥40 档已停售，新用户只能 ¥200 起步，首月有 ¥39.9 的新客券可以拿；⑤ 聚合模型不完全等于原厂直连，长上下文场景偶发小幅衰减（我 128K 上下文做过对比，百炼 GLM-5 vs 智谱原厂 GLM-5 有约 5% 指令遵循差异，日常任务无感）。
- **推荐人群**：**想用上最新模型又不想开多个订阅的人**、Qwen 深度用户、国内团队（直连，无代理）、做多模型 benchmark 的技术团队。
- **为什么这是 2026 年 4 月最被低估的订阅**：市场还在把它当"通义灵码企业版"的同义词，实际上它是 **2026 年 2 月新推的独立产品**，打法像 OpenRouter（聚合 + 自由切换），但国内直连 + 统一配额 + **最快上架新模型**。阿里云营销不擅长 to B 开发者，所以知道的人不多。
- **推荐链接**：[/go/v2ex/2026-04-coding-plans/aliyun-coding-plan](https://aiplans.dev/go/v2ex/2026-04-coding-plans/aliyun-coding-plan)
- **aiplans.dev 截图**：{{TODO：阿里云百炼 Coding Plan Pro 定价 + 模型池截图（数据更新后贴）}}

### 4. MiniMax Token Plan【实测】

- **月成本**：Starter ¥29 / Plus ¥49 / Plus-极速版 ¥98 / Max ¥119 / Max-极速版 ¥199（Ultra ¥899 当前售罄）
- **实测额度**：Max 档 **4500 次模型调用 / 5 小时**，周配额 = 每 5h × 10。我在 Max 档稳定开 2-3 个 OpenClaw agent 并行写代码 + 生成图像（M2.7 全模态，一个 Key 同时要文本 / 图像 / 语音 / 视频），连续 10 天没撞过配额。
- **踩坑点**：① "模型调用次数"的口径 ≠ token 数 —— agent 工具调用频繁时，单次"调用"可能很轻，反而比按 token 计费更友好；② Plus 档（1500 次/5h）跑 **单** agent 够用，**并行开 2 个以上就容易撞**，建议直接上 Max；③ 必须把模型切换成 `MiniMax-M2.7` 或 `M2.7-highspeed`，默认模型**不在 Token Plan 计费范围内**（新手常踩）；④ 极速版（-highspeed）走独立推理资源，约 100 TPS，比标准档的 50 TPS 快一倍但贵一倍。
- **推荐人群**：**agent 开发者**、需要"1 Key 搞定全模态"的独立开发者、对"便宜 + 速度快"都要的 Claude Code / Codex CLI / Cursor 用户（这 10+ 工具官方都接了）。
- **为什么我把它放进实测名单**：2026 年 4 月国产订阅里，MiniMax 是**唯一**明确按"并行 agent 数"标定档位的订阅（Plus 1-2 个 / Max 2-3 个 / Ultra 4-5 个）—— 对 agent 开发者来说这个口径比 "X 次请求" 更有决策价值。
- **推荐链接**：[/go/v2ex/2026-04-coding-plans/minimax](https://aiplans.dev/go/v2ex/2026-04-coding-plans/minimax)
- **aiplans.dev 截图**：{{TODO：MiniMax 6 档订阅定价截图 + 与 abab API 对比}}

---

## 3 款调研（未亲测，以下数据来自官方 + 社区）

### 5. ChatGPT Plus + Codex【调研】

- **月成本**：Plus $20 / Pro $200（Codex 是功能，不是独立订阅）
- **已知额度**：Plus 账户每天能跑的 Codex agent 任务数近期从 50 放宽到 ~150（OpenAI 社区帖，2026-04）。Pro 档基本不设硬上限。
- **调研结论**：如果你本来就订 ChatGPT Plus（非编程场景），Codex 等于白送；但如果你只为写代码订 ChatGPT Plus，比起 Claude Pro / Claude Max，Codex 目前在大型 repo 重构这类任务上仍落后半代。
- **谁适合**：ChatGPT 深度用户、需要一张卡同时覆盖"写文案 + 写代码"的独立开发者。
- **谁不适合**：纯做代码的人 —— Claude Max / GLM / MiniMax 都更合算。
- **推荐链接**：[/go/v2ex/2026-04-coding-plans/codex](https://aiplans.dev/go/v2ex/2026-04-coding-plans/codex)

### 6. Gemini Code Assist + Gemini CLI【调研】

- **月成本（2026-04 [官方定价](https://codeassist.google/)）**：个人版 **免费**；Standard **$19/user/月（年付）或 $22.80（月付）**；Enterprise **$45/user/月（年付）或 $54（月付）**。
- **已知额度**：**个人免费版每天 6000 次代码补全 + 240 次对话**（是的没看错，6000，不是 60），跑几乎任何个人 side project 不可能撞上限；Standard 每天 1500 次模型请求（CLI + Agent Mode 共享配额）；Enterprise 2000 次/天。
- **模型**：当前基于 Gemini 2.5；**所有档位都可以加 Gemini 3 的 waitlist**（Enterprise 档 Gemini 3 "Preview 即将发布"，个人免费档可能要更晚）。
- **调研结论**：**免费档是全网最大的"稳定能用的 coding 免费订阅"**，6000 次/天的补全额度在 2026 年 4 月没有对手。Standard/Enterprise 对团队来说性价比一般（不如 Copilot Business 划算），但如果你本身在 GCP / Workspace 生态里，Gemini Code Assist 是零摩擦入口。Enterprise 独占功能包括连接私有 GitHub / GitLab / Bitbucket 代码库。
- **谁适合**：Google 生态团队、**所有个人开发者都该装一个（免费）**、需要在 Jupyter / Colab / BigQuery 里直接用 AI 的数据团队。
- **谁不适合**：重度 agent 工作流用户 —— Gemini CLI 目前更像"大号 AI 补全"，不是 Claude Code / Codex CLI 级别的 agent 产品。
- **推荐链接**：[/go/v2ex/2026-04-coding-plans/gemini](https://aiplans.dev/go/v2ex/2026-04-coding-plans/gemini)

### 7. 火山引擎（豆包 / Seed + 第三方模型）【调研】

- **月成本**：没有固定月订阅，走 Token 计费（豆包编程 Pro 约 ¥0.0008/1K tokens 输入，具体看[火山引擎官方价格页](https://www.volcengine.com/product/doubao)）
- **已知特性**：豆包 Pro 1.5、Seed 系列模型已覆盖大部分 coding 场景；Trae IDE 打通后可在国内直连使用，延迟明显低于海外模型。火山也聚合了一批第三方模型（GLM、Qwen 等）。
- **关键短板（也是我把它放到最后的原因）**：**火山的第三方模型池明显落后**。2026 年 4 月阿里云百炼已经上了 **GLM-5 + Qwen3.5**，火山还停留在 **GLM-4.7 + Qwen3-Max**，整整落后一代。对追求最新模型能力的 agent 开发者来说，这个差距是决定性的 —— 你在火山上跑的 GLM-4.7 Agent，在百炼上能跑 GLM-5，效果不在一个档次。
- **调研结论**：火山引擎的打法不是"卖订阅"，是"卖 Token + 生态锁定"。如果你的 Team 已经在字节生态（Trae / 豆包 API），火山引擎是最省事的那个选择；如果你在挑第三方模型聚合订阅，**百炼 Coding Plan 在 2026 年 4 月是更好的选择**。
- **谁适合**：已经在用 Trae IDE 的团队、字节合作方、需要国内低延迟 + 合规的企业（但前提是不追求最新模型）。
- **谁不适合**：想用 GLM-5 / Qwen3.5 / Kimi-K2.5 等最新国产顶级模型的 agent 开发者。
- **推荐链接**：[/go/v2ex/2026-04-coding-plans/volcengine](https://aiplans.dev/go/v2ex/2026-04-coding-plans/volcengine)

---

## 横向对比矩阵

| 产品 | 月成本 | 模型底座 | 配额口径 | 接 Claude Code | 国内直连 | 实测/调研 |
|---|---|---|---|---|---|---|
| Claude Max 5x / 20x | $100 / $200 | Claude Sonnet 4 / Opus | 5h 滚动窗口 × 5 或 × 20 | 原生 | 需代理 | 实测 |
| GLM Coding Plan | Lite 起 $18 | GLM-5.1 / 5-Turbo / 4.7 / 4.5-Air | prompt 数/5h + /周（1 prompt = 15-20 次调用） | 是（ANTHROPIC_DEFAULT_*_MODEL） | 国际版需代理 | 实测 |
| **阿里云百炼 Coding Plan Pro** | **¥200** | **Qwen / GLM / Kimi / MiniMax 聚合** | **6k/5h · 45k/周 · 90k/月** | 部分（通过百炼 API） | 是 | 实测 |
| MiniMax Token Plan | ¥29–199 | M2.7 / M2.7-highspeed | X 次/5h × 10 周 | 是（官方接） | 是 | 实测 |
| ChatGPT Plus + Codex | $20 | o1 / codex-mini | 日 agent 任务数 | 否 | 需代理 | 调研 |
| Gemini Code Assist | ¥0 / $19 起 | Gemini 2.5（Gemini 3 waitlist） | 6000 补全 + 240 对话/日（免费档） | 否（IDE 插件） | 需代理 | 调研 |
| 火山引擎 | Token 计费 | 豆包 Pro 1.5 / Seed | ¥/1K token | 部分 | 是 | 调研 |

> 上表每一列都可以在 [aiplans.dev](https://aiplans.dev) 点进去看完整定价曲线和历史变动。{{TODO：贴 aiplans.dev `/compare/plans` 对应截图}}

---

## 场景推荐（按使用画像）

- **"我每天开 Claude Code 跑 6 小时 agent"** → **Claude Max 20x**。别犹豫。
- **"我想在一个订阅里自由切换多家模型、做跨模型对比"** → **阿里云百炼 Coding Plan Pro ¥200**。
- **"我是 agent 开发者，想并行跑 2-3 个 agent"** → **MiniMax Max ¥119** 或 **MiniMax Max-极速版 ¥199**。M2.7 的 agent 配额口径最友好。
- **"我想要接近 Claude 的体验，但预算 < ¥200/月"** → **GLM Pro $15** 或 **MiniMax Plus ¥49**。
- **"大厂 / 国企，需要国内合规部署"** → **阿里云百炼 Coding Plan Pro** 或 **火山引擎豆包 Pro**。看你们公司跟哪家云更熟。
- **"个人开发者，side project 不想花钱"** → **Gemini Code Assist 个人版（免费）** + 装一个免费的 **通义灵码 VSCode 插件** 做补全兜底。
- **"一张卡搞定 AI 对话 + 写代码"** → **ChatGPT Plus + Codex**，但知道代码能力略弱于 Claude。

---

## 我的 Top 3：三档标杆

作为 agent 开发者，如果我只能给你三个名字，按"付费旗舰 / 性价比 / 免费"三档给你：

1. **付费旗舰 · Claude Max 20x（$200/月）** —— 我主力的 90% 都在这上面，写这篇文章用的也是它。高端 agent 任务、大仓库重构、复杂多步推理目前没有能替代的。如果你的工作**真的**要靠 AI 跑 6+ 小时/天 的 agent 流程，不要为了省这 $200 浪费两周去折腾替代品。
2. **性价比 · 阿里云百炼 Coding Plan Pro（¥200/月）** —— 同样 ¥200 的门槛，给你 **GLM-5 + Qwen3.5 + Qwen3-Coder + Kimi-K2.5 + MiniMax-M2.5** 这批 2026 年 4 月**全国最前沿国产模型**的切换权 + 90k 请求/月。火山引擎同类产品还停在 GLM-4.7，百炼已经领先一代。对**不需要 Claude 级代码能力**的 agent 任务来说，这是目前中国市场最合算的订阅。**一个前置条件**：配额紧张，建议早上 9-11 点开通最稳（下午容易撞满）。
3. **免费标杆 · Gemini Code Assist 个人版（免费）** —— 我没订阅它，但我身边 3 个朋友用了半年都说稳。**每天 6000 次补全 + 240 次对话的免费额度**（官方公布数据）在 2026 年 4 月**全网最大**，Google 生态用户几乎零摩擦接入。作为主力订阅之外的"不要钱的保险"装一个。

**没放进 Top 3 但仍然值得订的**：
- **MiniMax Max（¥119/月）** —— 如果你专门做 agent 开发，并行开 2-3 个 agent 的场景下，MiniMax 的"按 agent 数标价"口径比百炼 Coding Plan 的"按请求数"更友好，可以把 Top 3 的 #2 换成它。
- **GLM Pro（$15/月）** —— 如果你就想要"Claude Code 外壳 + 国产模型"这一件事，GLM Pro 是 2026 年 4 月最便宜的通路。

---

## 底部披露

再强调一次：本文部分链接含我的推荐码，你通过我的链接订阅对你本身没有额外费用，且有时能拿到首月折扣；我会拿到 affiliate 返佣。我没有收到任何产品方的"软广稿费"，文章评价以我的实际使用和调研为准。如果你发现某个结论跟你自己的体验不一致，评论区告诉我，我会在 72 小时内更新文章对应段落。

**这是本系列第 1 篇**。接下来 3 周我会写：
- Week 2：《我帮 5 个同事选 coding plan，踩过的 3 个大坑》（故事型）
- Week 3：《Go 后端团队选哪个 AI 编程订阅》（场景垂直）
- Week 4：按 Week 1–3 数据决定主题（可能是"订阅 vs 自建 vs API 三种路线真实成本"）

想被第一时间提醒 → 在 V2EX 收藏本贴 / X 关注 **@此方一泉** / 或等 Week 2 邮件订阅上线。

---

**数据来源**（本文发布日 2026-04-22 核对）：
- Claude：[claude.com/pricing](https://claude.com/pricing)
- GLM Coding Plan：[docs.z.ai/devpack/overview](https://docs.z.ai/devpack/overview) + [z.ai/subscribe](https://z.ai/subscribe)
- 阿里云百炼 Coding Plan：[help.aliyun.com/zh/model-studio/coding-plan](https://help.aliyun.com/zh/model-studio/coding-plan)
- MiniMax Token Plan：[platform.minimaxi.com/subscribe/token-plan](https://platform.minimaxi.com/subscribe/token-plan)
- Gemini Code Assist：[codeassist.google](https://codeassist.google/)
- 火山引擎豆包：[volcengine.com/product/doubao](https://www.volcengine.com/product/doubao)
- 历史定价曲线 + 跨厂对比：[aiplans.dev](https://aiplans.dev)（scraper 每天从官方页面更新；部分厂商页面数据正在补齐）
