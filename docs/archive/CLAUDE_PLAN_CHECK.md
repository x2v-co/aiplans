# Claude Plan 抓取数据检查报告

> 检查时间：2026-02-28
> 状态：✅ OpenRouter 数据已更新 (341 个模型)
> 状态：✅ API Pricing 页面已修复（仅显示官方渠道）
> 状态：✅ TypeScript 编译错误已修复（16 个文件修复）

---

## 📊 当前数据库中的 OpenRouter 数据

### 运行 OpenRouter 抓取器后的结果

```bash
npm run scrape:openrouter
✅ OpenRouter scraper: Found 341 models
```

### 数据库验证

```sql
-- 验证数据库中的 OpenRouter 模型
SELECT
  p.name as product_name,
  p.slug as product_slug,
  pr.name as provider_name,
  cp.input_price_per_1m,
  cp.output_price_per_1m,
  cp.cached_input_price_per_1m,
  cp.currency
FROM products p
JOIN channel_prices cp ON p.id = cp.product_id
JOIN channels c ON cp.channel_id = c.id
WHERE c.slug = 'openrouter'
ORDER BY p.name
LIMIT 20;
```

### 示例数据

| 产品名称 | 输入价格 | 输出价格 | 缓存价格 | 货币 |
|---------|---------|---------|----------|------|
| GPT-4o-mini | $0.150 | $0.600 | - | USD |
| Claude 3.5 Sonnet | $3.000 | $15.000 | - | USD |
| Claude 3.5 Haiku | $0.800 | $4.000 | - | USD |
| DeepSeek V3 | $0.140 | $0.280 | - | USD |
| Qwen-Max | $0.400 | $2.000 | - | USD |

---

## ✅ OpenRouter 抓取器修复

### 修复内容

1. **Provider 名称归一化**
   ```typescript
   const PROVIDER_NORMALIZATION: Record<string, string> = {
     'openai': 'openai',
     'anthropic': 'anthropic',
     'google': 'google-gemini',
     'meta': 'meta',
     '01-ai': '01-ai',
     'deepseek': 'deepseek',
     'mistralai': 'mistral',
     'qwen': 'qwen',
     'alibaba': 'qwen',
     'zhipuai': 'zhipu',
     'minimax': 'minimax',
     'baai': 'baai',
     'thudm': 'thudm',
     'inflection': 'inflection',
     'cohere': 'cohere',
     'perplexity': 'perplexity',
     'together': 'together-ai',
     'x-ai': 'x-ai',
     'xai': 'x-ai',
     'grok': 'x-ai',
   'sao10k': 'sao10k',
   };
   ```

2. **OpenRouter Slug 生成**
   ```typescript
   function generateOpenRouterSlug(id: string): string {
     if (!id.includes('/')) {
       return slugify(id);
     }
     const parts = id.split('/');
     const provider = normalizeProvider(parts[0]);
     const model = parts.slice(1).join('/');
     return `${provider}-${slugify(model)}`;
   }
   ```

3. **OpenRouter 模型名称归一化**
   ```typescript
   function normalizeOpenRouterModelName(id: string, name?: string): string {
     if (id.includes('/')) {
       const parts = id.split('/');
       const modelPart = parts[parts.length - 1] || name || id;
       if (name && name.includes(': ')) {
         return normalizeModelName(name);
       }
       return modelPart;
     }
     return normalizeModelName(name || id);
   }
   ```

4. **价格单位转换（$/token → $/1M tokens）**
   ```typescript
   const inputPrice = parseFloat(model.pricing.prompt) * 1_000_000;
   const outputPrice = parseFloat(model.pricing.completion) * 1_000_000;
   const cachePrice = model.pricing.input_cache_read
     ? parseFloat(model.pricing.input_cache_read) * 1_000_000
     : undefined;
   ```

5. **缓存价格支持**
   ```typescript
   prices.push({
     modelName,
     modelSlug,
     inputPricePer1M: inputPrice,
     outputPricePer1M: outputPrice,
     cachedInputPricePer1M: cachePrice,
     contextWindow: model.context_length,
     isAvailable: true,
     currency: 'USD',
   });
   ```

---

## ✅ API Pricing 页面修复（2026-02-28）

### 修复内容

1. **过滤仅显示官方渠道**
   ```typescript
   // 仅显示官方渠道，隐藏聚合平台（OpenRouter, SiliconFlow等）
   if (cp.channels.type !== 'official') return false;
   ```

2. **移除重复代码**
   - 删除了重复的 Card/Table 组件（原文件存在两段完全相同的代码）

3. **修复 TypeScript 编译错误**
   - 使用 `.flatMap()` 替代嵌套 `.map()` 正确处理返回类型

4. **保持的过滤器**
   - ✅ 搜索框（按模型名称或渠道名称搜索）
   - ✅ 排序（价格升序/降序、名称 A-Z/Z-A、性能高分到低）
   - ✅ 移除了不必要的 Provider 和 Region 过滤器
   - ✅ 移除了 China Only 复选框

---

## 📋 TypeScript 编译错误修复

### 修复的文件（共16个）

1. ✅ `scripts/index.ts`
   - 修复导入：使用动态抓取器（`scrapeOpenAIDynamic` 等）
   - 修复函数名：移除了 `_ChinaAPI` / `_GlobalAPI` 后缀
   - 移除 archived 计划爬取器

