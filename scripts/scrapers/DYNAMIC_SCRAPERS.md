# Dynamic Scrapers Documentation

This directory contains the new dynamic scraper system for planprice.ai.

## Last Updated: 2026-03-02

## Architecture

### Base Infrastructure

- **`base-fetcher.ts`** - HTTP client with retry logic and exponential backoff
- **`base-parser.ts`** - HTML parsing utilities (price parsing, card parsing, number parsing, rate limiting)

### Provider Configuration

- **`../utils/provider-config.ts`** - Complete provider metadata from SCRAPER_TABLE.md (28+ providers)

### Dynamic Scrapers

#### Phase 1: API-Based (Priority ⭐⭐⭐)

These scrapers fetch data directly from public API endpoints. **NO FALLBACK DATA** - fail cleanly with errors when scraping fails.

| Scraper | API Endpoint | Status |
|---------|--------------|--------|
|---------|--------------|----------------|--------|
| DeepSeek | /v1/models | deepseek-chat, deepseek-reasoner (2 main models) | ✅ Working |
| OpenRouter | /v1/models | 300+ models | ✅ Working |
| Anthropic | pricing page | Claude 4.6, Haiku 4.5 (3 models) | ✅ Updated |
| Grok/X.AI | - | grok-4 series, grok-3, grok-2 (9+ models) | ✅ Updated |
| Together AI | /v1/models | - (needs API key) | ⚠️ Empty |
| SiliconFlow | /v1/models | ~30 models | ✅ Working |

#### Phase 2: HTML-Based (Priority ⭐⭐⭐)

These scrapers parse pricing pages using Playwright. **NO FALLBACK DATA** - fail cleanly with errors when parsing fails.

| Scraper | URL | Status |
|---------|------|--------|
| OpenAI | api-pricing | GPT-5.2, GPT-5 mini, o4-mini, Sora-2 (15+ models) | ✅ Updated |
| Google Gemini | ai.google.dev/pricing | Gemini 2.0/2.5/3.x series (17 models) | ✅ Updated |
| AWS Bedrock | aws.amazon.com/bedrock | Claude 3.5 Sonnet/Haiku (via API) | ✅ Working |
| Azure OpenAI | azure.microsoft.com | GPT-4o, 4o-mini, 4-turbo, 3.5 Turbo (4) | ✅ Working |
| Vertex AI | cloud.google.com/vertex-ai | Gemini 2.0/2.5/3.x series (17 models) | ✅ Updated |

#### Phase 3: Official Providers (Priority ⭐⭐⭐)

These scrapers cover additional official AI providers.

| Scraper | URL | Models | Currency | Status |
|---------|------|--------|----------|--------|
| Mistral AI | mistral.ai/pricing | Mistral Large 3, Devstral 2, Ministral 3 series (24+ models) | USD | ✅ Updated |
| Moonshot/Kimi | platform.moonshot.cn/docs/pricing/chat | Kimi K2.5, Kimi K2, Moonshot-v1 (12 models) | CNY | ✅ Updated |
| Minimax | platform.minimaxi.com/docs/guides/pricing-paygo | MiniMax-M2.5, M2.5-highspeed, M2.1, M2.1-highspeed, M2 (5 models) | CNY | ✅ Updated |
| Zhipu AI/GLM | bigmodel.cn/pricing | GLM-5 series, GLM-4.7, GLM-4.5-Air (36+ models) | CNY | ✅ Updated |
| Qwen/通义千问 | bailian.console.aliyun.com | qwen-plus/turbo/max, qwen2.5-72b/7b (7+ models) | CNY | ✅ Updated |
| Seed/Volcengine | volcengine.com/docs/82379/1544106 | step-1/2/3 series, vision, audio (21 models) | CNY | ✅ Updated |

#### Phase 4: Cloud/Aggregator/Reseller (Priority ⭐⭐⭐)

These scrapers cover cloud providers, aggregators, and resellers.

