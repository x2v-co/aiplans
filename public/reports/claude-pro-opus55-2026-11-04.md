# Claude Pro · Opus 5.5 额度实测（2026-11-04）

来源：x2v 实测（2026-11-04，Claude Code）——[Pro Plan Opus 5.5 Quota](https://claude.ai/artifact/DcK5UbxR1SmkgDn38QtBo2)。非 Anthropic 官方额度。

## 方法
- 147 次受控 Opus 5.5 调用，headless `claude -p --model claude-opus-5-5 --effort medium`，无工具 / MCP。
- 对照 API 标价：输入 $4/M、输出 $20/M、1h 缓存写 $8/M、缓存读 $0.20/M。

## 结果（API 等值）
| 窗口 | 输出为主 | Agent 编程（99% 缓存读、0.2% 输出） |
|---|---|---|
| 5 小时 | ≈1.3M 输出 token，$26–29 | ≈160M 总 token，$44 |
| 1 周（≈7.2 个 5h 窗口，6.8–7.8） | 9.3M 输出 token，$185–205 | 1.15B token，$320 |
| 1 月（周上限 ×4.35） | 40M 输出 token，$800–890 | 5.0B token，$1,390 |

约为 $20/月 Pro 价格的 40–70×。

## 计量拟合
- 缓存写 ≈0.55×、缓存读 ≈0.5× 标价；L ≈ 每 5 小时 $25.75 输出等值。
- thinking token 计为输出。周上限是实际约束。

## 局限
- 用量表只显示整数百分比（±0.5pt）；单日单时段；单账号；B2 批次可能被限速。
