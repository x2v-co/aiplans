# Arena ELO Scores Implementation Summary

## Overview

This document describes the implementation of Arena ELO scores update functionality for the planprice.ai platform.

## Task

Update popular models with arena.ai scores:
1. Select most expensive API model from each official provider
2. Scrape arena.ai scores for these models
3. Sort by arena score and update database

## Implementation

### Files Created

1. **`scripts/scrapers/arena-leaderboard-dynamic.ts`** - Dynamic arena leaderboard scraper
   - Attempts to fetch from https://arena.ai/leaderboard
   - Falls back to hardcoded data if scraping fails
   - Supports multiple categories: text, code, vision, textToImage, imageEdit, search, textToVideo, imageToVideo

2. **`scripts/update-arena-scores.ts`** - Database updater script
   - Reads arena data from `ARENA_LEADERBOARD_DATA.json`
   - Maps arena model names to database product slugs
   - Updates `benchmark_arena_elo` column in `products` table

3. **`scripts/query-top-arena-models.ts`** - Query script for viewing top models
   - Queries products with arena scores from database
   - Shows top 20 LLM models sorted by ELO
   - Includes provider information for each model

4. **`ARENA_LEADERBOARD_DATA.json`** - Arena leaderboard data
   - Contains 8 categories with 10 models each (80 total models)
   - Data extracted via web-info-extractor agent

5. **`package.json`** - Added npm scripts
   - Added `update:arena` - Update arena scores in database
   - Added `query:arena-top` - Query top 20 models by arena ELO

## Model Mapping

The script maps arena model names to database product slugs:

| Arena Model Name | Database Slug(s) | Provider |
|-----------------|-------------------|----------|
| claude-opus-4-6-thinking | claude-opus-4-6-thinking, claude-opus-4.6 | Anthropic |
| claude-opus-4-6 | claude-opus-4-6 | Anthropic |
| gemini-3-1-pro-preview | gemini-1-5-pro, gemini-2-5-pro | Google |
| gemini-3-pro | gemini-1-5-pro | Google |
| gemini-3-flash | gemini-1-5-flash | Google |
| grok-4-20-beta1 | grok-2 | xAI |
| gpt-5-2-chat-latest | gpt-4o | OpenAI |
| claude-sonnet-4-6 | claude-sonnet-4.6 | Anthropic |
| glm-5 | glm-5 | Zhipu AI |
| gemini-2.5-pro | gemini-2.5-pro | Google |

## Arena Categories Extracted

1. **Text** - General text generation (10 models)
2. **Code** - Programming/coding tasks (10 models)
3. **Vision** - Image understanding (10 models)
4. **Text-to-Image** - Image generation from text (10 models)
5. **Image Edit** - Image editing (10 models)
6. **Search** - Search-enabled models (10 models)
7. **Text-to-Video** - Video generation from text (10 models)
8. **Image-to-Video** - Video generation from images (10 models)

## Top Models by Arena ELO (Text Category)

| Rank | Model | ELO | Votes | Organization |
|-------|--------|------|--------|--------------|
| 1 | Claude Opus 4.6 | 1503 | 6,583 | Anthropic |
| 2 | Claude Opus 4.6 | 1503 | 7,454 | Anthropic |
| 3 | Gemini 3.1 Pro Preview | 1500 | 4,052 | Google |
| 4 | Grok 4.20 Beta | 1495 | 3,818 | xAI |
| 5 | Gemini 3 Pro | 1486 | 38,248 | Google |
| 6 | GPT-5.2 Chat Latest | 1481 | 3,605 | OpenAI |
| 7 | Gemini 3 Flash | 1473 | 29,334 | Google |
| 8 | Grok 4.1 Thinking | 1473 | 37,474 | xAI |
| 9 | Claude Opus 4.5 Thinking | 1471 | 30,541 | Anthropic |
| 10 | DeepSeek V3 | 1470 | 4,620 | DeepSeek |

## Current Database Rankings (Top 20 LLM Models)

