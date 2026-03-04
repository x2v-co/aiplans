# 🚀 抓取系统更新完成 - 需要执行数据库迁移

## ✅ 已完成的更新

### 新增 API 定价爬虫 (9个)

| 数据源 | 文件 | 模型数 | 状态 |
|--------|------|--------|------|
| OpenRouter | `api-openrouter.ts` (openrouter.ts) | 200+ | ✅ |
| OpenAI | `api-openai.ts` | 8 | ✅ |
| Anthropic | `api-anthropic.ts` | 8 | ✅ |
| DeepSeek | `api-deepseek.ts` | 2 | ✅ |
| Together AI | `api-together-ai.ts` | 9 | ✅ |
| SiliconFlow | `api-siliconflow.ts` | 12 | ✅ |
| **Google Gemini** | `api-google-gemini.ts` | 7 | ✅ 新增 |
| **Grok/X.AI** | `api-grok.ts` | 4 | ✅ 新增 |
| **Mistral AI** | `api-mistral.ts` | 7 | ✅ 新增 |

### 新增 Plan 定价爬虫 (3个)

| 数据源 | 文件 | 套餐数 | 状态 |
|--------|------|--------|------|
| OpenAI | `plan-openai.ts` | 4 | ✅ |
| Anthropic | `plan-anthropic.ts` | 3 | ✅ |
| **Google Gemini** | `plan-google-gemini.ts` | 2 | ✅ 新增 |

### 总计
- **API 定价**: 9个数据源, ~260+ 模型
- **Plan 定价**: 3个数据源, 9个套餐

## ⚠️ 需要执行的操作

### 第1步：运行数据库迁移

在 Supabase SQL Editor 中执行以下SQL文件：

```sql
-- 执行这个文件来创建完整的表结构
/Users/kl/workspace/x2v/planprice/scripts/db/migrations/complete_schema.sql
```

这个迁移会：
1. 创建所有必要的表（providers, products, channels, channel_prices, plans）
2. 添加所有必需的约束（UNIQUE约束解决当前的错误）
3. 创建索引以提升查询性能
4. 初始化10个基础供应商数据

### 第2步：测试单个爬虫

```bash
# 测试新增的爬虫
npm run scrape:gemini-api      # Google Gemini API
npm run scrape:gemini-plan     # Google Gemini Plans
npm run scrape:grok            # Grok/X.AI
npm run scrape:mistral         # Mistral AI

# 测试已有的爬虫
npm run scrape:openai-api
npm run scrape:anthropic-api
npm run scrape:deepseek
```

### 第3步：运行完整抓取

```bash
npm run scrape
```

这将执行：
- 9个 API 定价爬虫（并行）
- 3个 Plan 定价爬虫（并行）
- 自动记录到 `scrape_logs` 表
- 检测价格变化并记录到 `price_history` 表

## 📊 新增模型详情

### Google Gemini API
- **gemini-2.0-flash-exp**: $0/1M tokens (免费预览)
- **gemini-1.5-pro**: $1.25/$5.00 per 1M tokens, 2M context
- **gemini-1.5-flash**: $0.075/$0.30 per 1M tokens, 1M context
- **gemini-1.5-flash-8b**: $0.0375/$0.15 per 1M tokens
- 支持 Context Caching (缓存价格更低)

### Grok/X.AI API
- **grok-2-1212**: $2/$10 per 1M tokens, 128K context
- **grok-2-vision-1212**: $2/$10 per 1M tokens (视觉模型)
- **grok-beta**: $5/$15 per 1M tokens
- **grok-vision-beta**: $5/$15 per 1M tokens

### Mistral AI API
- **mistral-large-latest**: $2/$6 per 1M tokens
- **mistral-small-latest**: $0.20/$0.60 per 1M tokens
- **codestral-latest**: $0.20/$0.60 per 1M tokens (代码专用)
- **mistral-nemo**: $0.15/$0.15 per 1M tokens
- **pixtral-12b**: $0.15/$0.15 per 1M tokens (多模态)
- **ministral-8b/3b**: $0.10/$0.04 per 1M tokens (轻量级)

### Google Gemini Plans
- **Gemini Free**: $0/月
- **Google One AI Premium**: $19.99/月 (包含2TB存储 + Gemini 1.5 Pro)

## 🎯 下一步计划

### Phase 2: 云厂商 API 定价
- [ ] AWS Bedrock
- [ ] Google Vertex AI
- [ ] Azure OpenAI
- [ ] 阿里云百炼
- [ ] 火山引擎豆包
- [ ] 百度千帆

### Phase 3: 国内官方渠道
- [ ] 月之暗面 Kimi (API + Plan)
- [ ] Minimax (API + Plan)
- [ ] 智谱 AI (API + Plan)
- [ ] 阶跃星辰 StepFun
- [ ] 阿里通义千问
- [ ] 字节 Seed
- [ ] 腾讯混元
- [ ] 百度文心

### Phase 4: 更多聚合平台
- [ ] Fireworks AI
- [ ] Replicate
- [ ] Anyscale

## 🔧 故障排除

### 错误: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

**原因**: 数据库表缺少必需的唯一约束

**解决**: 执行 `scripts/db/migrations/complete_schema.sql`

### 错误: "supabaseUrl is required"

**原因**: 环境变量未正确加载

**解决**:
1. 确保 `.env.local` 文件存在
2. 已自动添加 dotenv 加载逻辑
3. 重新运行爬虫

### 价格数据未更新

**检查**:
```sql
-- 查看最近的抓取日志
SELECT * FROM scrape_logs ORDER BY completed_at DESC LIMIT 10;

-- 查看数据新鲜度
SELECT
  c.name,
  COUNT(*) as models,
  MAX(cp.last_verified) as last_update
FROM channel_prices cp
JOIN channels c ON cp.channel_id = c.id
GROUP BY c.name
ORDER BY last_update DESC;
```

## 📝 npm Scripts 速查

```bash
# 完整抓取
npm run scrape

# 单个API测试
npm run scrape:openrouter
npm run scrape:openai-api
npm run scrape:anthropic-api
npm run scrape:deepseek
npm run scrape:together
npm run scrape:siliconflow
npm run scrape:gemini-api    # 新增
npm run scrape:grok          # 新增
npm run scrape:mistral       # 新增

# Plan测试
npm run scrape:openai-plan
npm run scrape:anthropic-plan
npm run scrape:gemini-plan   # 新增
```

## 🎉 总结

1. ✅ 新增 3个 API 爬虫 (Google Gemini, Grok, Mistral)
2. ✅ 新增 1个 Plan 爬虫 (Google Gemini)
3. ✅ 更新主协调器支持新爬虫
4. ✅ 创建完整的数据库迁移文件
5. ✅ 添加环境变量自动加载
6. ⚠️ **需要手动执行数据库迁移**
7. ⏳ 等待执行后即可运行完整抓取

现在数据源覆盖：
- **9个 API 渠道**
- **3个 Plan 供应商**
- **260+ 模型价格**
- **9个订阅套餐**

准备好后运行 `npm run scrape` 开始抓取！🚀