| Scraper | Type | Models | Currency | Status |
|---------|------|--------|----------|--------|
| Hunyuan | Official | Hunyuan-T1, HY 2.0, Vision models (13 models) | CNY | ✅ Updated |
| Baidu ERNIE | Official | ERNIE 5.0, ERNIE 4.5 Turbo, ERNIE X1 (10+ models) | CNY | ✅ Updated |
| Fireworks AI | Aggregator | Parameter-based pricing, GLM-5, Kimi K2.5, etc. | USD | ✅ Updated |
| Replicate | Aggregator | Hardware-time based, token-based for select models | USD | ⚠️ Limited |
| Anyscale | Aggregator | Acquired by Replicate (merged) | USD | ⚠️ Deprecated |
| StepFun | Official | step-1/2/3 series, vision, audio models (21 models) | CNY | ✅ Updated |
| DMXAPI | Reseller | gpt-4o/4o-mini, claude-3.5/haiku, deepseek, gemini (7 models) | CNY | ✅ Working |

## Latest Pricing Data

### OpenAI (USD per 1M tokens) - UPDATED March 2026
**NEW: GPT-5 Series Flagship Models**
- `gpt-5.2`: Input: $1.75, Output: $14.00
- `gpt-5.2-pro`: Input: $21.00, Output: $168.00 (most intelligent)
- `gpt-5-mini`: Input: $0.25, Output: $2.00 (fast, affordable)

**NEW: Specialized Models**
- `o4-mini`: New reasoning-focused model for fine-tuning
- `sora-2` & `sora-2-pro`: Video generation models (per-second pricing)
- `gpt-image-1.5` / `gpt-image-1` / `gpt-image-1-mini`: Image generation models
- `gpt-realtime` / `gpt-realtime-mini`: Real-time API with text/audio/image

**Legacy Models**
- `gpt-4.1`: Input: $2.00, Output: $8.00, Cached: $1.00, Context: 128K
- `gpt-4o`: Input: $2.50, Output: $10.00, Cached: $1.25, Context: 128K
- `gpt-4o-mini`: Input: $0.15, Output: $0.60, Cached: $0.075, Context: 128K
- `o1`: Input: $15.00, Output: $60.00, Context: 200K (legacy)
- `o3-mini`: Input: $3.00, Output: $12.00, Context: 200K (legacy)

### Anthropic (USD per 1M tokens) - UPDATED March 2026
**NEW: Claude 4.6 Models**
- `claude-opus-4-6`: Input: $5.00, Output: $25.00, Cached: $0.50, Context: 200K (67% cheaper than 3 Opus)
- `claude-sonnet-4-6`: Input: $3.00, Output: $15.00, Cached: $0.30, Context: 200K (same pricing as 3.5 Sonnet)
- `claude-haiku-4-5-20251001`: Input: $1.00, Output: $5.00, Cached: $0.10, Context: 200K (4x more than 3 Haiku)

**Legacy Models**
- `claude-3-5-sonnet`: Input: $3.00, Output: $15.00, Cached: $0.10, Context: 200K
- `claude-3.5-haiku`: Input: $0.80, Output: $4.00, Cached: $0.025, Context: 200K
- `claude-3-opus`: Input: $15.00, Output: $75.00, Context: 200K
- `claude-3-7-sonnet`: Input: $3.00, Output: $15.00, Context: 200K

### Google Gemini (USD per 1M tokens) - UPDATED March 2026
**Gemini 2.0 Series (NEW)**
- `gemini-2.0-flash`: Input: $0.10, Output: $0.40, Cached: $1.00, Context: 1M
- `gemini-2.0-flash-lite`: Input: $0.075, Output: $0.30, Context: 1M

**Gemini 2.5 Series (NEW)**
- `gemini-2.5-flash`: Input: $0.30, Output: $2.50, Cached: $0.03, Context: 1M
- `gemini-2.5-flash-image`: Input: $0.30, Output: $0.039, Context: 1M
- `gemini-2.5-flash-lite`: Input: $0.10, Output: $0.40, Cached: $0.01, Context: 1M
- `gemini-2.5-pro`: Input: $1.25, Output: $10.00, Cached: $0.125, Context: 1M

