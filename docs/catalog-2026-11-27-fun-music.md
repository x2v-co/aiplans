# 百炼 Fun-Music 定向邀测音乐生成

lastVerified: **2026-11-27**. Official API IDs and catalog slugs are
`fun-music-preview` and `fun-music-v1`. These are text-to-song music models:
open-ended creative briefs or lyrics produce complete Chinese or English songs
with male/female vocals. The newly-released page labels them 语音合成; the pricing
section is 音乐生成. Catalog taxonomy is `music-model`, `multimodal`, category
`music`, text input and audio/music output.

Offering channel and sole `provider_ids` owner: existing 百炼 Model Studio
`qwen`. The official pages do not identify a separate inference supplier. No new
Bailian, 百聆 or FunAudioLLM provider is created. Missing, duplicated or unexpected
`qwen` types fail before writes (accepted: official/producer/cloud).

> Fun-Music 目前处于定向邀测阶段。如需申请使用，请联系商务经理，或提交工单。

Official [ticket URL](https://smartservice.console.aliyun.com/service/create-ticket).
Both catalog entries have waitlist status and this verbatim invite note in their
copy; usage constraints also store the note, ticket URL and `access: invite-only`.
`is_available=true` on a newly inserted usage row means a documented offering for
approved users; it does not indicate general access. Existing false availability
is preserved.

The [Chinese pricing page](https://help.aliyun.com/zh/model-studio/model-pricing.md)
has only **华北2（北京）** (`cn-beijing`):

| Official API ID | Output audio rate (CNY) | Free quota |
| --- | --- | --- |
| `fun-music-preview` | 0.005 元 / 秒 | 无 |
| `fun-music-v1` | 0.002 元 / 秒 | 1,000 秒 |

Official billing rule: **按输出音频的秒数计费，输入不计费。**
Quota validity: **有效期：自开通百炼/模型发布/申请通过之日起90天内（以较晚者为准）**.
Models use `pricing_unit: per_second`; each has one planless `usage_prices` row
with `price_kind: audio_second`, `unit: second`, currency CNY, region, quota and
invite constraints. The schema accepts this audio-specific price kind and unit;
no token `api_channel_prices`, price variants or subscription plans are needed.
Catalog metadata explicitly marks `pricingReference: planless-usage`; the DB
audit requires the audio usage row with a null plan ID. Other entries retain
their existing reference-plan checks. English/Chinese labels render the new
audio-second price kind as output audio per second.

The [newly-released page](https://help.aliyun.com/zh/model-studio/newly-released-models.md)
lists preview on **2026-06-01** and v1 on **2026-05-06**. These are listing dates
in copy only; no `released_at` timestamp is inferred. Preview is explicitly a
预览快照版. No dedicated model URL is used: the probed model-page paths were soft
404 shells. No context, RPM/TPM, Batch discount or other-region rate is asserted.

Official discrepancy (documentation only):
[www.alibabacloud.com English pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing.md)
also labels China (Beijing) but quotes USD $0.000695 / second for preview and
$0.000275 / second for v1, with v1 quota “None”. The
[help.aliyun.com English page](https://help.aliyun.com/en/model-studio/model-pricing.md)
agrees with Chinese CNY rates and v1's 1,000-second quota. This insert uses the
Chinese CNY facts only; no FX conversion or second USD price is stored.

Verified supplied snapshot SHA-256 values (snapshots retained outside this repo):

| Snapshot | SHA-256 |
| --- | --- |
| `official/pricing-md.body` | `c0b098c7215ab6dd85cd3778065cac087f5073e912bd1133f3b9be7a62cece10` |
| `official/pricing-html.body` | `64e1babc8f6ced66b8b6055c4fe44e687cd13335f209390f2af37aef381bc57c` |
| `official/fun-music-section-zh-pricing.md` | `c17d3ba636b12caa19d307b896b7925dedadbb8881f8d3c097a3f7b6c11cd452` |
| `official/newly-released-models-zh-md.body` | `499ce161bf989ea2fe0d58c3b219e39018bfb5d818f9efb68832fcc00ffe90da` |
| `official/pricing-intl-help-md.body` (discrepancy notes only) | `ed8bba4f44218b0a074aef97d3c3994868aa502cfff11b8aee25df22d5e094d9` |
| `official/pricing-en-md.body` (discrepancy notes only) | `f38ca57f0cdfc654bbd60481a3123fb1ab891a1c5dd6cd29ff11ed5c4d07792c` |

The [Chinese pricing HTML sibling](https://help.aliyun.com/zh/model-studio/model-pricing)
has document last-modified **2026-11-27T12:14:43+08:00**. The pricing markdown
response has no Last-Modified header; no timestamp is attributed to it or to an
individual model release.

`npm run seed:catalog-2026-11-27-fun-music` defaults to an offline `fakeSeedTx`
rehearsal, simulating writes and rolling them back with `runRehearsable`. It
connects to no database and validates no database constraints. `--db` requires an
explicit `DATABASE_URL`, executes writes in a serializable transaction and rolls
back. Only explicit `--apply` (`seed:catalog-2026-11-27-fun-music:apply`) commits.
No environment files are loaded. This change ran only the offline default.

`PRODUCTION_SHAPED_DRY_RUN` is an expectation, **not a measured production
dry-run**, assuming qwen exists and both models/prices are absent:

```json
{
  "providers": { "insert": 0, "update": 0 },
  "models": { "insert": 2, "update": 0 },
  "usage_prices": { "insert": 2, "update": 0 }
}
```

All identity checks finish before writes. Duplicate/alias identities, unexpected
taxonomy/ownership, units, currency or region fail closed. A rerun is empty;
newer usage evidence, existing unavailability and unrelated plan/channel rows
are preserved. No deletes. Both catalog entries defer DB seeding to this manual
script. Neither the script nor its apply mode is added to
`deploy/production/seed-catalog.sh`; generic audit/deploy seeds exclude deferred
entries. No production write, seed apply, merge or deployment is part of this PR.
