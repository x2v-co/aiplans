# Arena Leaderboard Update - 2026-03-03

## Summary

Successfully added 7 missing models to the database and updated Arena ELO scores for all 20 models from arena.ai code leaderboard.

## Added Models (7)

| Model | Slug | Provider | ELO |
|-------|-------|----------|-----|
| Claude Opus 4.5 Thinking | claude-opus-4.5-thinking | Anthropic | 1499 |
| Claude Opus 4.5 | claude-opus-4.5 | Anthropic | 1471 |
| Claude Sonnet 4.5 Thinking | claude-sonnet-4.5-thinking | Anthropic | 1388 |
| Gemini 3 Flash Thinking | gemini-3-flash-thinking | Google Gemini | 1399 |
| Qwen 3.5 397B | qwen3.5-397b | 阿里 Qwen | 1396 |
| Kimi K2.5 Thinking | kimi-k2.5-thinking | 月之暗面 国际 (Moonshot) | 1436 |
| Kimi K2.5 Instant | kimi-k2.5-instant | 月之暗面 国际 (Moonshot) | 1419 |

## Final Top 20 Models by Arena ELO

| Rank | Model | Provider | ELO |
|------|-------|----------|-----|
| 1 | claude-opus-4.6 | Replicate | 1560.0 |
| 2 | claude-sonnet-4.6 | Replicate | 1531.0 |
| 3 | Claude 3 Opus | Anthropic | 1499.0 |
| 4 | Claude Opus 4.5 Thinking | Anthropic | 1499.0 |
| 5 | Claude Opus 4.5 | Anthropic | 1499.0 |
| 6 | gpt-5.2 | Replicate | 1471.0 |
| 7 | GPT-4o | OpenAI | 1471.0 |
| 8 | DeepSeek V3 Chat | DeepSeek | 1470.0 |
| 9 | gemini-1.5-pro | Google Gemini | 1461.0 |
| 10 | gemini-3.1-pro | Replicate | 1461.0 |
| 11 | GLM-5 | 智谱 AI (ChatGLM) | 1451.0 |
| 12 | Gemini 3 Pro | Google Gemini | 1443.0 |
| 13 | Gemini 3 Flash | Google Gemini | 1441.0 |
| 14 | gemini-1.5-flash | Google Gemini | 1441.0 |
| 15 | GLM-4.7 | 智谱 AI (ChatGLM) | 1439.0 |
| 16 | MiniMax M2.5 | 月之暗面 国际 | 1436.0 |
| 17 | Kimi K2.5 Thinking | 月之暗面 国际 | 1436.0 |
| 18 | MiniMax M2.1 | 月之暗面 国际 | 1401.0 |
| 19 | Qwen 3.5 397B | 阿里 Qwen | 1396.0 |
| 20 | GPT-4o Mini | OpenAI | 1392.0 |

## Scripts

```bash
# Add missing arena models to database
npm run add:arena-models

# Update arena ELO scores from arena.ai
npm run update:arena

# Query top arena models
npm run query:arena-top
```

## Files

- `scripts/add-missing-arena-models.ts` - Script to add missing models
- `scripts/update-arena-scores-v2.ts` - Script to update Arena ELO scores
- `scripts/query-top-arena-models.ts` - Script to query top models
- `ARENA_LEADERBOARD_DATA.json` - Arena data source
- `ARENA_LEADERBOARD_2026_03.json` - Backup of Arena data

## Key Findings

1. **Claude Dominance**: Claude models occupy 5 of top 20 positions
2. **OpenAI**: GPT-5.2 and GPT-4o series competitive
3. **Chinese Models**: GLM-5, MiniMax, Kimi all in top 20
4. **Gemini**: Multiple Gemini 3 variants rank well
5. **Model Versions**: Arena uses hyphens (-) for version numbers, database uses dots (.)
