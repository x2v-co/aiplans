#!/usr/bin/env tsx
/**
 * Fix subscription plan accuracy issues found during 2026-04-13 audit.
 * Companion to scripts/fix-data-audit.ts (which fixes api_channel_prices).
 *
 * Three sections:
 *   1. Reassign orphan provider_id values (dangling FKs to deleted providers)
 *   2. Update plan prices using web-verified ground truth
 *   3. Delete plans for products that no longer exist or were discontinued
 *
 * Usage:
 *   npx tsx scripts/fix-plans-audit.ts --dry-run    # preview, no writes
 *   npx tsx scripts/fix-plans-audit.ts              # apply
 *
 * All ground truth verified against official pricing pages on 2026-04-13.
 */
import { supabaseAdmin } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');

// ─── 1. Reassign orphan provider_ids ───────────────────────────────────────
// These plans point to provider_ids that were deleted; remap to current FKs.
// Special case: 1623 / 1624 are duplicates of 1875 / 1876 (google) — DELETE
// rather than reassign (handled in section 3).
const REASSIGN: { fromProviderId: number; toProviderId: number; toSlug: string }[] = [
  { fromProviderId: 61, toProviderId: 41, toSlug: 'minimax-china' }, // minimax-free/lite/pro
  { fromProviderId: 62, toProviderId: 43, toSlug: 'zhipu-china' },   // glm-coding-lite/pro/max
  { fromProviderId: 63, toProviderId: 39, toSlug: 'moonshot-china' },// kimi-free/basic/pro/team/enterprise
  { fromProviderId: 64, toProviderId: 47, toSlug: 'seed' },          // seed-free-trial/lite/pro/enterprise
];

// ─── 2. Plan price updates ────────────────────────────────────────────────
interface PlanUpdate {
  providerSlug: string;
  planSlug: string;
  price?: number | null;       // monthly
  annual?: number | null;      // total annual price (full year, not /mo)
  currency?: string;
  reason: string;
}

