# 🌐 中英文切换功能说明

## ✅ 已完成配置

全站中英文切换功能已经成功集成！使用 `next-intl` 实现完整的国际化支持。

## 🎯 功能特性

### 1. 自动语言检测
- 自动检测用户浏览器语言偏好
- 首次访问时跳转到对应语言版本

### 2. URL 路由结构
```
/en           - 英文首页
/zh           - 中文首页
/en/compare/plans    - 英文对比页面
/zh/compare/plans    - 中文对比页面
```

### 3. 语言切换按钮
- 页面右上角显示语言切换器
- EN / 中文 按钮
- 切换时保持当前页面路径

### 4. 翻译内容
已翻译的内容包括：
- ✅ 导航菜单
- ✅ 对比页面所有文案
- ✅ 按钮和标签
- ✅ 筛选器和表单
- ✅ 推荐和说明文本

## 📁 文件结构

```
src/
├── i18n.ts                          # 国际化配置
├── proxy.ts                         # 语言路由代理（Next.js 16+）
├── messages/
│   ├── en.json                      # 英文翻译
│   └── zh.json                      # 中文翻译
├── components/
│   └── LanguageSwitcher.tsx         # 语言切换组件
└── app/
    ├── page.tsx                     # 根页面重定向
    └── [locale]/                    # 语言动态路由
        ├── layout.tsx               # 国际化布局
        └── compare/plans/page.tsx   # 对比页面（已国际化）
```

## 🚀 使用方法

### 访问网站
1. **英文版本**: `http://localhost:3000/en`
2. **中文版本**: `http://localhost:3000/zh`
3. **自动检测**: `http://localhost:3000` (自动跳转到浏览器语言)

### 切换语言
点击页面右上角的 **EN / 中文** 按钮即可切换语言

## 📝 添加新的翻译

### 1. 在翻译文件中添加新的 key

**messages/en.json**
```json
{
  "mySection": {
    "title": "My Title",
    "description": "My Description"
  }
}
```

**messages/zh.json**
```json
{
  "mySection": {
    "title": "我的标题",
    "description": "我的描述"
  }
}
```

### 2. 在组件中使用翻译

**客户端组件 (Client Component):**
```tsx
'use client';

import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('mySection');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

**服务器组件 (Server Component):**
```tsx
import { getTranslations } from 'next-intl/server';

export default async function MyPage({ params: { locale } }) {
  const t = await getTranslations('mySection');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### 3. 带参数的翻译

**翻译文件:**
```json
{
  "welcome": "Welcome, {name}!",
  "itemCount": "You have {count} items"
}
```

**使用:**
```tsx
t('welcome', { name: 'John' })
// 输出: "Welcome, John!"

t('itemCount', { count: 5 })
// 输出: "You have 5 items"
```

## 🔗 链接处理

在所有内部链接前添加语言前缀：

```tsx
// ❌ 错误
<Link href="/compare/plans">Compare</Link>

// ✅ 正确
<Link href={`/${locale}/compare/plans`}>Compare</Link>
```

或使用 next-intl 的 Link 组件：
```tsx
import {Link} from 'next-intl';

<Link href="/compare/plans">Compare</Link>
// 自动添加语言前缀
```

## 📄 已迁移的页面

目前已完成国际化的页面：
- ✅ 首页 `/` → `/[locale]/page.tsx`
- ✅ `/compare/plans` - 模型选择页
- ✅ `/api-pricing` - API 价格对比页
- ✅ `/coupons` - 优惠码页

## 🔄 待迁移的页面

需要迁移到 `[locale]` 目录的页面：
- ⏳ 对比页详情 `/compare/plans/[model]`
- ⏳ 开源模型页 `/open-model/[slug]`
- ⏳ 套餐页 `/plans/[provider]`
- ⏳ 其他页面...

## 🛠️ 迁移步骤（针对其他页面）

### 1. 添加翻译到 messages/en.json 和 messages/zh.json

### 2. 移动页面到 [locale] 目录
```bash
mkdir -p src/app/[locale]/your-page
mv src/app/your-page/page.tsx src/app/[locale]/your-page/page.tsx
```

### 3. 更新页面组件
```tsx
// 添加 locale 参数
export default async function YourPage({
  params: { locale }
}: {
  params: { locale: string }
}) {
  // 获取翻译
  const t = await getTranslations('yourSection');

  // 使用翻译
  return <div>{t('title')}</div>;
}
```

### 4. 更新所有链接
```tsx
// 添加 locale 前缀
<Link href={`/${locale}/path`}>Link</Link>
```

### 5. 添加 LanguageSwitcher
```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

<header>
  {/* ... */}
  <LanguageSwitcher />
</header>
```

## 🎨 语言切换器样式

默认样式已配置，可以自定义：

```tsx
// src/components/LanguageSwitcher.tsx
// 修改按钮样式和布局
```

## 📊 当前状态

- ✅ 基础架构配置完成
- ✅ 翻译系统可用
- ✅ 语言切换器可用
- ✅ 核心页面已迁移（首页、对比、API 价格、优惠码）
- ⏳ 详情页面需要逐步迁移

## 🚀 下一步

1. **测试当前功能**:
   ```bash
   npm run dev
   # 访问 http://localhost:3000/en/compare/plans
   # 访问 http://localhost:3000/zh/compare/plans
   ```

2. **迁移其他页面**: 按照上述步骤迁移剩余页面

3. **补充翻译**: 添加更多页面的中英文翻译

4. **SEO 优化**: 为每个语言版本添加 hreflang 标签

## 💡 提示

- 翻译文件支持嵌套结构，便于组织
- 可以为不同语言设置不同的货币、日期格式
- 使用 TypeScript 时可以添加类型检查
- 记得在添加新功能时同时添加中英文翻译

## 🐛 故障排除

### 问题: 页面无法访问
- 检查页面是否在 `[locale]` 目录下
- 确保使用正确的路径 `/en/...` 或 `/zh/...`

### 问题: 翻译不显示
- 检查翻译 key 是否存在于 messages/*.json
- 确保正确使用 `useTranslations` 或 `getTranslations`

### 问题: 语言切换不工作
- 检查 proxy.ts（Next.js 16+）或 middleware.ts 是否正确配置
- 确保所有链接都包含语言前缀

---

**国际化系统已就绪！** 🌍 现在可以开始迁移其他页面并添加更多翻译内容。
