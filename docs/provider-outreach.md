# Provider outreach playbook

Goal: invite unlisted AI API providers to share a machine-readable data source for aiplans.dev, and optionally offer a dedicated deal for aiplans.dev users.

Primary CTA: provide a pricing/models API, public JSON, OpenAPI spec, or stable docs endpoint we can ingest.
Fallback CTA: reply with manual model/pricing details, or open a GitHub issue.

## First outreach batch

Excluded from this first batch: 火山方舟, 七牛云.

| Provider | Contact | Notes |
| --- | --- | --- |
| Fenno.ai | hello@fenno.ai | Strong fit; has API/Codex positioning and Discord. |
| PatewayAI | support@pateway.ai | Strong fit; public support email and group links. |
| A6API | a6apicom@gmail.com | Strong fit; public email and Telegram. |
| SoleAPI | admin@oryntis.ai | Strong fit; public email, QQ group, Telegram. |
| XycAi | info@xyc.hk.cn | Strong fit; public sales email and Telegram. |
| PPIO | feedback@ppio.com | Cloud/agentic provider; ask for official data validation first. |
| AICoding | CesarMitchellko@hotmail.com | Verify this contact before sending a full business email. |

For Telegram / QQ-only providers, ask for an official email first instead of posting the full pitch into a group.

## Chinese email

Subject options:

- 邀请收录到 aiplans.dev AI API 价格目录
- aiplans.dev 希望接入贵平台模型与价格数据源
- 关于将贵平台收录到 aiplans.dev 的合作邀请

```text
你好，

我是 aiplans.dev 的维护者。aiplans.dev 是一个面向开发者的 AI 模型价格比较平台，主要帮助用户比较同一模型在不同 API 渠道中的价格、可用性、地区访问情况和订阅方案。

我们最近在整理 Claude / OpenAI / Gemini / DeepSeek / Qwen 等模型的 API 渠道信息，注意到贵平台也提供相关模型服务。希望邀请贵平台进入 aiplans.dev 的供应商目录。

最理想的接入方式是提供一个可机器读取的数据源，方便我们自动同步并减少你们后续维护成本，例如：

1. 模型列表 API 或公开 JSON
2. 价格 API 或公开 JSON
3. OpenAPI spec
4. 稳定的价格/模型文档页面
5. 如果接口需要鉴权，可以说明申请方式、频率限制和更新频率

如果暂时没有 API 或 JSON，也可以直接回复这些人工信息：支持的模型、每 1M tokens 输入/输出价格、结算货币、最低充值额、支付方式、中国大陆访问情况和官方联系方式。

如果贵平台能提供专属优惠，我们会在对应 provider 页面和优惠信息区展示，例如：

- 专属优惠码：AIPLANS
- 新用户赠送额度
- 首充折扣
- 长期充值返利
- 企业用户专属方案

提交方式有两种：

1. 直接回复这封邮件，优先发数据源链接；
2. 或在 GitHub 提交收录 issue：https://github.com/x2v-co/aiplans/issues/new?template=provider-listing.yml

我们会尽量保持数据透明和中立。收录不代表付费排名，价格和可用性会以公开可验证信息为准。

If English is preferred, I’m happy to continue in English.

谢谢！
<你的名字>
aiplans.dev
https://aiplans.dev/zh/submit-provider
service@x2v.co
```

## English email

Subject options:

- Invitation to list your API platform on aiplans.dev
- Can aiplans.dev ingest your model and pricing data source?
- aiplans.dev provider listing request

```text
Hi,

I’m the maintainer of aiplans.dev, an AI pricing comparison site for developers. We help users compare the same AI models across different API providers, including pricing, model availability, billing currency, region access, and subscription plans.

We are currently expanding our provider directory for Claude, OpenAI, Gemini, DeepSeek, Qwen, and other major models. We noticed that your platform provides AI API access, and we’d like to invite you to be listed on aiplans.dev.

The best path is a machine-readable data source we can ingest and keep updated automatically. For example:

1. Models API or public JSON
2. Pricing API or public JSON
3. OpenAPI spec
4. Stable pricing/model docs endpoint
5. If auth is required, notes on how to request access, rate limits, and update frequency

If you do not have an API or JSON source yet, you can reply with manual details instead: supported models, input/output price per 1M tokens, billing currency, minimum top-up, payment methods, region availability, China access, and official contact information.

If you’re open to providing an exclusive offer, we can display it on your provider page and in our deals section. Examples:

- Coupon code: AIPLANS
- Free credits for new users
- First top-up discount
- Long-term recharge bonus
- Enterprise discount

You can submit the information in either way:

1. Reply directly to this email, preferably with the data source URL;
2. Or create a listing request on GitHub: https://github.com/x2v-co/aiplans/issues/new?template=provider-listing.yml

We aim to keep the directory transparent and neutral. Listing does not mean paid ranking. Pricing and availability will be based on public or verifiable information.

中文回复也可以，我可以用中文继续对接。

Best,
<Your name>
aiplans.dev
https://aiplans.dev/submit-provider
service@x2v.co
```

## Follow-up

Send after 4 days, then one final follow-up around day 10.

```text
你好，简单跟进一下。

我们正在整理 AI API 渠道价格目录，想确认是否可以将贵平台收录到 aiplans.dev。

最方便的方式是提供一个模型/价格 API、公开 JSON 或稳定文档页面，我们可以接入后自动更新。没有数据源也没关系，你们也可以直接回复模型、价格和联系方式。

如果有专属优惠码，也可以一起提供。没有优惠也没关系，我们仍然可以基于公开信息做中立收录。

谢谢！
```