**Gemini 3.x Series (NEW)**
- `gemini-3-flash-preview`: Input: $0.50, Output: $3.00, Cached: $0.05, Context: 1M
- `gemini-3-pro-image-preview`: Input: $2.00, Output: $12.00, Context: 1M
- `gemini-3.1-flash-image-preview`: Input: $0.25, Output: $1.50, Context: 1M
- `gemini-3.1-pro-preview`: Input: $2.00, Output: $12.00, Cached: $0.20, Context: 1M

**Gemini 1.x Legacy**
- `gemini-1.5-pro`: Input: $1.25, Output: $5.00, Cached: $0.50, Context: 2M
- `gemini-1.5-flash`: Input: $0.075, Output: $0.30, Context: 1M
- `gemini-1.0-pro`: Input: $0.50, Output: $1.50, Context: 2.8M
- `gemini-exp-1206`: Input: $0.125, Output: $0.375, Context: 2M

### DeepSeek (CNY per 1M tokens, 128K context) - UPDATED March 2026
**NEW: DeepSeek-V3.2 Models**
- `deepseek-chat`: Input: ¥0.20 (cached: ¥0.20), Output: ¥3.00, Context: 128K
- `deepseek-reasoner`: Input: ¥0.20 (cached: ¥0.20), Output: ¥3.00, Context: 128K (thinking mode)

**Historical Models**
- `deepseek-v3`: Same as chat model
- `deepseek-r1-lite`: Input: ¥0.14, Output: ¥0.28 (legacy)
- `deepseek-v3-lite`: Input: ¥0.14, Output: ¥0.28 (legacy)
- `deepseek-coder`: Code generation model (legacy)

### xAI Grok (USD per 1M tokens) - UPDATED March 2026
**NEW: Grok 4 Series**
- `grok-4-1-fast-reasoning`: Input: $0.20, Output: $0.50, Context: 2M
- `grok-4-1-fast-non-reasoning`: Input: $0.20, Output: $0.50, Context: 2M
- `grok-4-fast-reasoning`: Input: $0.20, Output: $0.50, Context: 2M
- `grok-4-fast-non-reasoning`: Input: $0.20, Output: $0.50, Context: 2M
- `grok-4-0709`: Input: $3.00, Output: $15.00, Context: 256K

**Grok 3 Series**
- `grok-3`: Input: $3.00, Output: $15.00, Context: 131K
- `grok-3-mini`: Input: $0.30, Output: $0.50, Context: 131K

**Legacy Models**
- `grok-2`: Input: $2.00, Output: $10.00, Context: 131K
- `grok-2-vision`: Input: $7.00, Output: $7.00, Context: 81.9K

**Image Generation Models**
- `grok-imagine-image-pro`: $0.07/image
- `grok-imagine-image`: $0.02/image
- `grok-2-image-1212`: $0.07/image

### Mistral AI (USD per 1M tokens) - UPDATED March 2026
**NEW: Mistral 3 Series Flagship**
- `mistral-large-3`: Input: $0.50, Output: $1.50 (new flagship model)
- `devstral-medium-2`: Input: $0.40, Output: $2.00 (code agent model)
- `mistral-medium-3`: Input: $0.40, Output: $2.00
- `mistral-small-3-2`: Input: $0.10, Output: $0.30

**Ministral 3 Series (NEW)**
- `ministral-3b-latest`: Input: $0.10, Output: $0.10
- `ministral-8b-latest`: Input: $0.15, Output: $0.15
- `ministral-14b-latest`: Input: $0.20, Output: $0.20

**Other New Models**
- `mistral-small-creative`: Input: $0.10, Output: $0.30
- `magistral-medium-latest`: Input: $2.00, Output: $5.00
- `magistral-small-latest`: Input: $0.50, Output: $1.50