const PLAN_UPDATES: PlanUpdate[] = [
  // ─ Google ──────────────────────────────────────────
  // gemini-advanced was $197/$2364 — clearly a 10x decimal error or stale data.
  // Per https://one.google.com/about/google-ai-plans/ Google AI Pro is $19.99/mo
  // and $199.99/yr.
  { providerSlug: 'google', planSlug: 'gemini-advanced',
    price: 19.99, annual: 199.99, currency: 'USD',
    reason: 'Google AI Pro (formerly Gemini Advanced) is $19.99/mo, $199.99/yr — DB had $197/$2364 (10x decimal error)' },

  // ─ Anthropic ───────────────────────────────────────
  // Pro monthly is $20, annual billing is $204/yr ($17/mo effective).
  // DB had $240 annual which doesn't match either way.
  { providerSlug: 'anthropic', planSlug: 'claude-pro',
    price: 20, annual: 204, currency: 'USD',
    reason: 'Claude Pro annual is $204/yr ($17/mo effective); DB had $240' },

  // ─ Zhipu / Z.AI international ──────────────────────
  // Z.AI bills quarterly only — there is no annual price. Set annual_price=null.
  { providerSlug: 'zhipu-global', planSlug: 'z-ai-lite',
    price: 10, annual: null, currency: 'USD',
    reason: 'Z.AI Lite is $10/mo billed quarterly ($30/q); no annual billing — DB had stale $84' },
  { providerSlug: 'zhipu-global', planSlug: 'z-ai-pro',
    price: 30, annual: null, currency: 'USD',
    reason: 'Z.AI Pro is $30/mo billed quarterly ($90/q); no annual billing — DB had stale $240' },
  { providerSlug: 'zhipu-global', planSlug: 'z-ai-max',
    price: 80, annual: null, currency: 'USD',
    reason: 'Z.AI Max is $80/mo billed quarterly ($240/q); no annual billing' },

  // ─ Moonshot Kimi (CN) ──────────────────────────────
  // Kimi+ tiers (Andante/Moderato/Allegretto). DB values are stale.
  // Per Sina/QQ news + codingplan.org confirmed prices:
  { providerSlug: 'moonshot-china', planSlug: 'kimi-basic',
    price: 49, annual: 468, currency: 'CNY',
    reason: 'Kimi 行板/Andante: ¥49/mo, ¥468/yr (¥39/mo effective); DB had ¥12/¥144' },
  { providerSlug: 'moonshot-china', planSlug: 'kimi-pro',
    price: 99, annual: 948, currency: 'CNY',
    reason: 'Kimi 中速/Moderato: ¥99/mo, ¥948/yr (¥79/mo effective); DB had ¥68/¥816' },
  { providerSlug: 'moonshot-china', planSlug: 'kimi-team',
    price: 199, annual: 1908, currency: 'CNY',
    reason: 'Kimi 快板/Allegretto: ¥199/mo, ¥1908/yr (¥159/mo effective); DB had ¥198/¥2376' },

  // ─ Volcengine Seed (CN) ────────────────────────────
  // Volcengine Ark Coding Plan: monthly only, no annual.
  { providerSlug: 'seed', planSlug: 'seed-lite',
    price: 40, annual: null, currency: 'CNY',
    reason: '火山方舟 Coding Plan Lite ¥40/mo (no annual); DB had ¥19/¥228 stale' },
  { providerSlug: 'seed', planSlug: 'seed-pro',
    price: 200, annual: null, currency: 'CNY',
    reason: '火山方舟 Coding Plan Pro ¥200/mo (no annual); DB had ¥59/¥708 stale' },

  // ─ Alibaba Bailian Coding Plan (mis-attributed to Baidu Qianfan) ──
  // qianfan-coding-plan-pro: should track 阿里云百炼 Coding Plan Pro standard
  // renewal price (¥200/mo). The ¥39.9 in DB is the first-month promo price.
  { providerSlug: 'baidu', planSlug: 'qianfan-coding-plan-pro',
    price: 200, annual: null, currency: 'CNY',
    reason: '阿里云百炼 Coding Plan Pro standard renewal ¥200/mo; DB had ¥39.9 (first-month promo)' },

  // ─ Mistral Le Chat Enterprise — contact sales, no public price ────
  // Was €0/mo which incorrectly implies "free". Set price=null to distinguish.
  { providerSlug: 'mistral', planSlug: 'le-chat-enterprise',
    price: null, annual: null, currency: 'EUR',
    reason: 'Le Chat Enterprise is contact-sales (no public price); DB had €0 which implied free' },
];

// ─── 3. Delete obsolete / non-existent plans ──────────────────────────────
// Plans tracking products that no longer exist or were discontinued by the vendor.
interface PlanDelete {
  providerSlug: string;
  planSlug: string;
  reason: string;
}

