'use client';

import { use } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, GitCompare, DollarSign, Globe } from "lucide-react";
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/lib/translations';

export default function HomePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const t = useTranslations('nav');

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">aiplans.dev</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href={`/${locale}`} className="text-sm font-medium text-blue-600">
              {t('home')}
            </Link>
            <Link href={`/${locale}/compare/plans`} className="text-sm font-medium hover:text-blue-600">
              {t('comparePlans')}
            </Link>
            <Link href={`/${locale}/api-pricing`} className="text-sm font-medium hover:text-blue-600">
              {t('apiPricing')}
            </Link>
            <Link href={`/${locale}/coupons`} className="text-sm font-medium hover:text-blue-600">
              {t('coupons')}
            </Link>
            <a
              href="https://github.com/x2v-co/aiplans"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:text-blue-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">
            {locale === 'zh' ? (
              <>💰 全网 AI 价格对比平台</>
            ) : (
              <>💰 Compare AI Pricing & Save Money</>
            )}
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
            {locale === 'zh' ? (
              '对比 GPT-4, Claude, DeepSeek 等主流 AI 模型在不同供应商的价格，找到最优惠的方案。'
            ) : (
              'Compare pricing for GPT-4, Claude, DeepSeek, and other AI models across providers to find the best deals.'
            )}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href={`/${locale}/compare/plans`}>
              <Button size="lg" className="gap-2">
                {locale === 'zh' ? '开始对比' : 'Start Comparing'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href={`/${locale}/api-pricing`}>
              <Button size="lg" variant="outline">
                {locale === 'zh' ? '查看 API 价格' : 'View API Pricing'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardContent className="p-6 text-center">
              <GitCompare className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-bold mb-2">
                {locale === 'zh' ? '全面对比' : 'Comprehensive Comparison'}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '对比官方和第三方渠道的价格、限速、性能等关键指标'
                  : 'Compare prices, rate limits, and performance across official and third-party channels'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-lg font-bold mb-2">
                {locale === 'zh' ? '省钱神器' : 'Save Money'}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '找到最优惠的供应商，节省高达 70% 的 API 成本'
                  : 'Find the cheapest providers and save up to 70% on API costs'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 text-purple-600" />
              <h3 className="text-lg font-bold mb-2">
                {locale === 'zh' ? '国内可用' : 'China Accessible'}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {locale === 'zh'
                  ? '标注国内可直连的渠道，支持支付宝/微信支付'
                  : 'Mark channels accessible from China with Alipay/WeChat support'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Hot Models */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8">
            {locale === 'zh' ? '🔥 热门模型对比' : '🔥 Popular Models'}
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {['claude-opus-4.6', 'gpt-5.2-high', 'gemini-3.1-pro', 'glm-5'].map((slug) => (
              <Link key={slug} href={`/${locale}/compare/plans/${slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-bold mb-2">
                      {slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </h3>
                    <Button variant="outline" size="sm" className="w-full">
                      {locale === 'zh' ? '对比价格' : 'Compare Prices'}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
          {locale === 'zh' ? '© 2026 aiplans.dev - 全网 AI 价格对比' : '© 2026 aiplans.dev - Compare AI Pricing & Save Money'}
        </div>
      </footer>
    </div>
  );
}