**Legacy Models**
- `codestral-latest`: Input: $0.30, Output: $0.90, Context: 32K
- `mixtral-8x7b`: Input: $0.70, Output: $0.70, Context: 32K
- `mixtral-8x22b`: Input: $2.00, Output: $6.00, Context: 64K
- `mistral-large`: Input: $4.00, Output: $12.00, Context: 128K
- `mistral-medium`: Input: $2.50, Output: $2.50, Context: 32K
- `mistral-small`: Input: $0.20, Output: $0.20, Context: 32K
- `mistral-nemo`: Input: $0.15, Output: $0.15, Context: 128K
- `pixtral-12b`: Input: $0.05, Output: $0.05

### Moonshot/Kimi (CNY per 1M tokens) - UPDATED March 2026
**NEW: Kimi K2.5 Series**
- `kimi-k2.5`: Input: ¥0.70 (cached: ¥1.00), Output: ¥21.00, Context: 256K (flagship)
- `kimi-k2-0905-preview`: Input: ¥1.00, Output: ¥16.00, Context: 128K
- `kimi-k2-turbo-preview`: Input: ¥1.00, Output: ¥58.00, Context: 128K

**Legacy Moonshot-v1 Series**
- `moonshot-v1-128k`: Input: ¥10.00, Output: ¥30.00, Context: 128K
- `moonshot-v1-32k`: Input: ¥0.024, Output: ¥0.024, Context: 32K
- `moonshot-v1-8k`: Input: ¥0.012, Output: ¥0.012, Context: 8K

### Minimax (CNY per 1M tokens) - UPDATED March 2026
**NEW: MiniMax-M Series (Changed naming from abab*)**
- `MiniMax-M2.5`: Input: ¥2.1, Output: ¥8.4, Context: 204800, Cached read: ¥0.21, Cached write: ¥2.625 (Flagship performance model, complex tasks)
- `MiniMax-M2.5-highspeed`: Input: ¥4.2, Output: ¥16.8, Context: 204800, Cached read: ¥0.21, Cached write: ¥2.625 (M2.5 high-speed version, same quality, faster)
- `MiniMax-M2.1`: Input: ¥2.1, Output: ¥8.4, Context: 204800, Cached read: ¥0.21, Cached write: ¥2.625 (Strong multi-language coding capabilities)
- `MiniMax-M2.1-highspeed`: Input: ¥4.2, Output: ¥16.8, Context: 204800, Cached read: ¥0.21, Cached write: ¥2.625 (M2.1 high-speed version, same quality, faster)
- `MiniMax-M2`: Input: ¥2.1, Output: ¥8.4, Context: 204800, Cached read: ¥0.21, Cached write: ¥2.625 (For efficient coding and Agent workflows)

**Other Models** (Speech, Video, Music, Image)
- `speech-2.8-hd`: ¥3.5/万字符 (Next-gen HD TTS)
- `speech-2.6-hd`: ¥3.5/万字符 (High quality TTS)
- `speech-02-hd`: ¥3.5/万字符 (HD with rhythm)
- `speech-2.8-turbo`: ¥2.0/万字符 (Next-gen Turbo)
- `speech-2.6-turbo`: ¥2.0/万字符 (Excellent quality, ultra-low)
- `Music-2.5`: ¥1.0/song (Latest music generation)
- `Music-2.0`: ¥0.25/song (Diverse timbres)
- `image-01`: ¥0.025/image (Text-to-image)
- `image-01-live`: ¥0.025/image (Enhanced hand-drawn styles)

### Zhipu AI/GLM (CNY per 1M tokens) - UPDATED March 2026
**NEW: GLM-5 Series (Flagship)**
- `glm-5`: Input: ¥4.00 (short input), ¥6.00 (long input), Output: ¥18.00-¥22.00, Context: 128K
- `glm-5-code`: Input: ¥6.00, Output: ¥28.00, Context: 128K (coding model)
- `glm-4.7`: Input: ¥2.00-¥4.00, Output: ¥8.00-¥16.00, Context: 128K
- `glm-4.7-flashx`: Input: ¥0.50, Output: ¥3.00, Context: 200K (fast)
- `glm-4.7-flash`: Input: ¥0.00, Output: ¥0.00, Context: 200K (FREE)