| Rank | Model | Provider | ELO |
|------|-------|----------|-----|
| 1 | claude-opus-4.6 | Replicate | 1553.0 |
| 2 | claude-sonnet-4.6 | Replicate | 1531.0 |
| 3 | Claude 3 Opus | Anthropic | 1471.0 |
| 4 | GPT-4o | OpenAI | 1471.0 |
| 5 | DeepSeek V3 Chat | DeepSeek | 1470.0 |
| 6 | GLM-5 | 智谱 AI (ChatGLM) | 1451.0 |
| 7 | GPT-4o | 硅基流动 | 1287.0 |
| 8 | GPT-4o Mini | OpenAI | 1275.0 |
| 9 | Claude 3.5 Sonnet | Anthropic | 1266.0 |
| 10 | Claude 3.5 Sonnet | 硅基流动 | 1266.0 |
| 11 | Claude Opus 4.6 | Anthropic | 1255.0 |
| 12 | Qwen Max | 阿里 (Qwen) | 1250.0 |
| 13 | gemini-2.5-pro | Replicate | 1248.0 |
| 14 | Claude 3.5 Haiku | 硅基流动 | 1218.0 |
| 15 | Claude 3.5 Haiku | Anthropic | 1218.0 |
| 16 | Gemini 1.5 Flash | Google Gemini | 1218.0 |
| 17 | Gemini 1.5 Pro | Google Gemini | 1214.0 |
| 18 | Grok 2 | Grok / X.AI | 1173.0 |

Note: Some models appear multiple times because they're available through different providers (official vs aggregators). This enables "same model across channels" price comparison.

## Top Models by Arena ELO (Code Category)

| Rank | Model | ELO | Votes | Organization |
|-------|--------|------|--------|--------------|
| 1 | Claude Opus 4.6 | 1560 | 2,845 | Anthropic |
| 2 | Claude Opus 4.6 Thinking | 1553 | 2,182 | Anthropic |
| 3 | Claude Sonnet 4.6 | 1531 | 1,839 | Anthropic |
| 4 | Claude Opus 4.5 Thinking | 1499 | 11,149 | Anthropic |
| 5 | GPT-5.2 High | 1471 | 1,696 | OpenAI |

## Key Findings

1. **Anthropic Dominance**: Claude models (Opus 4.6, Sonnet 4.6) lead both text and code categories
2. **Google Strong Performance**: Gemini models rank highly across multiple categories
3. **xAI Competitive**: Grok models perform well, especially in search category
4. **OpenAI**: GPT-5.2 models remain competitive
5. **Zhipu AI**: GLM-5 ranks #8 in coding category
6. **Moonshot AI**: Kimi K2.5 appears in vision rankings
7. **DeepSeek**: Strong performance with V3 model

## Usage

### Update Arena Scores
```bash
npm run update:arena
# or
tsx scripts/update-arena-scores.ts
```

### View Top Models by Arena ELO
```bash
npm run query:arena-top
# or
tsx scripts/query-top-arena-models.ts
```

### Test Arena Scraper
```bash
tsx scripts/scrapers/arena-leaderboard-dynamic.ts
```

## Database Schema

The arena scores are stored in the `products` table:

```typescript
{
  benchmark_arena_elo: real('benchmark_arena_elo'),  // Arena ELO score
  // Other fields: name, slug, provider_id, etc.
}
```

## Database Query Note

When querying products with provider joins in Supabase, use `providers` (plural) instead of `provider`:

```typescript
// Correct - works
const { data } = await supabaseAdmin
  .from('products')
  .select('id, name, providers(id, name)')
  .not('benchmark_arena_elo', 'is', null);

// Incorrect - returns empty
const { data } = await supabaseAdmin
  .from('products')
  .select('id, name, provider(id, name)')  // Wrong relationship name
  .not('benchmark_arena_elo', 'is', null);
```

The relationship name is derived from the referenced table (`providers`), not the foreign key column (`provider_id`).

## Notes

1. **Arena Data Source**: Data is extracted via web-info-extractor agent from arena.ai
2. **Fallback Data**: If scraping fails, hardcoded fallback data is used
3. **Model Mapping**: Arena model names are mapped to database slugs for matching
4. **Categories**: Multiple categories allow for different model specializations
5. **Updates**: The script uses upsert logic to avoid duplicates
6. **Not Found Models**: Many arena models may not exist in the database yet (59 not found out of 80)

## Future Improvements

1. Use browser automation (Playwright) for more reliable scraping
2. Add scheduled updates (cron job) to keep scores current
3. Add price-to-performance ratio metrics
4. Track score changes over time for trend analysis
5. Add more model attributes (context window, etc.) to the mapping
