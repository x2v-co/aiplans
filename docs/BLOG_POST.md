# aiplans.dev Distribution Article

This is a source draft for community posts. Adapt the opening and title to the
community instead of publishing identical text everywhere. Do not claim a
specific saving percentage, provider count, or real-time coverage unless the
linked live page currently proves it.

## 中文稿

### 标题

我把 Kimi、GLM、Claude、Grok 的 API 价格整理成了一套可复查的对比表

### 正文

做 AI 应用成本评估时，最容易混在一起的是三件事：模型厂商、实际购买渠道，
以及面向个人用户的订阅套餐。相同模型可能同时出现在官方接口、云平台和聚合
渠道，而 API token 计费通常也不等于 ChatGPT、Claude 或 Kimi 的应用订阅。

我维护的 aiplans.dev 先保留每个渠道的原始结算币种，再统一换算成美元用于横向
排序。免费路由不会混入“最低付费价格”榜单；渠道页同时保留来源和最近核验时间，
方便发现数据不一致时回查。

目前可以从四类高频问题开始：

- Kimi API 的国内、国际与第三方渠道有什么区别？
- GLM/ChatGLM 的官方接口与免费路由该怎么区分？
- Claude API token 费用和 Claude Pro/Max 订阅是什么关系？
- Grok API 与消费级订阅应该分别如何估算？

完整价格指数会展示当前有价格的模型、可用渠道、供应商覆盖，以及价格历史里记录
到的显著变化。它不是静态榜单，最终接入前仍应核对厂商定价页、地区、限速和支付
条件。

欢迎指出缺失渠道或价格错误，最好附上官方价格来源。项目与数据处理代码均可在
GitHub 查看。

## English Draft

### Title

I built an auditable price index for Kimi, GLM, Claude, and Grok APIs

### Body

AI cost comparisons often mix up three different things: the model maker, the
channel that sells access, and the consumer subscription product. The same
model can be available through an official API, a cloud platform, and an
aggregator, while API token billing is separate from subscriptions such as
Claude Pro or Kimi plans.

aiplans.dev keeps each channel's billing currency and normalizes prices to USD
only for cross-channel ranking. Free routes are excluded from the lowest paid
price table. Source links and verification dates are retained so discrepancies
can be checked rather than hidden behind a single score.

The focused guides currently cover Kimi, GLM/ChatGLM, Claude, and Grok. The
market-wide price index reports priced models, available channels, provider
coverage, and material changes recorded in the price history.

This is not a promise that the cheapest row is operationally equivalent to an
official endpoint. Region availability, contracts, rate limits, payment, and
data handling still need to be checked before integration.

Corrections and missing-provider reports are welcome, preferably with an
official pricing source. The project and data tooling are available on GitHub.

## Canonical Links

- Price index: https://aiplans.dev/en/reports/api-price-index
- Kimi guide: https://aiplans.dev/en/guides/kimi-api-pricing
- GLM guide: https://aiplans.dev/en/guides/glm-chatglm-api-pricing
- Claude guide: https://aiplans.dev/en/guides/claude-anthropic-pricing
- Grok guide: https://aiplans.dev/en/guides/grok-pricing
- GitHub: https://github.com/x2v-co/aiplans