**NEW: GLM-Z1 Series**
- `glm-z1-air`: Input: ¥0.50, Output: ¥0.50, Context: 128K
- `glm-z1-airx`: Input: ¥5.00, Output: ¥5.00, Context: 32K
- `glm-z1-flashx`: Input: ¥0.10, Output: ¥0.10, Context: 128K
- `glm-z1-flash`: Input: ¥0.00, Output: ¥0.00, Context: 128K (FREE)

**Legacy Models**
- `glm-4-plus`: Input: ¥5.00, Output: ¥5.00, Context: 128K
- `glm-4-air`: Input: ¥1.00, Output: ¥1.00, Context: 128K
- `glm-4-flash`: Input: ¥0.15, Output: ¥0.15, Context: 128K
- `glm-3-turbo`: Input: ¥0.05, Output: ¥0.05, Context: 128K
- `glm-4-long`: Input: ¥2.00, Output: ¥2.00, Context: 1M
- `glm-4v-plus`: Input: ¥7.00, Output: ¥7.00, Context: 8192
- `glm-4-0520`: Input: ¥2.50, Output: ¥2.50, Context: 128K

### Qwen/通义千问 (CNY per 1M tokens) - UPDATED March 2026
**Qwen 3 Series (Flagship)**
- `qwen3-max`: Input: ¥32.00, Output: ¥32.00, Context: 32K (旗舰模型)
- `qwen3-plus`: Input: ¥4.00, Output: ¥4.00, Context: 32K (高性能模型)
- `qwen3-turbo`: Input: ¥0.40, Output: ¥0.40, Context: 8K (极速模型)
- `qwen3-max-longcontext`: Input: ¥40.00, Output: ¥40.00, Context: 28K (长上下文)

**Qwen 2.5 Series (Open Source)**
- `qwen2.5-72b-instruct`: Input: ¥2.50, Output: ¥2.50, Context: 131072 (72B 参数)
- `qwen2.5-7b-instruct`: Input: ¥0.15, Output: ¥0.15, Context: 131072 (7B 参数)

**Vision Models**
- `qwen3-vl-max`: Input: ¥12.00, Output: ¥12.00, Context: 8192 (多模态视觉模型)
- `qwen-vl-max`: Input: ¥12.00, Output: ¥12.00, Context: 8192 (视觉模型)

**Code Models**
- `qwen3-coder-plus`: Input: ¥4.00, Output: ¥4.00, Context: 32K (代码生成模型)
- `qwen2.5-coder-32b-instruct`: Input: ¥2.50, Output: ¥2.50, Context: 131072 (32B 代码模型)

### Seed/Volcengine/豆包 (CNY per 1M tokens) - UPDATED March 2026
**NEW: Doubao 2.0 Series (Latest Models)**

#### doubao-seed-2.0-pro (Flagship)
| Input Length | Input (CNY/1M) | Cached Input | Output (CNY/1M) |
|--------------|----------------|-------------|-----------------|
| 0-32K        | 3.2            | 0.64        | 16.0            |
| 32-128K      | 4.8            | 0.96        | 24.0            |
| 128-256K     | 9.6            | 1.92        | 48.0            |
| Cache Storage: 0.017 CNY/1M tokens/hour | | |

#### doubao-seed-2.0-lite (Budget-friendly)
| Input Length | Input (CNY/1M) | Cached Input | Output (CNY/1M) |
|--------------|----------------|-------------|-----------------|
| 0-32K        | 0.6            | 0.12        | 3.6             |
| 32-128K      | 0.9            | 0.18        | 5.4             |
| 128-256K     | 1.8            | 0.36        | 10.8            |
| Cache Storage: 0.017 CNY/1M tokens/hour | | |

#### doubao-seed-2.0-mini (Compact)
| Input Length | Input (CNY/1M) | Cached Input | Output (CNY/1M) |
|--------------|----------------|-------------|-----------------|
| 0-32K        | 0.2            | 0.04        | 2.0             |
| 32-128K      | 0.4            | 0.08        | 4.0             |
| 128-256K     | 0.8            | 0.16        | 8.0             |
| Cache Storage: 0.017 CNY/1M tokens/hour | | |

