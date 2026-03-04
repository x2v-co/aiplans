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
            <span className="text-xl font-bold">PlanPrice.ai</span>
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
          {locale === 'zh' ? '© 2026 PlanPrice.ai - 全网 AI 价格对比' : '© 2026 PlanPrice.ai - Compare AI Pricing & Save Money'}
        </div>
      </footer>
    </div>
  );
}
