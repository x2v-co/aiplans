# 🎯 数据抓取源清单

请填写以下信息，我将根据此表格生成对应的爬虫任务。

## 📋 填写说明

- **供应商名称**: 官方名称（如 OpenAI、Anthropic）
- **定价类型**:
  - 🔹 **API** - 按 token 计费（input/output per 1M）
  - 🔸 **Plan** - 订阅套餐（月付/年付，固定价格）
  - 🔶 **Both** - 两种都有
- **定价页面 URL**: 包含价格信息的页面
- **API 文档 URL**: 如果有 API 可以直接获取价格信息
- **类型**: official（官方）/ cloud（云厂商）/ aggregator（聚合平台）/ reseller（转售商）
- **地区**: global（国际）/ china（国内）/ both（两者都有）
- **国内可访问**: Yes / No
- **支付方式**: 信用卡 / 支付宝 / 微信 / PayPal 等
- **邀请链接**: 推广/注册链接（可选）

---

## 🌍 官方渠道 (Official)

| 供应商名称 | 定价类型 | 定价页面 URL | API 文档 URL | 类型 | 地区 | 国内可访问 | 支付方式 | 邀请链接 | 优先级 | 备注 |
|---------|---------|------------|------------|------|------|----------|---------|---------|--------|------|
| OpenAI | 🔶 Both | Plan: https://openai.com/chatgpt/pricing/ | - | official | global | No | 信用卡 | | ⭐⭐⭐ | API + ChatGPT Plus |
| Anthropic | 🔶 Both | Plan: https://claude.com/pricing | - | official | global | No | 信用卡 | | ⭐⭐⭐ | API + Claude Pro |
| Google Gemini | 🔶 Both | Plan: https://gemini.google/subscriptions/ | - | official | global | Yes | 信用卡 | | ⭐⭐⭐ | API + Gemini Advanced |
| Mistral AI | 🔶 Both | Plan: https://mistral.ai/pricing | - | official | global | No | 信用卡 | | ⭐⭐ | |
| Minimax | 🔶 Both | Plan: https://platform.minimaxi.com/docs/guides/pricing-coding-plan|https://platform.minimaxi.com/docs/api-reference/api-overview | official | china | Yes | 支付宝 | https://platform.minimaxi.com/subscribe/coding-plan?code=GOCSHm96x2&source=link | ⭐⭐⭐ | |
| Minimax Global| 🔶 Both | Plan:https://platform.minimax.io/docs/guides/pricing-coding-plan|https://platform.minimax.io/docs/guides/models-intro | official | global | Yes | 信用卡/支付宝 | | ⭐⭐⭐ | |
| 智谱 AI (ChatGLM) | 🔶 Both | Plan:https://bigmodel.cn/glm-coding|https://docs.bigmodel.cn/cn/guide/start/model-overview | official | china | Yes | 支付宝/微信 | https://www.bigmodel.cn/glm-coding?ic=U2SFC0L765| ⭐⭐⭐ | |
| 智谱 AI Global / Z.AI (ChatGLM) | 🔶 Both | Plan:https://z.ai/subscribe |https://docs.z.ai/guides/overview/quick-start | official | global | Yes | 信用卡/PayPal | https://z.ai/subscribe?ic=HFGTURQAPY | ⭐⭐⭐ | |
| 阿里 (Qwen) | 🔶 Both | Plan:https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=3005961 |https://help.aliyun.com/zh/model-studio/what-is-model-studio | official | both | Yes | 支付宝|https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12401178..10263.. | ⭐⭐⭐ | 有免费额度 |
| 字节跳动 (Seed) | 🔶 Both | PLAN: https://www.volcengine.com/docs/82379/1925114| https://www.volcengine.com/docs/82379/1099455 | official | both | Yes | 支付宝/微信 | https://volcengine.com/L/_uDpCXoFKP0/ | ⭐⭐⭐ | |
| 百度 (ERNIE)| 🔶 Both | Plan: https://console.bce.baidu.com/qianfan/resource/subscribe | | official | china | Yes | | | ⭐⭐⭐ | |

---

## ☁️ 云厂商 (Cloud)

