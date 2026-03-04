# 🔧 修复 API Pricing 页面 Logo 显示

## 问题
API Pricing 页面仍显示 emoji logo 而不是真实的公司 logo。

## 已完成的修复

### 1. 更新 API 端点

✅ **`/api/products`** - 现在包含 provider 的 logo_url
```typescript
providers (
  id,
  name,
  slug,
  logo_url  // ✅ 新增
)
```

✅ **`/api/channels/[productId]`** - 现在包含 provider 信息
```typescript
channels (
  ...
  provider_id,
  providers (logo_url)
),
products (
  ...
  providers (logo_url)
)
```

### 2. 更新前端组件

✅ **`src/app/[locale]/api-pricing/page.tsx`**
- 移除硬编码的 `providerMeta` 对象（emoji）
- 从 API 数据中获取真实 logo_url
- 使用 `<img>` 标签显示 logo

## ⚠️ 需要执行的数据库迁移

在 Supabase SQL Editor 中执行：

```sql
-- 文件: scripts/db/migrations/add_channel_provider.sql
```

这个迁移会：
1. 为 `channels` 表添加 `provider_id` 列
2. 根据渠道名称自动关联到对应的 provider
3. 使得 channels 可以获取到 provider 的 logo

## 🧪 验证步骤

### 执行迁移后：

1. **重启开发服务器**
```bash
npm run dev
```

2. **访问 API Pricing 页面**
```
http://localhost:3000/zh/api-pricing
http://localhost:3000/en/api-pricing
```

3. **检查以下内容**
- ✅ 供应商 logo 显示为真实图片（不是 emoji）
- ✅ 筛选标签中的 logo 正确显示
- ✅ 表格中的 provider logo 正确显示
- ✅ 图片加载失败时有 placeholder

### 测试 API 响应

```bash
# 测试产品列表 API
curl "http://localhost:3000/api/products?type=llm" | jq '.[0] | {name, providers}'

# 应该返回包含 logo_url 的数据：
{
  "name": "gpt-4o",
  "providers": {
    "id": 1,
    "name": "OpenAI",
    "slug": "openai",
    "logo_url": "https://icon.horse/icon/openai.com"
  }
}
```

## 📊 Logo 显示位置

### 1. 筛选器中的 Provider 标签
```tsx
<Badge>
  <img src={provider.logo} className="w-4 h-4 rounded" />
  {provider.name}
</Badge>
```

### 2. 表格中的模型信息
```tsx
<div className="flex items-center gap-1">
  <img src={product.providers.logo_url} className="w-4 h-4 rounded" />
  <span>{product.providers.name}</span>
</div>
```

## 🎨 Logo 来源

所有 logo 现在通过 Icon Horse 服务获取：
- OpenAI: `https://icon.horse/icon/openai.com`
- Anthropic: `https://icon.horse/icon/anthropic.com`
- Google: `https://icon.horse/icon/ai.google.dev`
- DeepSeek: `https://icon.horse/icon/deepseek.com`
- 等等...

## 🔄 更新流程

```
1. 数据库存储 logo_url (providers.logo_url)
   ↓
2. API 查询时 join providers 表
   ↓
3. 返回包含 logo_url 的数据
   ↓
4. 前端使用 <img> 显示
   ↓
5. 图片加载失败时显示 placeholder
```

## 故障排除

### Logo 不显示
1. 检查数据库中 `providers.logo_url` 是否有值
   ```sql
   SELECT name, logo_url FROM providers;
   ```

2. 如果为空，运行 logo 抓取脚本
   ```bash
   npm run fetch-logos:force
   ```

3. 检查 API 响应是否包含 `providers.logo_url`

### 仍显示 emoji
1. 确保已执行 `add_channel_provider.sql` 迁移
2. 清除浏览器缓存
3. 重启开发服务器

## ✅ 完成检查清单

执行迁移后，确认以下项目：

- [ ] 执行了 `add_channel_provider.sql` 迁移
- [ ] channels 表有 `provider_id` 列
- [ ] `/api/products` 返回 providers.logo_url
- [ ] `/api/channels/[id]` 返回 providers 信息
- [ ] API Pricing 页面显示真实 logo 图片
- [ ] 筛选标签中的 logo 正确显示
- [ ] 表格中的 provider logo 正确显示

**执行迁移后，API Pricing 页面将显示真实的公司 logo！** 🎨✨
