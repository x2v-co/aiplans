# Plan Scrapers Implementation Summary

## Overview

This document describes the implementation of subscription plan scrapers for AI service providers. The scrapers fetch subscription pricing data from provider websites and save it to the database.

## Files Created

### Plan Scraper Files (12 scrapers)

1. **`scripts/scrapers/plan-openai-dynamic.ts`** - OpenAI ChatGPT plans
   - URL: https://openai.com/chatgpt/pricing/
   - Plans: Free, Plus ($20/mo), Team ($25/mo), Pro ($200/mo), Enterprise

2. **`scripts/scrapers/plan-anthropic-dynamic.ts`** - Anthropic Claude plans
   - URL: https://claude.com/pricing
   - Plans: Pro ($20/mo), Team ($25/mo), Enterprise

3. **`scripts/scrapers/plan-google-gemini-dynamic.ts`** - Google Gemini plans
   - URL: https://gemini.google/subscriptions
   - Plans: Free, Advanced ($19.99/mo), Enterprise

4. **`scripts/scrapers/plan-mistral-dynamic.ts`** - Mistral AI plans
   - URL: https://mistral.ai/pricing
   - Plans: Free, Pro (€15/mo), Enterprise

5. **`scripts/scrapers/plan-minimax-dynamic.ts`** - Minimax China plans
   - URL: https://platform.minimaxi.com/docs/guides/pricing-coding-plan
   - Invite Link: https://platform.minimaxi.com/subscribe/coding-plan?code=GOCSHm96x2&source=link
   - Plans: Free, Lite (¥29/mo), Pro (¥99/mo), Team (¥299/mo), Enterprise

6. **`scripts/scrapers/plan-minimax-global-dynamic.ts`** - Minimax Global plans
   - URL: https://platform.minimax.io/docs/guides/pricing-coding-plan
   - Plans: Free, Lite ($5/mo), Pro ($15/mo), Team ($45/mo), Enterprise

7. **`scripts/scrapers/plan-zhipu-dynamic.ts`** - Zhipu AI China (GLM Coding) plans
   - URL: https://bigmodel.cn/glm-coding
   - Invite Link: https://www.bigmodel.cn/glm-coding?ic=U2SFC0L765
   - Plans: Lite (~¥44/mo), Pro (~¥134/mo), Max (~¥422/mo), Team
   - Discounts: Quarterly 10%, Yearly 30%

8. **`scripts/scrapers/plan-zhipu-global-dynamic.ts`** - Zhipu AI Global (Z.AI) plans
   - URL: https://z.ai/subscribe
   - Invite Link: https://z.ai/subscribe?ic=HFGTURQAPY
   - Plans: Free, Lite ($7/mo), Pro ($20/mo), Team ($60/mo), Enterprise

9. **`scripts/scrapers/plan-moonshot-dynamic.ts`** - Moonshot (Kimi) plans
   - URL: https://platform.moonshot.cn/pricing/chat
   - Plans: Free, Basic (¥12/mo), Pro (¥68/mo), Team (¥198/mo), Enterprise

10. **`scripts/scrapers/plan-baidu-dynamic.ts`** - Baidu ERNIE plans
    - URL: https://console.bce.baidu.com/qianfan/resource/subscribe
    - Plans: Free, Monthly (¥19.90/mo), Annual (¥199/yr), Enterprise

11. **`scripts/scrapers/plan-volcengine-dynamic.ts`** - Volcengine (Seed/字节跳动) plans
    - URL: https://www.volcengine.com/docs/82379/1925114
    - Invite Link: https://volcengine.com/L/_uDpCXoFKP0/
    - Plans: Free Trial, Lite (¥19/mo, promo ¥9.90), Pro (¥59/mo, promo ¥29.90), Team, Enterprise

12. **`scripts/scrapers/plan-qwen-dynamic.ts`** - Alibaba Qwen plans
    - URL: https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=3005961
    - Invite Link: https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12401178..10263..
    - Note: Qwen primarily uses pay-as-you-go token pricing
    - Plans: Free Trial, Pay-As-You-Go, Token Pack, Enterprise

### Entry Point

**`scripts/index-plans-dynamic.ts`** - Main entry point for running all plan scrapers
- Runs all scrapers sequentially to avoid rate limiting
- Saves plans to database using upsert operations
- Cleans up outdated plans
- Supports `--dry-run` mode for testing without database changes
- Supports `--provider=<key>` for running specific provider

## Database Functions Added

Added to `scripts/db/queries.ts`:

- `getPlansByProviderId(providerId)` - Get all plans for a provider
- `updatePlan(planId, data)` - Update existing plan
- `deletePlan(planId)` - Delete a plan
- `cleanupOutdatedPlans(providerId, currentSlugs)` - Delete plans not in current scrape
- `getPlanByProviderSlug(providerId, slug)` - Get plan by provider and slug

## Usage

### Run all plan scrapers
```bash
npm run scrape:plans
# or
tsx scripts/index-plans-dynamic.ts
```