| 供应商名称 | 定价类型 | 定价页面 URL | API 文档 URL | 类型 | 地区 | 国内可访问 | 支付方式 | 邀请链接 | 优先级 | 备注 |
|---------|---------|------------|------------|------|------|----------|---------|---------|--------|------|
| AWS Bedrock | 🔹 API | https://aws.amazon.com/bedrock/pricing/ | - | cloud | global | Yes | 信用卡 | | ⭐⭐⭐ | 按需计费 |
| Google Vertex AI | 🔹 API | https://cloud.google.com/vertex-ai/pricing | - | cloud | global | Yes | 信用卡 | | ⭐⭐⭐ | |
| Azure OpenAI | 🔹 API | https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/ | - | cloud | global | Yes | 信用卡 | | ⭐⭐⭐ | |
| 阿里云百炼 | 🔶 Both | API:https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148<br>Plan:https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=3005961 |https://help.aliyun.com/zh/model-studio/what-is-model-studio  | cloud | both | Yes | 支付宝 | | ⭐⭐⭐ | 有免费额度|
| 火山引擎SEED | 🔶 Both |API:https://www.volcengine.com/docs/82379/1544106<br>PLAN: https://www.volcengine.com/docs/82379/1925114 | | cloud | china | Yes | 支付宝/微信 | | ⭐⭐⭐ | |
| 百度千帆 | Both | API: https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya<br>Plan: https://console.bce.baidu.com/qianfan/resource/subscribe | | cloud | china | Yes | 支付宝/微信 | | ⭐⭐⭐ | |

---

## 🔀 聚合平台 (Aggregator)

| 供应商名称 | 定价类型 | 定价页面 URL | API 文档 URL | 类型 | 地区 | 国内可访问 | 支付方式 | 邀请链接 | 优先级 | 备注 |
|---------|---------|------------|------------|------|------|----------|---------|---------|--------|------|
| OpenRouter | 🔹 API | https://openrouter.ai/models | https://openrouter.ai/api/v1/models | aggregator | global | No | 信用卡 | | ⭐⭐⭐ | ✅ 已完成 |
| Together AI | 🔹 API | https://www.together.ai/pricing | - | aggregator | global | No | 信用卡 | | ⭐⭐⭐ | |
| Fireworks AI | 🔹 API | https://fireworks.ai/pricing | - | aggregator | global | No | 信用卡 | | ⭐⭐ | |
| Replicate | 🔹 API | https://replicate.com/pricing | - | aggregator | global | No | 信用卡 | | ⭐⭐ | |
| Anyscale | 🔹 API | https://www.anyscale.com/pricing | - | aggregator | global | No | 信用卡 | | ⭐⭐ | |
| 硅基流动 | 🔹 API | https://siliconflow.cn/pricing | | aggregator | china | Yes | 支付宝/微信 | | ⭐⭐⭐ | 国内最大 |

---

## 🏪 转售商 (Reseller)

| 供应商名称 | 定价类型 | 定价页面 URL | API 文档 URL | 类型 | 地区 | 国内可访问 | 支付方式 | 邀请链接 | 优先级 | 备注 |
|---------|---------|------------|------------|------|------|----------|---------|---------|--------|------|
| DMXAPI（大模型API） | API | https://www.dmxapi.cn/rmb | | reseller | china | Yes | 支付宝/微信| | | |

---

## 📊 定价类型说明

### 🔹 API 定价 (channel_prices 表)
**特点**:
- 按 token 使用量计费
- 通常是 Pay-as-you-go
- 价格维度：input/output per 1M tokens

**抓取目标**:
```typescript
{
  modelName: string;
  modelSlug: string;
  inputPricePer1M: number;      // 输入价格
  outputPricePer1M: number;     // 输出价格
  cachedInputPricePer1M?: number; // 缓存输入价格
  contextWindow?: number;
  rateLimit?: string;           // RPM, TPM 等
  isAvailable: boolean;
}
```

**存储表**: `channel_prices`

### 🔸 Plan 定价 (plans 表)
**特点**:
- 订阅制（月付/年付）
- 固定价格 + 使用限制
- 价格维度：monthly/yearly price