const PLAN_DELETIONS: PlanDelete[] = [
  // Baidu announced 2025-02-13 that ALL ERNIE consumer plans become free
  // effective 2025-04-01 — these slugs are dead products.
  { providerSlug: 'baidu', planSlug: 'ernie-monthly',
    reason: 'Baidu ERNIE consumer plans went fully free on 2025-04-01; product discontinued' },
  { providerSlug: 'baidu', planSlug: 'ernie-annual',
    reason: 'Baidu ERNIE consumer plans went fully free on 2025-04-01; product discontinued' },

  // Tencent Yuanbao/Hunyuan: no paid consumer plans exist as of 2026-04-13.
  // The ¥7.9 / ¥39.9 values look like Bailian first-month promo, not Hunyuan.
  { providerSlug: 'hunyuan', planSlug: 'hunyuan-lite',
    reason: '腾讯元宝/混元 has no paid consumer plans; product is fully free' },
  { providerSlug: 'hunyuan', planSlug: 'hunyuan-pro',
    reason: '腾讯元宝/混元 has no paid consumer plans; product is fully free' },

  // 阿里云百炼 Coding Plan Lite was discontinued 2026-04-13 (today)
  { providerSlug: 'baidu', planSlug: 'qianfan-coding-plan-lite',
    reason: '阿里云百炼 Coding Plan Lite stopped renewals 2026-04-13' },

  // qwen-lite/qwen-pro slugs in DB hold ¥7.9/¥39.9 which match Bailian first-month
  // promo, not any actual Qwen consumer plan. Qwen consumer chat (chat.qwen.ai) is
  // entirely free; Lingma personal Pro is ¥59 (currently free promo). These records
  // track a non-existent product.
  { providerSlug: 'qwen', planSlug: 'qwen-lite',
    reason: 'Qwen has no consumer subscription plan; chat.qwen.ai is fully free' },
  { providerSlug: 'qwen', planSlug: 'qwen-pro',
    reason: 'Qwen has no consumer subscription plan; chat.qwen.ai is fully free' },

  // Duplicate plans pointing to deleted provider_id=60 (orphan) when the
  // canonical google records (id 1875/1876) already exist.
  { providerSlug: 'ORPHAN_60', planSlug: 'gemini-free',
    reason: 'Duplicate of plan id 1875 (google/gemini-free); orphan provider_id=60' },
  { providerSlug: 'ORPHAN_60', planSlug: 'gemini-advanced',
    reason: 'Duplicate of plan id 1876 (google/gemini-advanced); orphan provider_id=60' },

  // Old MiniMax slugs (minimax-free/lite/pro) tracked stale M2.5-era pricing.
  // Replaced below by the 6 official Token Plan tiers from
  // https://platform.minimaxi.com/docs/guides/pricing-token-plan
  { providerSlug: 'minimax-china', planSlug: 'minimax-free',
    reason: 'Replaced by 6 official MiniMax Token Plan tiers (M2.7-era)' },
  { providerSlug: 'minimax-china', planSlug: 'minimax-lite',
    reason: 'Replaced by minimax-standard-* / minimax-highspeed-* slugs' },
  { providerSlug: 'minimax-china', planSlug: 'minimax-pro',
    reason: 'Replaced by minimax-standard-* / minimax-highspeed-* slugs' },
];

// ─── 4. New plans to insert ─────────────────────────────────────────────
// Plans referenced in scripts/config/plan-model-slugs.ts but missing from DB,
// plus the 6 official MiniMax Token Plan tiers. All prices verified against
// official pricing pages on 2026-04-13.
interface NewPlan {
  providerSlug: string;
  slug: string;
  name: string;
  tier: string;            // free | basic | pro | team | enterprise | max
  pricingModel: string;    // subscription | token_pack | pay_as_you_go
  price: number | null;    // monthly; null = contact sales / no public price
  annual: number | null;   // total annual price (full year)
  currency: string;
  isContactSales?: boolean;
  notes?: string;          // stored in features.notes
  reason: string;
}

