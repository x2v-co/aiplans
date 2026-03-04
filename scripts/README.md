# 🤖 数据抓取系统

自动抓取和更新 AI 模型定价数据的系统。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
npm install -g tsx  # TypeScript 执行器
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### 3. 运行数据库迁移

```bash
# 在 Supabase SQL Editor 中执行
cat scripts/db/migrations/add_scraper_tables.sql
```

### 4. 测试单个爬虫

```bash
# 测试 OpenRouter 爬虫
tsx scripts/scrapers/openrouter.ts
```

### 5. 运行完整抓取

```bash
# 本地测试
tsx scripts/index.ts

# 或者通过 npm script
npm run scrape
```

## 📦 已实现的数据源

- ✅ **OpenRouter** - 聚合平台，200+ 模型
- ⏳ **OpenAI** - 官方定价
- ⏳ **Anthropic** - 官方定价
- ⏳ **硅基流动** - 国内渠道
- ⏳ **DeepSeek** - 官方定价

## 🏗️ 架构

```
scripts/
├── index.ts              # 主入口，协调所有爬虫
├── scrapers/             # 各个数据源的爬虫
│   └── openrouter.ts     # OpenRouter 爬虫
├── db/                   # 数据库操作
│   ├── queries.ts        # 查询和更新函数
│   └── migrations/       # SQL 迁移文件
└── utils/                # 工具函数
    └── validator.ts      # 数据验证

.github/workflows/
└── scrape-pricing.yml    # GitHub Actions 定时任务
```

## ⏰ 自动化执行

### GitHub Actions (推荐)

项目配置了 GitHub Actions，每小时自动执行一次：

1. 在 GitHub 仓库设置中添加 Secrets：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`

2. 推送代码到 GitHub，Action 会自动运行

3. 查看执行日志：
   - GitHub → Actions → Scrape Pricing Data

### 手动触发

在 GitHub Actions 页面点击 "Run workflow" 按钮。

## 📊 数据表

### `price_history`
记录所有价格变化：
- `channel_price_id`: 关联的价格记录
- `old_*/new_*`: 变化前后的价格
- `change_percent`: 变化百分比
- `detected_at`: 检测时间

### `scrape_logs`
抓取执行日志：
- `source`: 数据源名称
- `status`: success/failed/partial
- `models_found`: 发现的模型数量
- `prices_updated`: 更新的价格数量
- `duration_ms`: 执行耗时

## 🔍 监控

### 查看最近的抓取记录

```sql
SELECT * FROM scrape_logs
ORDER BY completed_at DESC
LIMIT 10;
```

### 查看价格变化

```sql
SELECT
  ph.*,
  p.name as model_name,
  c.name as channel_name
FROM price_history ph
JOIN channel_prices cp ON ph.channel_price_id = cp.id
JOIN products p ON cp.product_id = p.id
JOIN channels c ON cp.channel_id = c.id
WHERE ABS(ph.change_percent) > 20
ORDER BY ph.detected_at DESC;
```

### 查看数据新鲜度

```sql
SELECT
  c.name as channel,
  COUNT(*) as total_prices,
  MAX(cp.last_verified) as last_update,
  NOW() - MAX(cp.last_verified) as time_since_update
FROM channel_prices cp
JOIN channels c ON cp.channel_id = c.id
GROUP BY c.name
ORDER BY last_update DESC;
```

## 🚨 告警

系统会自动检测：
- 价格异常变化（>20%）
- 抓取连续失败
- 数据超过 24 小时未更新

## 🛠️ 添加新数据源

1. 创建新的爬虫文件：

```typescript
// scripts/scrapers/your-source.ts
import type { ScraperResult } from '../utils/validator';

export async function scrapeYourSource(): Promise<ScraperResult> {
  // 实现抓取逻辑
  return {
    source: 'YourSource',
    success: true,
    prices: [/* ... */],
  };
}
```

2. 在 `scripts/index.ts` 中注册：

```typescript
const scrapers = [
  { fn: scrapeOpenRouter, name: 'OpenRouter' },
  { fn: scrapeYourSource, name: 'YourSource' }, // 添加这行
];
```

3. 测试：

```bash
tsx scripts/scrapers/your-source.ts
```

## 📝 开发计划

### Phase 1: 基础功能 (已完成)
- [x] 抓取框架
- [x] OpenRouter 爬虫
- [x] 数据库集成
- [x] GitHub Actions 自动化

### Phase 2: 扩展数据源 (进行中)
- [ ] OpenAI 官方定价
- [ ] Anthropic 官方定价
- [ ] 硅基流动
- [ ] DeepSeek 官方

### Phase 3: 增强功能
- [ ] 价格预测
- [ ] 告警通知（邮件/Webhook）
- [ ] 数据质量监控
- [ ] API 端点提供历史数据

## 💡 注意事项

1. **频率控制**: 不要过于频繁地抓取，尊重目标网站的服务条款
2. **错误处理**: 单个爬虫失败不应影响其他爬虫
3. **数据验证**: 始终验证抓取的数据是否合理
4. **增量更新**: 只在价格真正变化时记录历史

## 🤝 贡献

欢迎贡献新的数据源爬虫！请确保：
- 遵循现有代码风格
- 添加适当的错误处理
- 编写测试用例
- 更新文档
