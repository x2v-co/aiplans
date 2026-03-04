# Anthropic Claude API Pricing Summary

**Source:** https://docs.anthropic.com/en/docs/models-overview
**Extracted:** March 2, 2026
**Currency:** USD

## Model Pricing Table

| Model | API ID | Input/1M Tokens | Output/1M Tokens | Cached/1M Tokens | Context Window | Extended Thinking | Adaptive Thinking | Priority Tier |
|--------|---------|------------------|-------------------|-----------------|----------------|-------------------|-------------------|---------------|
| Claude Opus 4.6 | `claude-opus-4-6` | $5.00 | $25.00 | $0.50 | 200K | Yes | Yes | Yes |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3.00 | $15.00 | $0.30 | 200K | Yes | Yes | Yes |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1.00 | $5.00 | $0.10 | 200K | Yes | No | No |

## Platform Availability

All models are available on:
- **Claude API** (Official)
- **AWS Bedrock** (Cloud)
- **Google Vertex AI** (Cloud)

### Platform-Specific Model IDs

| Platform | Opus 4.6 | Sonnet 4.6 | Haiku 4.5 |
|----------|------------|--------------|-------------|
| Claude API | `claude-opus-4-6` | `claude-sonnet-4-6` | `claude-haiku-4-5-20251001` |
| AWS Bedrock | `anthropic.claude-opus-4-6-v1` | `anthropic.claude-sonnet-4-6` | `anthropic.claude-haiku-4-5-20251001-v1:0` |
| Google Vertex AI | `claude-opus-4-6` | `claude-sonnet-4-6` | `claude-haiku-4-5` |

## Key Features

### Extended Thinking
Available on all models - allows the model to think through complex problems before responding.

### Adaptive Thinking
Available on Opus 4.6 and Sonnet 4.6 - enables more sophisticated reasoning capabilities.

### Priority Tier
Available on Opus 4.6 and Sonnet 4.6 - provides faster response times for time-sensitive applications.

### Context Window
All Claude 4.x models support a 200,000 token context window.

## Pricing Notes

- Prices are per million tokens (MTok)
- Input tokens = text you send to Claude
- Output tokens = text Claude generates in response
- Cached tokens are 90% cheaper than regular input tokens when using prompt caching
- Haiku is the most cost-effective option for high-volume applications
- Sonnet offers the best balance of capability and cost
- Opus provides the highest capability for complex tasks

### Prompt Caching Benefits

Prompt caching allows you to cache parts of your prompt (like system messages, tools, or conversation history) and reuse them across multiple requests. Cached tokens are charged at a significantly lower rate:

| Model | Regular Input | Cached Input | Savings |
|--------|--------------|--------------|---------|
| Opus 4.6 | $5.00 | $0.50 | 90% |
| Sonnet 4.6 | $3.00 | $0.30 | 90% |
| Haiku 4.5 | $1.00 | $0.10 | 90% |

## Comparison with Previous Models

### Claude 3.5 Sonnet (Legacy)
- Input: $3.00 / 1M tokens
- Output: $15.00 / 1M tokens
- Cached: $0.30 / 1M tokens
- Same pricing as Sonnet 4.6

### Claude 3 Opus (Legacy)
- Input: $15.00 / 1M tokens
- Output: $75.00 / 1M tokens
- Cached: $1.25 / 1M tokens
- Opus 4.6 is significantly cheaper (3x for input, 3x for output)

### Claude 3 Haiku (Legacy)
- Input: $0.25 / 1M tokens
- Output: $1.25 / 1M tokens
- Cached: $0.10 / 1M tokens
- Haiku 4.5 is 4x more expensive but with more capabilities

## Key Pricing Changes from Claude 3.x to Claude 4.x

| Model | Claude 3.x Input | Claude 4.x Input | Change |
|-------|-------------------|-------------------|---------|
| Opus | $15.00 | $5.00 | -67% |
| Sonnet | $3.00 | $3.00 | 0% |
| Haiku | $0.25 | $1.00 | +300% |

| Model | Claude 3.x Output | Claude 4.x Output | Change |
|-------|--------------------|--------------------|---------|
| Opus | $75.00 | $25.00 | -67% |
| Sonnet | $15.00 | $15.00 | 0% |
| Haiku | $1.25 | $5.00 | +300% |

Note: While Haiku pricing increased significantly, it now supports extended thinking and other advanced features that were previously only available in higher-tier models.

## Use Case Recommendations

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| Simple queries, high volume | Haiku 4.5 | Lowest cost, fast responses |
| General applications, balanced | Sonnet 4.6 | Good performance/cost ratio |
| Complex reasoning, code | Opus 4.6 | Highest capability |
| Time-sensitive applications | Opus 4.6 or Sonnet 4.6 | Priority Tier available |
| Extended reasoning | Opus 4.6 or Sonnet 4.6 | Adaptive Thinking available |