const NEW_PLANS: NewPlan[] = [
  // ─── MiniMax (platform.minimaxi.com Token Plan, 6 tiers) ─────────────
  { providerSlug: 'minimax-china', slug: 'minimax-standard-starter',
    name: 'MiniMax 标准版 Starter', tier: 'basic', pricingModel: 'subscription',
    price: 29, annual: 290, currency: 'CNY',
    notes: 'M2.7 600 req/5h; Music-2.6 100 songs/day. No speech/image/video.',
    reason: 'Official MiniMax Token Plan Standard Starter tier' },
  { providerSlug: 'minimax-china', slug: 'minimax-standard-plus',
    name: 'MiniMax 标准版 Plus', tier: 'pro', pricingModel: 'subscription',
    price: 49, annual: 490, currency: 'CNY',
    notes: 'M2.7 1500 req/5h; Speech 4k chars/day; image-01 50/day. Best value.',
    reason: 'Official MiniMax Token Plan Standard Plus (高性价比) tier' },
  { providerSlug: 'minimax-china', slug: 'minimax-standard-max',
    name: 'MiniMax 标准版 Max', tier: 'team', pricingModel: 'subscription',
    price: 119, annual: 1190, currency: 'CNY',
    notes: 'M2.7 4500 req/5h; Speech 11k/day; image-01 120/day; Hailuo-2.3 video 2/day.',
    reason: 'Official MiniMax Token Plan Standard Max (超大份量) tier' },
  { providerSlug: 'minimax-china', slug: 'minimax-highspeed-plus',
    name: 'MiniMax 极速版 Plus', tier: 'pro', pricingModel: 'subscription',
    price: 98, annual: 980, currency: 'CNY',
    notes: 'M2.7-highspeed 1500 req/5h; Speech 9k/day; image-01 100/day. No video.',
    reason: 'Official MiniMax Token Plan High-Speed Plus tier' },
  { providerSlug: 'minimax-china', slug: 'minimax-highspeed-max',
    name: 'MiniMax 极速版 Max', tier: 'team', pricingModel: 'subscription',
    price: 199, annual: 1990, currency: 'CNY',
    notes: 'M2.7-highspeed 4500 req/5h; Speech 19k/day; image-01 200/day; video 3/day.',
    reason: 'Official MiniMax Token Plan High-Speed Max (超值之选) tier' },
  { providerSlug: 'minimax-china', slug: 'minimax-highspeed-ultra',
    name: 'MiniMax 极速版 Ultra', tier: 'enterprise', pricingModel: 'subscription',
    price: 899, annual: 8990, currency: 'CNY',
    notes: 'M2.7-highspeed 30k req/5h; Speech 50k/day; image-01 800/day; video 5/day.',
    reason: 'Official MiniMax Token Plan High-Speed Ultra (极速畅用) tier' },

  // ─── OpenAI ChatGPT ───────────────────────────────────────────────────
  { providerSlug: 'openai', slug: 'chatgpt-team',
    name: 'ChatGPT Team', tier: 'team', pricingModel: 'subscription',
    price: 30, annual: 300, currency: 'USD',
    notes: 'Per-user. Min 2 users. Annual billing $25/user/mo effective.',
    reason: 'OpenAI Team/Business tier referenced in plan-model-slugs.ts' },
  { providerSlug: 'openai', slug: 'chatgpt-enterprise',
    name: 'ChatGPT Enterprise', tier: 'enterprise', pricingModel: 'subscription',
    price: null, annual: null, currency: 'USD', isContactSales: true,
    notes: 'Contact sales. Reported floor ~$60/user/mo, 150-seat min, annual contract.',
    reason: 'OpenAI Enterprise tier referenced in plan-model-slugs.ts' },

  // ─── Anthropic Claude ─────────────────────────────────────────────────
  { providerSlug: 'anthropic', slug: 'claude-free',
    name: 'Claude Free', tier: 'free', pricingModel: 'subscription',
    price: 0, annual: null, currency: 'USD',
    notes: '~20 messages/day limit. Web access only.',
    reason: 'Claude Free tier referenced in plan-model-slugs.ts' },
  { providerSlug: 'anthropic', slug: 'claude-max-5x',
    name: 'Claude Max (5x)', tier: 'pro', pricingModel: 'subscription',
    price: 100, annual: null, currency: 'USD',
    notes: '5x the usage of Claude Pro. Individual plan.',
    reason: 'Claude Max 5x tier (between Pro and Max 20x)' },
  { providerSlug: 'anthropic', slug: 'claude-max-20x',
    name: 'Claude Max (20x)', tier: 'pro', pricingModel: 'subscription',
    price: 200, annual: null, currency: 'USD',
    notes: '20x the usage of Claude Pro. Individual plan.',
    reason: 'Claude Max 20x tier — top individual plan' },
  { providerSlug: 'anthropic', slug: 'claude-team',
    name: 'Claude Team Standard', tier: 'team', pricingModel: 'subscription',
    price: 30, annual: 300, currency: 'USD',
    notes: 'Per-user. Min 5 users. Annual billing $25/user/mo effective. Does NOT include Claude Code.',
    reason: 'Claude Team Standard referenced in plan-model-slugs.ts' },
  { providerSlug: 'anthropic', slug: 'claude-team-premium',
    name: 'Claude Team Premium', tier: 'team', pricingModel: 'subscription',
    price: 150, annual: 1200, currency: 'USD',
    notes: 'Per-user. Min 5 users. Annual billing $100/user/mo effective. Includes Claude Code.',
    reason: 'Claude Team Premium tier (includes Claude Code access)' },
  { providerSlug: 'anthropic', slug: 'claude-enterprise',
    name: 'Claude Enterprise', tier: 'enterprise', pricingModel: 'subscription',
    price: null, annual: null, currency: 'USD', isContactSales: true,
    notes: 'Contact sales. Reported floor ~$50k/yr, ~50-70 seat minimum. SCIM, SSO, audit, 500K context.',
    reason: 'Claude Enterprise referenced in plan-model-slugs.ts' },

  // ─── Google AI ───────────────────────────────────────────────────────
  { providerSlug: 'google', slug: 'google-ai-plus',
    name: 'Google AI Plus', tier: 'basic', pricingModel: 'subscription',
    price: 7.99, annual: null, currency: 'USD',
    notes: 'Includes 200 GB storage. Monthly billing only.',
    reason: 'Google AI Plus tier (cheapest paid Gemini sub)' },
  { providerSlug: 'google', slug: 'google-ai-ultra',
    name: 'Google AI Ultra', tier: 'enterprise', pricingModel: 'subscription',
    price: 249.99, annual: null, currency: 'USD',
    notes: 'Includes 30 TB storage + YouTube Premium. Monthly billing only.',
    reason: 'Google AI Ultra tier — top consumer Gemini plan' },
  // google-one-ai-premium is the legacy name for "Gemini Advanced" / "Google AI Pro"
  // The existing google/gemini-advanced row already represents this. Skip.

  // ─── Mistral Le Chat ─────────────────────────────────────────────────
  // Note: plan-model-slugs.ts uses 'mistral-pro' / 'mistral-team' as keys, but
  // the actual product is "Le Chat" — using le-chat-* slugs to match existing
  // le-chat-free slug already in DB.
  { providerSlug: 'mistral', slug: 'le-chat-pro',
    name: 'Le Chat Pro', tier: 'pro', pricingModel: 'subscription',
    price: 14.99, annual: null, currency: 'EUR',
    notes: 'Excludes taxes. No annual billing. Cheapest Western premium AI chat.',
    reason: 'Mistral Le Chat Pro tier' },
  { providerSlug: 'mistral', slug: 'le-chat-team',
    name: 'Le Chat Team', tier: 'team', pricingModel: 'subscription',
    price: 24.99, annual: null, currency: 'EUR',
    notes: 'Per-user. Excludes taxes. 30 GB storage/user, domain verification, data export.',
    reason: 'Mistral Le Chat Team tier' },
];

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────
async function findProviderId(slug: string): Promise<number | null> {
  const { data } = await supabaseAdmin.from('providers').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}

