# StepFun (阶跃星辰) API Pricing Data

**Source:** https://platform.stepfun.com/docs/zh/pricing/details
**Currency:** CNY (¥)
**Extracted:** 2026-03-02
**Price Unit:** per 1M tokens (for text models)

---

## Summary

StepFun offers 21 models across multiple categories:
- **Text Models:** step-2-mini, step-2-16k, step-2-16k-exp, step-1-8k, step-1-32k, step-1-256k
- **Vision Models:** step-1o-turbo-vision, step-1o-vision-32k, step-1v-8k, step-1v-32k
- **Reasoning Models:** step-3.5-flash, step-r1-v-mini, step-3
- **Audio Models:** step-1o-audio, step-audio-2
- **TTS Models:** step-tts-2, step-tts-mini, step-tts-vivid
- **ASR Model:** step-asr
- **Image Models:** step-1x-medium, step-1x-edit

---

## Text Models (文本大模型)

| Model | Context | Input (Cached) | Input (Uncached) | Output |
|-------|---------|----------------|------------------|--------|
| step-1-8k | 8K | ¥1.00 | ¥5.00 | ¥20.00 |
| step-1-32k | 32K | ¥3.00 | ¥15.00 | ¥70.00 |
| step-1-256k | 256K | ¥19.00 | ¥95.00 | ¥300.00 |
| step-2-mini | - | ¥0.20 | ¥1.00 | ¥2.00 |
| step-2-16k | 16K | ¥7.60 | ¥38.00 | ¥120.00 |
| step-2-16k-exp | 16K | ¥7.60 | ¥38.00 | ¥120.00 |

---

## Vision Models (视觉大模型)

| Model | Context | Input (Cached) | Input (Uncached) | Output |
|-------|---------|----------------|------------------|--------|
| step-1o-turbo-vision | - | ¥0.50 | ¥2.50 | ¥8.00 |
| step-1o-vision-32k | 32K | ¥3.00 | ¥15.00 | ¥0.60 |
| step-1v-8k | 8K | ¥1.00 | ¥5.00 | ¥0.20 |
| step-1v-32k | 32K | ¥3.00 | ¥15.00 | ¥0.60 |

---

## Reasoning Models (推理模型)

| Model | Input (Cached) | Input (Uncached) | Output |
|-------|----------------|------------------|--------|
| step-3.5-flash | ¥0.14 | ¥0.70 | ¥2.10 |
| step-r1-v-mini | ¥0.50 | ¥2.50 | ¥8.00 |
| step-3 | ¥0.30 | ¥1.50 | ¥4.00 |

---

## Audio Models (语音模型)

| Model | Input (Cached) | Input (Uncached) | Output |
|-------|----------------|------------------|--------|
| step-1o-audio | ¥5.00 | ¥25.00 | ¥60.00 |
| step-audio-2 | ¥2.00 | ¥10.00 | ¥70.00 |

---

## TTS Models (文本转语音)

| Model | Price | Note |
|-------|--------|------|
| step-tts-2 | ¥2.80/万字符 | Voice clone: ¥50/音色 |
| step-tts-mini | ¥0.90/万字符 | Voice clone: ¥50/音色 |
| step-tts-vivid | ¥1.90/万字符 | Voice clone: ¥50/音色 |

---

## ASR Model (语音识别)

| Model | Price | Note |
|-------|--------|------|
| step-asr | ¥0.90/小时 | - |

---

## Image Models (文生图)

| Model | Price | Note |
|-------|--------|------|
| step-1x-medium | ¥0.10/image | - |
| step-1x-edit | Free | Limited time |

---

## Pricing Notes

- **Cached vs Uncached Input:** Caching provides significant discounts (typically 80-90% off)
- **Output Pricing:** Output tokens are typically 4-10x more expensive than cached input tokens
- **Voice Cloning:** TTS models support voice cloning at ¥50/音色 (billed on first use)
- **Rate Limits:** Available based on user level (V0-V5) determined by cumulative top-up amount

---

## Key Observations

1. **Most Affordable:** step-3.5-flash (¥0.14 cached input, ¥2.10 output per 1M tokens)
2. **Best Value for Context:** step-1-32k at ¥3.00 cached input for 32K context
3. **TTS Pricing:** step-tts-mini is the most affordable at ¥0.90/万字符
4. **Large Context:** step-1-256k offers 256K context window at ¥19.00 cached input