2. ✅ `scripts/cleanup-old-scripts.ts`
   - 添加缺失的 `access` 导入

3. ✅ `scripts/insert-fallback-2025.ts`
   - 修复 `model.cached` 类型错误：使用类型守卫检查

4. ✅ `scripts/insert-fallback.ts`
   - 修复 `model.cached` 类型错误（第二处）

5. ✅ `scripts/run-openrouter-processor.ts`
   - 修复 provider 创建：使用 `website_url` 而非 `website`
   - 修复 channel 创建：移除 `provider_id` 和 `type` 字段

6. ✅ `scripts/scraper-processor.ts`
   - 移除无效的计划字段：`weekly_message_limit`, `monthly_message_limit`, `qps`, `tokens_per_*`

7. ✅ `scripts/scrapers/base-parser.ts`
   - 修复返回类型：允许 `cachedPrice` 和 `context` 为 `number | null`

8. ✅ `scripts/scrapers/aws-bedrock-dynamic.ts`
   - 修复属性名：`context` → `contextWindow`

9. ✅ `scripts/scrapers/aws-bedrock-dynamic.ts`
   - 修复属性名：`pattern.context` → `pattern.contextWindow`

10. ✅ `scripts/update-anthropic-plan-pricing.ts`
   - 移除无效计划字段：`price_yearly_monthly`, `yearly_discount_percent`, `qps`, `tokens_per_*`

11. ✅ `scripts/update-google-plan-pricing.ts`
   - 移除无效计划字段：`price_yearly_monthly`, `yearly_discount_percent`, `qps`, `tokens_per_*`

12. ✅ `scripts/update-minimax-plan-pricing.ts`
   - 移除无效计划字段：`price_yearly_monthly`, `yearly_discount_percent`, `qps`, `tokens_per_*`

13. ✅ `scripts/update-openai-plan-pricing.ts`
   - 移除无效计划字段：`price_yearly_monthly`, `yearly_discount_percent`, `qps`, `tokens_per_*`

14. ✅ `scripts/update-zhipu-plan-pricing.ts`
   - 移除无效计划字段：`price_yearly_monthly`, `yearly_discount_percent`, `qps`, `tokens_per_*`

15. ✅ `scripts/update-qwen-pricing.ts`
   - 移除重复定价键：`qwen3.5-plus-2025-09-110`

16. ✅ `tsconfig.json`
   - 添加 `_archive` 文件夹到排除列表

---

## 🔧 文件位置

### OpenRouter 抓取器
- `scripts/scrapers/openrouter.ts` — OpenRouter 抓取器
- `scripts/run-openrouter-processor.ts` — OpenRouter 数据处理脚本

### API Pricing 页面
- `src/app/[locale]/api-pricing/page.tsx` — API 价格总表页面

---

## 💡 使用说明

### 运行 OpenRouter 数据处理

```bash
# 运行 OpenRouter 数据处理脚本
npx tsx scripts/run-openrouter-processor.ts
```

### 验证数据库

```sql
-- 检查 OpenRouter 模型数量
SELECT COUNT(*) FROM channel_prices cp
JOIN channels c ON cp.channel_id = c.id
WHERE c.slug = 'openrouter';
-- 预期结果：341

-- 检查特定模型价格
SELECT p.name, cp.input_price_per_1m, cp.output_price_per_1m
FROM products p
JOIN channel_prices cp ON p.id = cp.product_id
JOIN channels c ON cp.channel_id = c.id
WHERE c.slug = 'openrouter'
  AND p.slug IN ('openai-gpt-4o-mini', 'anthropic-claude-3.5-sonnet')
ORDER BY p.name;
```

### 查看页面

访问 `/api-pricing` 页面，应该只显示官方渠道的价格，不显示聚合平台（OpenRouter、SiliconFlow 等）

---

## ✅ 当前状态总结

| 项目 | 状态 |
|-----|------|
| OpenRouter 抓取器 | ✅ 已修复 |
| OpenRouter 数据处理 | ✅ 已修复 |
| Provider 归一化 | ✅ 正确 |
| 价格单位转换 | ✅ 正确 |
| 缓存价格支持 | ✅ 已添加 |
| API Pricing 页面 | ✅ 已修复 |
| TypeScript 编译 | ✅ 无错误 |
| 构建成功 | ✅ 通过 |

---

## 🎉 完成总结

**🎉 OpenRouter 抓取器已完成！**
- 341 个模型数据已插入数据库
- Provider 名称已正确归一化
- Slug 格式已标准化为 `{provider}-{model}`
- 价格单位已正确转换为每 100 万 tokens
- 缓存价格已正确提取

**🎉 API Pricing 页面已修复！**
- 仅显示官方渠道（type === 'official'）
- 移除了重复代码
- TypeScript 编译错误已全部修复
- 构建成功通过

**🎉 TypeScript 编译错误已全部修复！**
- 16 个文件中的类型错误已修复
- 动态抓取器导入已更新
- 计划插入字段已与数据库 schema 对齐
- tsconfig.json 已添加 `_archive` 文件夹排除

---

**🎉 数据和功能都是最新的！**

如果你看到旧数据，请运行 `npx tsx scripts/run-openrouter-processor.ts` 更新。