**抓取目标**:
```typescript
{
  planName: string;              // ChatGPT Plus, Claude Pro
  planSlug: string;
  priceMonthly: number;          // 月付价格
  priceYearly?: number;          // 年付价格
  pricingModel: 'subscription' | 'token_pack' | 'pay_as_you_go';
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';

  // 限制
  dailyMessageLimit?: number;
  requestsPerMinute?: number;
  qps?: number;
  tokensPerMinute?: number;

  // 权益
  features: string[];            // 特殊功能
  models: string[];              // 可用模型

  // 其他
  region: string;
  accessFromChina: boolean;
  paymentMethods: string[];
  isOfficial: boolean;
}
```

**存储表**: `plans`

### 🔶 Both
同时提供 API 和 Plan 两种定价方式，需要分别抓取存储。

---

## 🎯 抓取策略

### API 定价抓取器
**文件命名**: `scripts/scrapers/api-[vendor].ts`

**示例**: `api-openai.ts`, `api-anthropic.ts`

**目标表**: `channel_prices`

### Plan 定价抓取器
**文件命名**: `scripts/scrapers/plan-[vendor].ts`

**示例**: `plan-openai.ts`, `plan-anthropic.ts`

**目标表**: `plans`

### 混合抓取器
对于 🔶 Both 类型，创建两个文件：
- `api-openai.ts` - 抓取 API 定价
- `plan-openai.ts` - 抓取 ChatGPT Plus/Team 等套餐

---

## 📝 抓取任务生成规则

根据**定价类型**自动决定：

1. **🔹 API** → 生成 API 抓取器 → 存入 `channel_prices`
2. **🔸 Plan** → 生成 Plan 抓取器 → 存入 `plans`
3. **🔶 Both** → 生成两个抓取器 → 分别存入对应表

### 优先级队列
- ⭐⭐⭐ (高) - 主流供应商，立即开发
- ⭐⭐ (中) - 重要但非紧急
- ⭐ (低) - 可选，后续扩展

---

## 🎯 下一步操作

1. **填写此表格** - 补充缺失的 URL 和信息
2. **标注定价类型** - 🔹 API / 🔸 Plan / 🔶 Both
3. **告诉我"生成爬虫任务"** - 我将根据类型生成对应代码
4. **测试验证** - 分别测试 API 和 Plan 抓取
5. **部署上线** - 配置到 GitHub Actions

---

**请根据实际情况填写表格，特别注意区分 API 定价和 Plan 定价！** 🚀

---

## 📝 抓取任务生成规则

根据上表信息，将自动生成：

### 1. 爬虫文件 (`scripts/scrapers/[vendor-slug].ts`)
- 如果有 **API 文档 URL** → 使用 API 方式抓取（推荐）
- 如果只有 **定价页面 URL** → 使用 Puppeteer/Playwright 爬取
- 如果两者都没有 → 需要先调研可行性

### 2. 优先级队列
- ⭐⭐⭐ (高) - 主流供应商，立即开发
- ⭐⭐ (中) - 重要但非紧急
- ⭐ (低) - 可选，后续扩展

### 3. 开发顺序建议
1. **Phase 1**: API 方式 + 优先级⭐⭐⭐
2. **Phase 2**: 网页爬取 + 优先级⭐⭐⭐
3. **Phase 3**: 其他优先级较低的

### 4. 每个爬虫需要提取的字段
```typescript
{
  modelName: string;        // 模型名称
  modelSlug: string;        // URL 友好的 slug
  inputPricePer1M: number;  // 输入价格（每百万 token）
  outputPricePer1M: number; // 输出价格（每百万 token）
  cachedInputPricePer1M?: number; // 缓存输入价格（可选）
  contextWindow?: number;   // 上下文窗口大小
  rateLimit?: string;       // 速率限制说明
  isAvailable: boolean;     // 是否可用
}
```


---

## 💡 填写技巧

### 如何找 API 文档
1. 查看网站 `/api/v1/models` 等常见端点
2. 搜索 "vendor_name API documentation"
3. 检查开发者文档中的 pricing 相关接口

### 地区判断
- **global**: 主要服务国际市场，可能需要翻墙
- **china**: 主要服务国内，有备案
- **both**: 两个市场都覆盖

### 国内可访问判断
- 测试是否需要 VPN 才能访问
- 注意有些网站页面可访问但 API 需要代理

---

**请根据实际情况填写表格，我将为每个数据源生成对应的爬虫实现！** 🚀