async function findPlan(providerId: number, planSlug: string) {
  const { data } = await supabaseAdmin
    .from('plans')
    .select('id, name, slug, price, annual_price, currency, last_verified')
    .eq('provider_id', providerId)
    .eq('slug', planSlug)
    .maybeSingle();
  return data;
}

const log = (s: string) => console.log(s);
const applied: string[] = [];
const skipped: string[] = [];

async function runReassign() {
  log(`\n━━━ [1/3] Reassign orphan provider_ids (${REASSIGN.length}) ━━━`);
  for (const r of REASSIGN) {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('id, slug, provider_id')
      .eq('provider_id', r.fromProviderId);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) {
      log(`  ✓  provider_id=${r.fromProviderId} → ${r.toSlug}: no orphan rows (already reassigned)`);
      continue;
    }
    log(`  🔧 provider_id=${r.fromProviderId} → ${r.toProviderId} (${r.toSlug}): ${rows.length} plans`);
    for (const row of rows) log(`      · #${row.id} ${row.slug}`);
    if (!DRY_RUN) {
      const { error: upErr } = await supabaseAdmin
        .from('plans')
        .update({ provider_id: r.toProviderId, updated_at: new Date().toISOString() })
        .eq('provider_id', r.fromProviderId);
      if (upErr) {
        log(`      ❌ ${upErr.message}`);
        skipped.push(`REASSIGN ${r.fromProviderId}→${r.toProviderId}: ${upErr.message}`);
        continue;
      }
    }
    applied.push(`REASSIGN ${rows.length} plans from provider ${r.fromProviderId} → ${r.toSlug}`);
  }
}