#### doubao-seed-2.0-code (Code Generation)
| Input Length | Input (CNY/1M) | Cached Input | Output (CNY/1M) |
|--------------|----------------|-------------|-----------------|
| 0-32K        | 3.2            | 0.64        | 16.0            |
| 32-128K      | 4.8            | 0.96        | 24.0            |
| 128-256K     | 9.6            | 1.92        | 48.0            |
| Cache Storage: 0.017 CNY/1M tokens/hour | | |

**Third-Party Models Available on Volcengine**
- `glm-4.7`: Input: ¥2.00-4.00, Cached: ¥0.40-0.80, Output: ¥8.00-16.00, Context: 200K
- `deepseek-v3.2`: Input: ¥2.00-4.00, Cached: ¥0.40, Output: ¥3.00-6.00, Context: 128K
- `deepseek-v3.1`: Input: ¥4.00, Cached: ¥0.80, Output: ¥12.00
- `deepseek-v3`: Input: ¥2.00, Cached: ¥0.40, Output: ¥8.00
- `deepseek-r1`: Input: ¥4.00, Cached: ¥0.80, Output: ¥16.00
- `kimi-k2`: Input: ¥4.00, Cached: ¥0.80, Output: ¥16.00

### Hunyuan/腾讯混元 (CNY per 1M tokens) - UPDATED March 2026
**NEW: Hunyuan-T1**
- `hunyuan-t1`: Input: ¥1.00, Output: ¥4.00, Context: N/A (1M free tokens, 1 year valid)

**Text Models**
- `hunyuan-turbos`: Input: ¥0.80, Output: ¥2.00
- `hunyuan-a13b`: Input: ¥0.50, Output: ¥2.00
- `hunyuan-large-role`: Input: ¥2.40, Output: ¥9.60
- `hunyuan-translation`: Input: ¥1.20, Output: ¥3.60
- `hunyuan-translation-lite`: Input: ¥1.00, Output: ¥3.00

**NEW: HY 2.0 Series**
- `tencent-hy-2.0-think`: Input: ¥3.975-¥5.30, Output: ¥15.90-¥21.20, Context: N/A (tiered pricing based on input length)
- `tencent-hy-2.0-instruct`: Input: ¥3.18-¥4.505, Output: ¥7.95-¥11.13, Context: N/A

**Vision Models**
- `tencent-hy-vision-1.5-instruct`: Input: ¥3.00, Output: ¥9.00
- `hunyuan-turbos-vision`: Input: ¥3.00, Output: ¥9.00
- `hunyuan-t1-vision`: Input: ¥3.00, Output: ¥9.00
- `hunyuan-turbos-vision-video`: Input: ¥3.00, Output: ¥9.00

**Legacy Models**
- `hunyuan-pro`: Input: ¥15.00, Output: ¥15.00, Context: 128K
- `hunyuan-lite`: Input: ¥3.00, Output: ¥3.00, Context: 128K
- `hunyuan-standard`: Input: ¥6.00, Output: ¥6.00, Context: 128K
- `hunyuan-turbo`: Input: ¥1.50, Output: ¥1.50, Context: 128K
- `hunyuan-vision`: Input: ¥15.00, Output: ¥15.00, Context: 8192

### Baidu ERNIE (CNY per 1M tokens) - UPDATED March 2026
**NEW: ERNIE 5.0 Series**
- `ernie-5.0-thinking`: Input: ¥6.00, Context: 32K (thinking model)
- `ernie-5.0-preview`, `ernie-5.0-latest`: Various variants

**ERNIE 4.5 Turbo Series (Updated)**
- `ernie-4.5-turbo-128k`: Input: ¥0.80, Output: ¥3.20, Context: 128K (Cached: ¥0.20)
- `ernie-4.5-turbo-32k`: Input: ¥0.80, Output: ¥3.20, Context: 32K (Cached: ¥0.20)
- `ernie-4.5-turbo-vl`: Input: ¥3.00, Output: ¥9.00, Context: 32K (vision-language)

