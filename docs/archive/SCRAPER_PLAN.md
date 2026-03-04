# 数据抓取系统开发计划

## 🎯 目标
实现小时级自动抓取和更新 AI 模型定价数据

## 📊 需要抓取的数据源

### 1. 官方 API 定价
- **OpenAI**: https://openai.com/api/pricing/
- **Anthropic**: https://anthropic.com/pricing
- **Google (Gemini)**: https://ai.google.dev/pricing
- **DeepSeek**: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
- **Mistral**: https://mistral.ai/technology/#pricing

### 2. 第三方渠道
- **OpenRouter**: https://openrouter.ai/models
- **Together AI**: https://www.together.ai/pricing
- **Fireworks AI**: https://fireworks.ai/pricing
- **Replicate**: https://replicate.com/pricing

### 3. 云厂商
- **AWS Bedrock**: https://aws.amazon.com/bedrock/pricing/
- **Google Vertex AI**: https://cloud.google.com/vertex-ai/pricing
- **Azure OpenAI**: https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/

### 4. 国内渠道
- **硅基流动**: https://siliconflow.cn/pricing
- **火山引擎**: https://www.volcengine.com/pricing
- **阿里云百炼**: https://bailian.console.aliyun.com/

## 🏗️ 技术架构

### 方案 A: GitHub Actions (推荐)
**优点**:
- 免费（每月 2000 分钟）
- 无需额外服务器
- 自动执行
- 日志可追溯

**实现**:
```yaml
# .github/workflows/scrape-pricing.yml
schedule:
  - cron: '0 * * * *'  # 每小时执行
```

### 方案 B: Vercel Cron Jobs
**优点**:
- 与 Vercel 部署集成
- 简单配置

**限制**:
- Pro plan 需要付费
- 执行时间限制

### 方案 C: 独立定时任务 + Webhook
**优点**:
- 完全控制
- 可扩展

**缺点**:
- 需要额外服务器/服务

## 📝 抓取策略

### 1. HTML 解析
使用 Puppeteer/Playwright 抓取动态渲染的页面
```typescript
import { chromium } from 'playwright';
```

### 2. API 调用
部分平台提供公开 API（如 OpenRouter）
```typescript
fetch('https://openrouter.ai/api/v1/models')
```

### 3. 数据验证
- 价格格式验证
- 异常检测（突然大幅变化）
- 人工审核标记

## 🗄️ 数据存储

### 价格变更历史
```sql
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  channel_price_id INTEGER REFERENCES channel_prices(id),
  old_input_price REAL,
  new_input_price REAL,
  old_output_price REAL,
  new_output_price REAL,
  change_percent REAL,
  detected_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);
```

### 抓取日志
```sql
CREATE TABLE scrape_logs (
  id SERIAL PRIMARY KEY,
  source VARCHAR(100),
  status VARCHAR(20), -- success, failed, partial
  models_found INTEGER,
  prices_updated INTEGER,
  errors TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

## 🔄 执行流程

```
1. 触发定时任务
   ↓
2. 并行抓取各数据源
   ↓
3. 解析和验证数据
   ↓
4. 比对数据库现有数据
   ↓
5. 记录变更到 price_history
   ↓
6. 更新 channel_prices
   ↓
7. 发送通知（如有重大变化）
   ↓
8. 记录日志
```

## 📦 目录结构

```
scripts/
├── scrapers/
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── openrouter.ts
│   ├── siliconflow.ts
│   └── ...
├── utils/
│   ├── browser.ts
│   ├── validator.ts
│   └── notifier.ts
├── db/
│   ├── queries.ts
│   └── migrations/
└── index.ts  // 主入口
```

## ⚡ 快速开始

### 第一步：创建抓取脚本框架
### 第二步：实现 1-2 个数据源作为示例
### 第三步：配置 GitHub Actions
### 第四步：测试和监控
### 第五步：逐步添加更多数据源

## 🎯 MVP 范围

1. ✅ OpenAI 官方定价
2. ✅ Anthropic 官方定价
3. ✅ OpenRouter 聚合平台
4. ✅ 硅基流动（国内）
5. ✅ DeepSeek 官方

后续扩展：其他云厂商和渠道

## 📊 监控指标

- 抓取成功率
- 数据新鲜度
- 价格变化频率
- 错误率
- 执行时间

## 🚨 告警机制

- 价格异常变化（>20%）
- 抓取连续失败
- 新模型上线
- 渠道下线/不可用

---

**推荐实施顺序**：
1. 先开发本地测试版本
2. 实现 2-3 个主要数据源
3. 部署到 GitHub Actions
4. 监控和优化
5. 逐步扩展数据源
