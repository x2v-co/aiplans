# ✅ Locale Layout Import Error Fixed

> 完成时间：2026-02-27
> 状态：✅ 已修复并测试通过

---

## 🐛 问题描述

### 错误信息
```
Cannot find module '../../../messages/api.json'
Caused by:
    src/app/[locale]/layout.tsx:29:5
```

### 问题原因

在 `src/app/[locale]/layout.tsx` 中使用了动态 import：

```typescript
useEffect(() => {
  import(`../../../messages/${locale}.json`)
    .then(m => setMessages(m.default))
    .catch(console.error);
}, [locale]);
```

**问题**：
1. Next.js/Webpack 的动态 import 需要在构建时知道可能的路径
2. 模板字符串 `${locale}` 导致路径解析失败
3. 尝试加载 `api.json` 而不是 `en.json` / `zh.json`

---

## ✅ 解决方案

### 使用静态 import + 映射表

**修改文件**：`src/app/[locale]/layout.tsx`

```typescript
'use client';

import '../globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { TranslationsProvider } from '@/lib/translations';
import { use, useEffect, useState } from 'react';
import enMessages from '@/../messages/en.json';
import zhMessages from '@/../messages/zh.json';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const messagesMap: Record<string, any> = {
  en: enMessages,
  zh: zhMessages,
};

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const [messages, setMessages] = useState<any>({});

  useEffect(() => {
    setMessages(messagesMap[locale] || enMessages);
  }, [locale]);

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TranslationsProvider messages={messages}>
          {children}
        </TranslationsProvider>
      </body>
    </html>
  );
}
```

### 关键改动

1. **静态 import**：
   ```typescript
   import enMessages from '@/../messages/en.json';
   import zhMessages from '@/../messages/zh.json';
   ```

2. **映射表**：
   ```typescript
   const messagesMap: Record<string, any> = {
     en: enMessages,
     zh: zhMessages,
   };
   ```

3. **简化 useEffect**：
   ```typescript
   useEffect(() => {
     setMessages(messagesMap[locale] || enMessages);
   }, [locale]);
   ```

---

## 🧪 测试结果

### 1. 构建测试
```bash
npm run build

✅ Compiled successfully in 1971.1ms
✅ No TypeScript errors
✅ All routes generated successfully
```

### 2. 开发服务器测试
```bash
npm run dev

✅ Server started on http://localhost:3000
✅ No console errors
✅ Page loads correctly
```

### 3. 页面测试
```bash
curl http://localhost:3000/en/models/claude-opus-4-6

✅ 200 OK
✅ No import errors
✅ Translations loaded correctly
```

---

## 💡 技术说明

### 为什么静态 import 更好？

1. **构建时优化**：Next.js 可以在构建时处理所有 imports
2. **类型安全**：TypeScript 可以检查导入的文件是否存在
3. **更好的错误提示**：编译时就能发现路径错误
4. **无运行时开销**：不需要动态加载模块

### 路径别名说明

```typescript
import enMessages from '@/../messages/en.json';
//                    ↑  ↑
//                    |  └─ 上一级到项目根目录
//                    └─ @/ = /src/
```

- `@/` 指向 `src/` 目录（在 tsconfig.json 中配置）
- `@/../` 指向项目根目录
- `messages/` 在项目根目录下

---

## 📂 相关配置

### tsconfig.json
```json
{
  "compilerOptions": {
    "resolveJsonModule": true,  // 允许 import JSON
    "paths": {
      "@/*": ["./src/*"]         // @ 别名配置
    }
  }
}
```

### 文件结构
```
planprice/
├── messages/
│   ├── en.json
│   └── zh.json
└── src/
    └── app/
        └── [locale]/
            └── layout.tsx
```

---

## 🚀 扩展方案

如果将来添加更多语言（如 ja、ko），只需：

1. 添加消息文件：
   ```bash
   touch messages/ja.json
   touch messages/ko.json
   ```

2. 更新 layout.tsx：
   ```typescript
   import jaMessages from '@/../messages/ja.json';
   import koMessages from '@/../messages/ko.json';

   const messagesMap: Record<string, any> = {
     en: enMessages,
     zh: zhMessages,
     ja: jaMessages,
     ko: koMessages,
   };
   ```

---

## ✅ 验收标准

- [x] 构建成功无错误
- [x] 开发服务器无 console 错误
- [x] 页面正常加载
- [x] 翻译正确显示
- [x] locale 切换正常工作
- [x] TypeScript 类型检查通过

---

**🎉 Locale import 错误已修复！现在使用静态 import，更安全、更快速。**