**NEW Models**
- `ernie-4.5-21b`: Input: ¥0.50, Output: ¥2.00 (smaller variant)
- `ernie-4.5-0.3b`: Input: ¥0.10, Output: ¥0.40 (ultra-lite)
- `ernie-x1.1`: Input: ¥1.00, Output: ¥4.00 (thinking model)
- `ernie-x1-turbo-32k`: Input: ¥1.00, Output: ¥4.00 (thinking model)
- `ernie-speed-pro-128k`: Input: ¥0.30, Output: ¥0.60, Context: 128K (TPM limit: 10K)
- `ernie-lite-pro-128k`: Input: ¥0.20, Output: ¥0.40, Context: 128K (TPM limit: 10K)
- `ernie-character-8k`: Input: ¥0.30, Output: ¥0.60, Context: 8K

**Legacy Models**
- `ernie-4.0`: Input: ¥8.00, Output: ¥8.00, Context: 128K
- `ernie-3.5`: Input: ¥6.00, Output: ¥6.00, Context: 128K
- `ernie-speed`: Input: ¥0.004, Output: ¥0.004, Context: 128K
- `ernie-turbo`: Input: ¥0.008, Output: ¥0.008, Context: 128K
- `ernie-lite`: Input: ¥0.003, Output: ¥0.003, Context: 128K

### Fireworks AI (USD per 1M tokens) - UPDATED March 2026
**Parameter-Based Pricing**
- Small Models (<4B): Input/Output: $0.10
- Medium Models (4B-16B): Input/Output: $0.20
- Large Models (>16B): Input/Output: $0.90
- MoE Small (0B-56B): Input/Output: $0.50
- MoE Large (56.1B-176B): Input/Output: $1.20

**Premium Models (50% cache discount)**
- `deepseek-v3-family`: Input: $0.56, Cached: $0.28, Output: $1.68
- `glm-4.7`: Input: $0.60, Cached: $0.30, Output: $2.20
- `glm-5`: Input: $1.00, Cached: $0.20, Output: $3.20
- `qwen3-vl-30b-a3b`: Input: $0.15, Cached: $0.075, Output: $0.60
- `kimi-k2-instruct`: Input: $0.60, Cached: $0.30, Output: $2.50
- `kimi-k2-thinking`: Input: $0.60, Cached: $0.30, Output: $2.50
- `kimi-k2.5`: Input: $0.60, Cached: $0.10, Output: $3.00
- `openai-gpt-oss-120b`: Input: $0.15, Cached: $0.075, Output: $0.60
- `openai-gpt-oss-20b`: Input: $0.07, Cached: $0.035, Output: $0.30
- `minimax-m2-family`: Input: $0.30, Cached: $0.03, Output: $1.20

### Replicate (USD) - UPDATED March 2026
**Hardware-Time Based Pricing** (Most models)
- CPU Small: $0.000025/second ($0.09/hour)
- CPU: $0.000100/second ($0.36/hour)
- Nvidia T4 GPU: $0.000225/second ($0.81/hour)
- Nvidia L40S GPU: $0.000975/second ($3.51/hour)
- 2x Nvidia L40S GPU: $0.001950/second ($7.02/hour)
- Nvidia A100: $0.001400/second ($5.04/hour)
- Nvidia H100: $0.001525/second ($5.49/hour)

**Token-Based Models (Select)**
- `anthropic/claude-3.7-sonnet`: Input: $3.00, Output: $15.00
- `deepseek-ai/deepseek-r1`: Input: $3.75, Output: $10.00

**Image Generation Models**
- `black-forest-labs/flux-1.1-pro`: $0.04/image
- `black-forest-labs/flux-dev`: $0.025/image
- `black-forest-labs/flux-schnell`: $0.003/image

### Anyscale
**DEPRECATED**: Anyscale has been acquired by Replicate and is no longer an independent provider. Use Replicate pricing instead.