async function runUpdates() {
  log(`\n━━━ [2/3] Plan price updates (${PLAN_UPDATES.length}) ━━━`);
  for (const u of PLAN_UPDATES) {
    const providerId = await findProviderId(u.providerSlug);
    if (!providerId) {
      log(`  ⏭  ${u.providerSlug}/${u.planSlug}: provider not found`);
      skipped.push(`UPDATE ${u.providerSlug}/${u.planSlug}: provider not found`);
      continue;
    }
    const plan = await findPlan(providerId, u.planSlug);
    if (!plan) {
      log(`  ⏭  ${u.providerSlug}/${u.planSlug}: plan not found`);
      skipped.push(`UPDATE ${u.providerSlug}/${u.planSlug}: plan not found`);
      continue;
    }
    const desiredPrice = u.price ?? null;
    const desiredAnnual = u.annual ?? null;
    const same = plan.price === desiredPrice && plan.annual_price === desiredAnnual;
    if (same) {
      log(`  ✓  ${u.providerSlug}/${u.planSlug}: already at $${desiredPrice}/${desiredAnnual ?? 'no annual'}, skip`);
      continue;
    }
    log(`  🔧 ${u.providerSlug}/${u.planSlug}: ${plan.price}/${plan.annual_price ?? 'null'} → ${desiredPrice}/${desiredAnnual ?? 'null'}`);
    log(`      reason: ${u.reason}`);
    if (!DRY_RUN) {
      const updateData: Record<string, unknown> = {
        price: desiredPrice,
        annual_price: desiredAnnual,
        last_verified: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (u.currency) updateData.currency = u.currency;
      const { error } = await supabaseAdmin.from('plans').update(updateData).eq('id', plan.id);
      if (error) {
        log(`      ❌ ${error.message}`);
        skipped.push(`UPDATE ${u.providerSlug}/${u.planSlug}: ${error.message}`);
        continue;
      }
    }
    applied.push(`UPDATE ${u.providerSlug}/${u.planSlug}: → ${desiredPrice}/${desiredAnnual ?? 'null'}`);
  }
}

async function runNewPlans() {
  log(`\n━━━ [4/4] Insert missing plans (${NEW_PLANS.length}) ━━━`);
  for (const p of NEW_PLANS) {
    const providerId = await findProviderId(p.providerSlug);
    if (!providerId) {
      log(`  ⏭  ${p.providerSlug}/${p.slug}: provider not found`);
      skipped.push(`NEW ${p.providerSlug}/${p.slug}: provider not found`);
      continue;
    }
    const existing = await findPlan(providerId, p.slug);
    if (existing) {
      log(`  ✓  ${p.providerSlug}/${p.slug}: already exists (id=${existing.id}), skip`);
      continue;
    }

    const featuresJson: Record<string, unknown> = {};
    if (p.notes) featuresJson.notes = p.notes;
    if (p.isContactSales) featuresJson.contactSales = true;

    log(`  ➕ ${p.providerSlug}/${p.slug}: ${p.currency} ${p.price ?? 'contact-sales'}/${p.annual ?? 'no annual'} (${p.tier})`);
    log(`      ${p.name}`);
    if (p.notes) log(`      notes: ${p.notes}`);
    log(`      reason: ${p.reason}`);
    if (!DRY_RUN) {
      const insertRow: Record<string, unknown> = {
        provider_id: providerId,
        slug: p.slug,
        name: p.name,
        tier: p.tier,
        pricing_model: p.pricingModel,
        price: p.price,
        annual_price: p.annual,
        currency: p.currency,
        price_unit: 'per_month',
        is_official: true,
        last_verified: new Date().toISOString(),
        features: Object.keys(featuresJson).length > 0 ? featuresJson : null,
        // Mark as manually curated so cleanupOutdatedPlans won't wipe these
        // when a plan scraper runs and doesn't see them on the public page.
        source: 'manual',
      };
      const { error } = await supabaseAdmin.from('plans').insert(insertRow);
      if (error) {
        log(`      ❌ ${error.message}`);
        skipped.push(`NEW ${p.providerSlug}/${p.slug}: ${error.message}`);
        continue;
      }
    }
    applied.push(`NEW plan ${p.providerSlug}/${p.slug}`);
  }
}

async function runDeletions() {
  log(`\n━━━ [3/3] Delete obsolete plans (${PLAN_DELETIONS.length}) ━━━`);
  for (const d of PLAN_DELETIONS) {
    let providerId: number | null;
    if (d.providerSlug === 'ORPHAN_60') {
      providerId = 60; // dangling FK — match by provider_id directly
    } else {
      providerId = await findProviderId(d.providerSlug);
      if (!providerId) {
        log(`  ⏭  ${d.providerSlug}/${d.planSlug}: provider not found`);
        skipped.push(`DELETE ${d.providerSlug}/${d.planSlug}: provider not found`);
        continue;
      }
    }

    const { data: rows } = await supabaseAdmin
      .from('plans')
      .select('id, slug, provider_id, price, currency')
      .eq('provider_id', providerId)
      .eq('slug', d.planSlug);

    if (!rows || rows.length === 0) {
      log(`  ✓  ${d.providerSlug}/${d.planSlug}: not present (already deleted)`);
      continue;
    }
    for (const row of rows) {
      log(`  🗑  ${d.providerSlug}/${d.planSlug}: id=${row.id} (was ${row.currency} ${row.price})`);
      log(`      reason: ${d.reason}`);
      if (!DRY_RUN) {
        // First delete dependent model_plan_mapping rows, if any
        const { error: mapErr } = await supabaseAdmin
          .from('model_plan_mapping')
          .delete()
          .eq('plan_id', row.id);
        if (mapErr) log(`      ⚠ failed to clean mapping: ${mapErr.message}`);

        const { error } = await supabaseAdmin.from('plans').delete().eq('id', row.id);
        if (error) {
          log(`      ❌ ${error.message}`);
          skipped.push(`DELETE ${d.providerSlug}/${d.planSlug}: ${error.message}`);
          continue;
        }
      }
      applied.push(`DELETE ${d.providerSlug}/${d.planSlug} (id=${row.id})`);
    }
  }
}

async function main() {
  log(`\n📋 fix-plans-audit  ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);
  await runReassign();
  await runUpdates();
  await runDeletions();
  await runNewPlans();
  log(`\n━━━ Summary ━━━`);
  log(`Applied: ${applied.length}`);
  log(`Skipped: ${skipped.length}`);
  if (skipped.length > 0) {
    log(`\nSkipped entries:`);
    for (const s of skipped) log(`  - ${s}`);
  }
  if (DRY_RUN) log(`\n(dry-run — no changes written)`);
}

main().catch(e => { console.error(e); process.exit(1); });