### Run specific provider
```bash
tsx scripts/index-plans-dynamic.ts --provider=openai
tsx scripts/index-plans-dynamic.ts --provider=anthropic
tsx scripts/index-plans-dynamic.ts --provider=zhipu
```

### Dry run (test without saving to database)
```bash
npm run scrape:plans:dry-run
# or
tsx scripts/index-plans-dynamic.ts --dry-run
```

### Run individual scraper for testing
```bash
tsx scripts/scrapers/plan-openai-dynamic.ts
tsx scripts/scrapers/plan-anthropic-dynamic.ts
tsx scripts/scrapers/plan-google-gemini-dynamic.ts
tsx scripts/scrapers/plan-mistral-dynamic.ts
tsx scripts/scrapers/plan-minimax-dynamic.ts
tsx scripts/scrapers/plan-minimax-global-dynamic.ts
tsx scripts/scrapers/plan-zhipu-dynamic.ts
tsx scripts/scrapers/plan-zhipu-global-dynamic.ts
tsx scripts/scrapers/plan-moonshot-dynamic.ts
tsx scripts/scrapers/plan-baidu-dynamic.ts
tsx scripts/scrapers/plan-volcengine-dynamic.ts
tsx scripts/scrapers/plan-qwen-dynamic.ts
```

## Data Structure

### ScrapedPlan Interface
```typescript
interface ScrapedPlan {
  planName: string;
  planSlug: string;
  priceMonthly: number;
  priceYearly?: number;
  pricingModel: 'subscription' | 'token_pack' | 'pay_as_you_go';
  tier: 'free' | 'basic' | 'pro' | 'team' | 'enterprise';
  currency?: CurrencyCode;  // 'USD' | 'CNY' | 'EUR'
  dailyMessageLimit?: number;
  requestsPerMinute?: number;
  qps?: number;
  tokensPerMinute?: number;
  features: string[];
  models: string[];
  region: string;
  accessFromChina: boolean;
  paymentMethods: string[];
  isOfficial: boolean;
}
```

## Provider Configuration

Each provider has the following metadata stored in the database:

| Provider | Slug | Region | Currency | Invite Link | Notes |
|----------|-------|--------|----------|--------------|-------|
| OpenAI | openai | global | USD | - | ChatGPT plans |
| Anthropic | anthropic | global | USD | - | Claude plans |
| Google | google-gemini | global | USD | - | Gemini plans |
| Mistral | mistral | global | EUR | - | Le Chat plans |
| Minimax | minimax | china | CNY | ... | Minimax China |
| Minimax Global | minimax-global | global | USD | - | Minimax Global |
| Zhipu | zhipu | china | CNY | ... | GLM Coding |
| Zhipu Global | zhipu-global | global | USD | ... | Z.AI |
| Moonshot | moonshot | china | CNY | - | Kimi |
| Baidu | baidu | china | CNY | - | ERNIE |
| Volcengine | volcengine | both | CNY | ... | Seed/字节跳动 |
| Qwen | qwen | both | CNY | ... | Alibaba |

## Fallback Data Strategy

Each scraper includes fallback data that is used when:
1. The provider's website is unavailable
2. The HTML parsing fails to extract pricing information
3. The API returns an error

Fallback data includes known pricing information as of 2025-2026 and will be updated periodically.

## Data Validation

All plans are validated before saving:
- `validatePlanPrice()` - Ensures price is a valid number (0 <= price < 100000)
- `slugifyPlan()` - Creates URL-friendly slugs from plan names
- `normalizePlanName()` - Normalizes plan names (trims whitespace)

## Cleanup Process

After each scrape:
1. All current plan slugs are collected
2. Plans in the database that are not in the current slug list are deleted
3. This ensures outdated plans are removed automatically

## Invite Links

The following invite links are preserved and can be displayed on the frontend:

| Provider | Invite Link |
|----------|-------------|
| Minimax China | https://platform.minimaxi.com/subscribe/coding-plan?code=GOCSHm96x2&source=link |
| Zhipu China | https://www.bigmodel.cn/glm-coding?ic=U2SFC0L765 |
| Zhipu Global | https://z.ai/subscribe?ic=HFGTURQAPY |
| Qwen | https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12401178..10263.. |
| Volcengine | https://volcengine.com/L/_uDpCXoFKP0/ |

## Notes

1. **Qwen Special Case**: Qwen primarily uses pay-as-you-go token pricing rather than traditional monthly subscriptions. The scraper reflects this by using `pay_as_you_go` and `token_pack` pricing models.

2. **Volcengine Limitation**: The Volcengine (Seed) plans are specifically for the programming tool and cannot be used for API calls. This is noted in the plan features.

3. **Zhipu Discounts**: Zhipu China plans include quarterly (10% off) and yearly (30% off) discounts which are reflected in the yearly price calculation.

4. **China Accessibility**: Most Chinese providers (Minimax, Zhipu, Moonshot, Baidu, Volcengine, Qwen) are accessible from both China and globally.

## Future Enhancements

1. Use web-info-extractor agent for more reliable data extraction
2. Add price change tracking and notifications
3. Implement scheduled scraping (cron jobs)
4. Add more detailed rate limit information
5. Add regional pricing variations (if applicable)