### StepFun/阶跃星辰 (CNY per 1M tokens) - UPDATED March 2026
**Text Models**
- `step-1-8k`: Input: ¥1.00 (Cached), Output: ¥5.00, Context: 8K
- `step-1-32k`: Input: ¥3.00 (Cached), Output: ¥15.00, Context: 32K
- `step-1-256k`: Input: ¥19.00 (Cached), Output: ¥95.00, Context: 256K
- `step-2-mini`: Input: ¥0.20, Output: ¥1.00, Context: -
- `step-2-16k`: Input: ¥7.60, Output: ¥38.00, Context: 16K
- `step-2-16k-exp`: Input: ¥7.60, Output: ¥38.00, Context: 16K

**Vision Models**
- `step-1o-turbo-vision`: Input: ¥0.50, Output: ¥2.50
- `step-1o-vision-32k`: Input: ¥3.00, Output: ¥0.60, Context: 32K
- `step-1v-8k`: Input: ¥1.00, Output: ¥0.20, Context: 8K
- `step-1v-32k`: Input: ¥3.00, Output: ¥0.60, Context: 32K

**Reasoning Models (NEW)**
- `step-3.5-flash`: Input: ¥0.14 (Cached), Output: ¥2.10
- `step-r1-v-mini`: Input: ¥0.50, Output: ¥2.50
- `step-3`: Input: ¥0.30, Output: ¥1.50

**Audio Models**
- `step-1o-audio`: Input: ¥5.00 (Cached), Output: ¥25.00
- `step-audio-2`: Input: ¥2.00, Output: ¥10.00

### SiliconFlow (CNY per 1M tokens, ~20 models)
Includes OpenAI, Anthropic, DeepSeek, Qwen, Llama, Grok, GLM models

### DMXAPI (CNY per 1M tokens, reseller pricing)
- `gpt-4o`: Input: ¥15.00, Output: ¥15.00, Context: 128K
- `gpt-4o-mini`: Input: ¥0.90, Output: ¥0.90, Context: 128K
- `claude-3.5-sonnet`: Input: ¥18.00, Output: ¥18.00, Context: 200K
- `claude-3.5-haiku`: Input: ¥4.50, Output: ¥4.50, Context: 200K
- `deepseek-chat`: Input: ¥1.50, Output: ¥1.50, Context: 128K
- `gemini-1.5-pro`: Input: ¥8.00, Output: ¥8.00, Context: 2000000
- `gemini-1.5-flash`: Input: ¥0.50, Output: ¥0.50, Context: 1000000

## Usage

### Running Individual Scrapers

```bash
# Test a specific scraper
tsx scripts/scrapers/deepseek-dynamic.ts
tsx scripts/scrapers/mistral-dynamic.ts
tsx scripts/scrapers/moonshot-dynamic.ts
tsx scripts/scrapers/minimax-dynamic.ts
tsx scripts/scrapers/zhipu-dynamic.ts
tsx scripts/scrapers/qwen-dynamic.ts
tsx scripts/scrapers/seed-dynamic.ts
tsx scripts/scrapers/hunyuan-dynamic.ts
tsx scripts/scrapers/baidu-dynamic.ts
tsx scripts/scrapers/fireworks-dynamic.ts
tsx scripts/scrapers/replicate-dynamic.ts
tsx scripts/scrapers/stepfun-dynamic.ts
tsx scripts/scrapers/dmxapi-dynamic.ts

# Run all dynamic scrapers
tsx scripts/index-dynamic.ts
```

## Notes

- **NO FALLBACK DATA**: All scrapers fail cleanly with errors when scraping fails instead of returning hardcoded data
- All scrapers use Playwright for real HTML parsing or fetch from real API endpoints
- All scrapers include proper error handling and retry logic
- Pricing data should be updated periodically from official provider websites
- Scrapers return `isRealTime`, `confidence`, and `lastVerified` metadata for data traceability
- **March 2026 Updates**: Major new model releases from OpenAI (GPT-5), Anthropic (Claude 4.6), Google (Gemini 2.0/2.5/3.x), xAI (Grok 4), Zhipu (GLM-5), and others
