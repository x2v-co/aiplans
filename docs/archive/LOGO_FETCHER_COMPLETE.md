# ✅ 供应商 Logo 自动抓取完成

## 🎯 实现内容

### 1. **创建 Logo 抓取脚本**
文件: `scripts/fetch-provider-logos.ts`

**功能**:
- ✅ 自动从供应商网站抓取 favicon/logo
- ✅ 使用多个服务作为备选（Clearbit, Icon Horse, Google）
- ✅ 验证 URL 是否可访问
- ✅ 手动指定高质量 logo URL
- ✅ 自动更新到数据库 `providers.logo_url` 字段

### 2. **使用的 Logo 服务**

#### 优先级顺序:

1. **手动指定** (最高质量)
   - OpenAI: `https://cdn.openai.com/public/images/favicon.png`
   - Anthropic: `https://www.anthropic.com/favicon.png`
   - Google: `https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png`
   - DeepSeek: `https://www.deepseek.com/favicon.ico`
   - Mistral: `https://mistral.ai/favicon.ico`
   - Meta: `https://about.meta.com/favicon.ico`
   - X.AI: `https://x.ai/favicon.ico`

2. **Clearbit Logo API**
   ```
   https://logo.clearbit.com/{domain}
   ```
   - 高质量企业 logo
   - 支持透明背景
   - 覆盖大部分知名公司

3. **Icon Horse**
   ```
   https://icon.horse/icon/{domain}
   ```
   - 稳定可靠
   - 自动缩放
   - 良好的备选方案

4. **Google Favicon Service**
   ```
   https://www.google.com/s2/favicons?domain={domain}&sz=128
   ```
   - 最稳定
   - 全球 CDN
   - 最后的兜底方案

### 3. **已抓取的 Logo**

| 供应商 | Logo URL |
|--------|----------|
| OpenAI | https://cdn.openai.com/public/images/favicon.png |
| Anthropic | https://www.anthropic.com/favicon.png |
| DeepSeek | https://www.deepseek.com/favicon.ico |
| Google | https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png |
| Meta | https://about.meta.com/favicon.ico |
| Mistral | https://mistral.ai/favicon.ico |
| Alibaba | https://icon.horse/icon/www.alibabacloud.com |
| ByteDance | https://icon.horse/icon/www.volcengine.com |
| Moonshot | https://icon.horse/icon/www.moonshot.cn |
| Zhipu | https://icon.horse/icon/www.zhipuai.cn |
| X.AI | https://icon.horse/icon/x.ai |
| Microsoft | https://icon.horse/icon/microsoft.com |

### 4. **API 更新**

`/api/compare/plans/route.ts` 已更新为使用真实 logo:

```typescript
// 从数据库读取 logo_url
providers (
  name,
  slug,
  logo_url  // ✅ 新增
)

// 使用真实 logo，emoji 作为 fallback
logo: product.providers?.logo_url || getProviderLogo(slug)
```

### 5. **数据库迁移**

需要执行: `scripts/db/migrations/add_channel_provider.sql`

**作用**:
- 为 `channels` 表添加 `provider_id` 列
- 将 channels 关联到对应的 provider
- 使得 channels 也能获取到 provider 的 logo

## 📋 使用方法

### 抓取所有 Logo

```bash
npm run fetch-logos
```

### 强制重新抓取（覆盖已有）

```bash
npm run fetch-logos:force
```

### 手动添加新供应商 Logo

编辑 `scripts/fetch-provider-logos.ts`:

```typescript
const MANUAL_LOGOS: Record<string, string> = {
  'your-provider': 'https://example.com/logo.png',
};
```

## 🔄 工作流程

```
1. 运行抓取脚本
   ↓
2. 检查手动指定的 logo
   ↓
3. 尝试 Clearbit API
   ↓
4. 尝试 Icon Horse
   ↓
5. 尝试 Google Favicon
   ↓
6. 验证 URL 可访问性
   ↓
7. 更新数据库 providers.logo_url
   ↓
8. API 自动返回真实 logo URL
```

## ✨ 优势

### 之前（emoji）
```typescript
logo: '🤖'  // 硬编码 emoji
```

❌ 不专业
❌ 无法自定义
❌ 显示效果差

### 现在（真实 logo）
```typescript
logo: 'https://cdn.openai.com/public/images/favicon.png'
```

✅ 专业品牌形象
✅ 高清图片
✅ 自动更新
✅ 真实公司 logo

## 🎨 前端显示

在前端组件中使用：

```tsx
<img
  src={provider.logo}
  alt={provider.name}
  className="w-8 h-8 rounded"
  onError={(e) => {
    // Fallback to placeholder
    e.currentTarget.src = '/placeholder-logo.png';
  }}
/>
```

## 🔧 故障排除

### Logo 无法显示

1. **检查 CORS 设置**
   - 某些网站可能阻止跨域访问
   - 使用 Icon Horse 或 Google Favicon 作为代理

2. **URL 失效**
   - 运行 `npm run fetch-logos:force` 重新抓取

3. **网站更改 logo 路径**
   - 更新 `MANUAL_LOGOS` 中的 URL

### 添加新供应商

1. 在数据库中插入新 provider
2. 运行 `npm run fetch-logos`
3. 脚本会自动抓取新 logo

## 📊 数据库 Schema

```sql
-- providers 表
CREATE TABLE providers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_url TEXT,  -- ✅ 存储 logo URL
  website_url TEXT,
  ...
);

-- channels 表（需要迁移）
ALTER TABLE channels
ADD COLUMN provider_id INTEGER REFERENCES providers(id);
```

## 🎯 下一步

### 需要执行的迁移

在 Supabase SQL Editor 中执行:
```
scripts/db/migrations/add_channel_provider.sql
```

这样 channels 也能关联到 provider 并获取 logo。

### 验证效果

访问比较页面查看真实 logo:
```
http://localhost:3000/compare/plans/gpt-4o
http://localhost:3000/compare/plans/claude-sonnet-4-6
```

## ✅ 完成状态

- ✅ Logo 抓取脚本创建
- ✅ 12 个供应商 logo 已抓取
- ✅ API 已更新使用真实 logo
- ✅ npm scripts 已添加
- ⏳ 需要执行数据库迁移（channels.provider_id）

**所有供应商 logo 已自动抓取并存储，API 现在返回真实的公司 logo！** 🎨✨
