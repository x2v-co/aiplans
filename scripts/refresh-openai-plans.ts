#!/usr/bin/env tsx
/** Live review; --apply writes only after every official source parses. */
import { chromium } from 'playwright';
import { resolveSelector } from '../src/lib/plan-selector';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { OPENAI_REVIEW_SOURCES, parseOpenAIReview, assertOpenAIReviewFreshness, type OpenAIReviewSource } from './data/openai-plan-review';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply','--fetch-only'].includes(arg) && !arg.startsWith('--evidence='))) throw new Error('Use --apply or --fetch-only');
  if (args.includes('--apply') && args.includes('--fetch-only')) throw new Error('Choose apply or fetch-only');
  const apply = args.includes('--apply');
  const evidencePath=args.find(arg=>arg.startsWith('--evidence='))?.slice('--evidence='.length);
  let capturedAt = new Date();
  let texts = {} as Record<OpenAIReviewSource,string>;
  let evidence: Array<{source:string;url:string;finalUrl:string;capturedAt:string;sha256:string}> = [];
  if(evidencePath) {
    const saved=JSON.parse(await readFile(evidencePath,'utf8'));
    const savedAt=new Date(saved.capturedAt);
    const age=Date.now()-savedAt.getTime();
    if(!Number.isFinite(age)||age< -300000||age>86400000) throw new Error('Evidence must be captured within the last 24 hours');
    for(const [key,url] of Object.entries(OPENAI_REVIEW_SOURCES)) {
      const records=saved.evidence?.filter((item: {source:string})=>item.source===key);
      const text=saved.texts?.[key];
      if(records?.length!==1||records[0].url!==url||typeof text!=='string'||records[0].capturedAt!==saved.capturedAt||
        createHash('sha256').update(text).digest('hex')!==records[0].sha256) throw new Error(`Invalid evidence for ${key}`);
    }
    capturedAt=savedAt; texts=saved.texts; evidence=saved.evidence;
    console.log(`Explicit evidence replay from ${capturedAt.toISOString()}; verification dates are not advanced.`);
  } else {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    for (const [key,url] of Object.entries(OPENAI_REVIEW_SOURCES)) {
      let failure: unknown;
      for (let attempt=0;attempt<2;attempt++) {
        const page = await browser.newPage({locale:'en-US', userAgent:'Mozilla/5.0 (compatible; PlanPriceAI/1.0; +https://aiplans.dev)'});
        try {
          let response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
          if (response?.status() === 403) {
            // Let the site's ordinary JavaScript navigation finish; no CAPTCHA
            // interaction or response rewriting. Unresolved challenges fail.
            response = await page.waitForResponse(r => r.request().isNavigationRequest() && r.ok(), {timeout:15000}).catch(() => response);
          }
          if (!response?.ok()) throw new Error(`${key}: HTTP ${response?.status()}`);
          const final = new URL(page.url());
          if (!['help.openai.com','openai.com','chatgpt.com'].includes(final.hostname)) throw new Error('Unexpected source redirect');
          await page.waitForTimeout(1500);
          const text=await page.locator('body').innerText();
          if (text.length<100 || /Just a moment|Enable JavaScript and cookies to continue/i.test(text)) throw new Error(`${key}: blocked source`);
          texts[key as OpenAIReviewSource]=text;
          evidence.push({source:key,url,finalUrl:page.url(),capturedAt:capturedAt.toISOString(),sha256:createHash('sha256').update(text).digest('hex')});
          console.log(`Read ${key}: HTTP ${response.status()}`);
          failure=undefined; break;
        } catch(error) { failure=error; } finally { await page.close(); }
      }
      if (failure) {
        if (key !== 'go') throw failure;
        console.warn('Go source unavailable; its price will remain explicitly unverified.');
        texts.go = '';
      }
    }
  } finally { await browser.close(); }
  }
  if (process.env.OPENAI_REVIEW_EVIDENCE_DIR) {
    await mkdir(process.env.OPENAI_REVIEW_EVIDENCE_DIR,{recursive:true});
    await writeFile(`${process.env.OPENAI_REVIEW_EVIDENCE_DIR}/latest-source-texts.json`,JSON.stringify({capturedAt:capturedAt.toISOString(),texts,evidence},null,2));
  }
  const reviews=parseOpenAIReview(texts);
  // Evidence is local operational output, never a hardcoded fallback for reruns.
  const evidenceDir=process.env.OPENAI_REVIEW_EVIDENCE_DIR;
  if (evidenceDir) {
    await mkdir(evidenceDir,{recursive:true});
    await writeFile(`${evidenceDir}/${capturedAt.toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify({evidence,reviews},null,2));
  }
  if (args.includes('--fetch-only')) { console.log(JSON.stringify({evidence,reviews},null,2)); return; }
  const {databaseSql:sql}=await import('./db/postgres-admin');
  try {
    await sql.begin('isolation level serializable',async raw=>{
      const tx=raw as unknown as typeof sql;
      if (!apply) await tx`SET TRANSACTION READ ONLY`;
      const providers=await tx`SELECT id FROM providers WHERE slug='openai'`;
      if(providers.length!==1) throw new Error('OpenAI provider identity must be unique');
      const providerId=providers[0].id;
      const existing=await tx`SELECT * FROM plans WHERE provider_id=${providerId}`;
      for(const review of reviews) {
        const matches=existing.filter(row=>row.slug===review.slug);
        if(matches.length>1) throw new Error(`Duplicate plan ${review.slug}`);
        let planId: number | undefined = matches[0]?.id;
        if (matches[0]) {
          if (matches[0].plan_kind !== 'chat') throw new Error(`Unexpected plan kind: ${review.slug}`);
          assertOpenAIReviewFreshness(matches[0], capturedAt);
        }
        if(!matches.length) {
          if(review.slug!=='chatgpt-business-premium') throw new Error(`Missing existing plan ${review.slug}`);
          const standard=existing.filter(row=>row.slug==='chatgpt-business');
          if(standard.length!==1) throw new Error('Missing Business seed identity');
          console.log(JSON.stringify({slug:review.slug,action:'insert',after:review}));
          const models=await tx`SELECT model.id,model.slug,
            coalesce((SELECT array_agg(provider.slug) FROM providers provider WHERE provider.id=ANY(model.provider_ids)),'{}') AS provider_slugs,
            (SELECT max(score.value) FROM model_benchmark_scores score JOIN benchmark_metrics metric ON metric.id=score.metric_id
              WHERE score.model_id=model.id AND metric.name='ELO') AS elo
            FROM models model`;
          const resolved=resolveSelector(standard[0].model_selector,models.map(model=>({id:model.id,slug:model.slug,providerSlugs:model.provider_slugs,elo:model.elo})),['openai']);
          if (!resolved.models.length || resolved.unknownExtra.length) throw new Error('Business Premium selector did not resolve safely');
          console.log(JSON.stringify({slug:review.slug,initialModelMappings:resolved.models.map(model=>model.slug)}));
          if(apply) {
            const inserted=await tx`INSERT INTO plans (provider_id,product_id,slug,name,pricing_model,tier,plan_kind,plan_category,plan_line,tier_rank,secondary_kinds,model_selector,source,is_official,region,access_from_china)
              SELECT provider_id,product_id,${review.slug},${review.name},pricing_model,tier,plan_kind,plan_category,plan_line,7,secondary_kinds,model_selector,'manual',true,region,access_from_china FROM plans WHERE id=${standard[0].id} RETURNING id`;
            planId=inserted[0].id;
            for(const [priority,model] of resolved.models.entries()) {
              await tx`INSERT INTO model_plan_mapping (plan_id,model_id,priority,source) VALUES (${planId},${model.id},${priority},'derived')`;
            }
          }
        } else {
          const old=matches[0];
          console.log(JSON.stringify({slug:review.slug,action:'update',before:{price:old.price,annualPrice:old.annual_price,lastVerified:old.last_verified,dailyMessageLimit:old.daily_message_limit},after:review}));
        }
        if(apply) {
          const legacy=review.notes.match(/\[aiplans:legacy ends=(\d{4}-\d{2}-\d{2})\]/)?.[1] ?? null;
          await tx`UPDATE plans SET name=${review.name},price=${review.price},annual_price=${review.annualPrice},
            price_yearly_monthly=${review.annualPrice===null?null:review.annualPrice/12},currency='USD',price_unit='per_month',
            is_contact_sales=${review.contactSales},features=${tx.json(review.features)},notes=${review.notes},
            daily_message_limit=NULL,weekly_message_limit=NULL,monthly_message_limit=NULL,"5_hours_message_limit"=NULL,
            rate_limit=NULL,requests_per_minute=NULL,requests_per_day=NULL,requests_per_month=NULL,
            qps=NULL,concurrent_requests=NULL,tokens_per_minute=NULL,tokens_per_day=NULL,tokens_per_month=NULL,context_window=NULL,
            max_tokens_per_request=NULL,quotas=${review.verified?tx.json([]):null},legacy_ends_on=${legacy},
            last_verified=${review.verified?capturedAt:null},updated_at=${capturedAt}
            WHERE id=${planId}`;
        }
      }
    });
    console.log(`${apply?'Applied':'Dry-run; no writes'}: ${reviews.length} OpenAI reviews. Go current USD price remains unverified.`);
  } finally { await sql.end(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
