# 数据更新与清理报告

**日期**: 2026-03-02
**执行任务**: 使用 web-info-extractor 更新 fallback 数据并清理数据库

---

## 📊 抓取数据汇总

### 已抓取的提供商

| 类别 | 提供商 | 状态 |
|------|---------|------|
| **官方** | OpenAI, Anthropic, Google Gemini, DeepSeek, Grok/X.AI, Mistral AI | ✅ 完成 |
| **国内** | Moonshot, Minimax, Zhipu AI, Qwen, Hunyuan, Baidu | ✅ 完成 |
| **云厂商** | AWS Bedrock, Google Vertex AI, Azure OpenAI | ✅ 完成 |
| **聚合平台** | OpenRouter, Together AI, Fireworks AI, Replicate, Anyscale, SiliconFlow, DMXAPI | ✅ 完成 |

### 抓取的定价数据文件

1. **OPENAI_PRICING_DATA.json** - OpenAI API 和订阅计划
2. **CHINESE_PROVIDERS_PRICING_DATA.json** - 国内提供商 API 定价
3. **AGGREGATOR_PRICING_DATA.json** - 聚合平台定价汇总
4. **OPENROUTER_FULL_PRICING.json** - OpenRouter 完整模型列表 (340+ 模型)

---

## 🗑️ 数据库清理结果

### 清理前统计
- Products: 523
- Channel Prices: 471
- Plans: 12
- Channels: 17

### 清理后统计
- Products: 523
- Channel Prices: 430
- Plans: 12
- Channels: 15

### 清理详情
- **总计删除**: 43 条记录
- **删除的价格记录**: 41 条（异常高价格或无效价格）
- **删除的渠道记录**: 2 条（无关联价格的空渠道）
- **处理重复**: 0 条

### 清理规则
1. **删除价格 > 1000 的记录** - 可能是错误数据
2. **删除价格 <= 0 的记录** - 无效价格
3. **删除超过 90 天未验证的价格** - 过期数据
4. **删除无关联价格的渠道** - 孤立渠道记录

---

## 📝 创建的脚本

### 1. `scripts/cleanup-database.ts`
数据库清理脚本，功能包括：
- 检查并删除重复的 products slug
- 检查并删除无效的 channel_prices
- 检查并删除过时的 plans
- 检查并删除无关联的 channels
- 生成清理前后统计报告

### 2. `scripts/update-all-pricing.ts`
统一数据更新脚本，功能包括：
- 运行所有优先级 1 的 scrapers (14 个)
- 运行所有优先级 2 的 scrapers (6 个)
- 更新 Chatbot Arena Benchmark 数据
- 自动推断 Provider ID 和货币类型
- 记录价格变化到 price_history 表
- 生成更新汇总报告

---

## 🚀 使用方法

### 清理数据库
```bash
cd /path/to/planprice
npx tsx scripts/cleanup-database.ts
```

### 更新所有定价数据
```bash
cd /path/to/planprice
npx tsx scripts/update-all-pricing.ts
```

### 运行单个 scraper
```bash
# OpenAI
npx tsx scripts/scrapers/openai-dynamic.ts

# Anthropic
npx tsx scripts/scrapers/anthropic-dynamic.ts

# DeepSeek
npx tsx scripts/scrapers/deepseek-dynamic.ts
```

---

## 📈 定期更新建议

### 每日更新
- **OpenRouter** - 模型变化频繁
- **DeepSeek** - 价格可能调整
- **聚合平台** - 新模型上线

### 每周更新
- **官方提供商** (OpenAI, Anthropic, Google)
- **国内提供商** (Moonshot, Minimax, Zhipu, Qwen)
- **云厂商** (AWS, Azure, Vertex)

### 每月更新
- **Benchmark 排名** - Chatbot Arena ELO 分数
- **清理数据库** - 删除过期数据
- **检查重复记录**

---

## ⚠️ 注意事项

1. **Fallback 数据**: 每个动态 scraper 都有内置的 fallback 数据，当网页/API 抓取失败时会自动使用

2. **货币转换**: 国内提供商价格为 CNY，国际提供商为 USD

3. **价格单位**: API 价格统一为 per 1M tokens

4. **上下文窗口**: 部分模型可能没有，抓取时需要验证

5. **渠道类型**:
   - `official` - 官方直连
   - `cloud` - 云厂商托管
   - `aggregator` - 聚合平台
   - `reseller` - 转售商

---

## 📋 待完成任务

- [ ] 设置 GitHub Actions 定时任务
- [ ] 配置价格变化通知
- [ ] 添加更多国内提供商
- [ ] 完善 Plan 类 scraper (目前主要是 API 定价)
- [ ] 集成更多 Benchmark 数据源 (MMLU, HumanEval 等)
