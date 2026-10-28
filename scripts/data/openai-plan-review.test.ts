import assert from 'node:assert/strict';
import test from 'node:test';
import {parseOpenAIReview, type OpenAIReviewSource} from './openai-plan-review';
const fixture: Record<OpenAIReviewSource,string> = {
  free: 'ChatGPT is free to use. Free users have unlimited everyday text chats.',
  go: "What is ChatGPT Go? What's included Expanded access to tools. Availability Subscription prices can be found in the ChatGPT pricing page.",
  plus: 'Benefits of ChatGPT Plus Higher limits. Subscription Details Price: $20/month (billed monthly). We do not support annual billing.',
  pro: 'Overview Pro tools. Pro plans Monthly price (USD) Ultrafast Pro 100 $100 Not included Pro 200 $200 Not included Pro 500 $500 Included Changes to existing Pro 200 subscriptions Eligible allowance through October 29, 2026. Keeping your allowance and Pro 500 features',
  business: 'pricing (USD) Standard seat Monthly plan: $25 per user per month Annual plan: $20 per user per month, billed annually Premium seat Monthly plan: $125 per user per month Annual plan: $100 per user per month, billed annually',
  enterprise: 'Enterprise Custom pricing Contact our sales team to discuss enterprise pricing.',
  rename: 'The Team plan has been renamed to ChatGPT Business.',
};
test('live-source prices, annual totals, custom pricing and unknown Go stay distinct',()=>{
  const rows=parseOpenAIReview(fixture), bySlug=Object.fromEntries(rows.map(r=>[r.slug,r]));
  assert.equal(rows.length,11);
  assert.equal(bySlug['chatgpt-free'].price,0);
  assert.equal(bySlug['chatgpt-plus'].price,20);
  assert.equal(bySlug['chatgpt-business'].annualPrice,240);
  assert.equal(bySlug['chatgpt-business-premium'].annualPrice,1200);
  assert.equal(bySlug['chatgpt-enterprise'].price,null);
  assert.equal(bySlug['chatgpt-enterprise'].contactSales,true);
  assert.equal(bySlug['chatgpt-enterprise'].verified,true);
  assert.equal(bySlug['chatgpt-go'].price,null);
  assert.equal(bySlug['chatgpt-go'].verified,false);
  assert.match(bySlug['chatgpt-team'].notes,/renamed|Historical/);
  assert.match(bySlug['chatgpt-pro'].notes,/legacy ends=2026-10-29/);
});
test('actual changed prices are parsed, not matched against hardcoded old amounts',()=>{
  const rows=parseOpenAIReview({...fixture,plus:fixture.plus.replace('$20','$23'),business:fixture.business.replace('$25','$27')});
  assert.equal(rows.find(r=>r.slug==='chatgpt-plus')?.price,23);
  assert.equal(rows.find(r=>r.slug==='chatgpt-business')?.price,27);
});
test('missing paid amounts or blocked pages cannot produce a review',()=>{
  for(const key of ['free','plus','pro','business','enterprise','rename'] as const) {
    assert.throws(()=>parseOpenAIReview({...fixture,[key]:'Just a moment'}));
  }
  assert.throws(()=>parseOpenAIReview({...fixture,plus:fixture.plus.replace('$20','')}));
  assert.throws(()=>parseOpenAIReview({...fixture,pro:fixture.pro.replace('Pro 500 $500 Included','')}));
  assert.throws(()=>parseOpenAIReview({...fixture,business:fixture.business.replace('$100','SGD100')}));
});
test('an unavailable Go price is explicitly unknown rather than refreshed from its old seed',()=>{
  const go=parseOpenAIReview({...fixture,go:''}).find(r=>r.slug==='chatgpt-go')!;
  assert.equal(go.price,null);assert.equal(go.verified,false);assert.deepEqual(go.features,[]);
});

test('Business introductory plural seat labels do not shadow actual price table rows',()=>{
  const rows=parseOpenAIReview({...fixture,business:'Introducing Premium seats and Standard seats. '+ 'Overview '.repeat(90) + fixture.business});
  assert.equal(rows.find(row=>row.slug==='chatgpt-business')?.price,25);
});

import {assertOpenAIReviewFreshness} from './openai-plan-review';
test('a non-USD Business table is never written as USD',()=>{
  assert.throws(()=>parseOpenAIReview({...fixture,business:fixture.business.replace('USD','CAD')}),/Business seat pricing/);
});
test('older evidence cannot roll back a later verification or explicit unknown-price review',()=>{
  const capturedAt=new Date('2026-10-28T05:00:00Z');
  assert.throws(()=>assertOpenAIReviewFreshness({last_verified:'2026-10-28T06:00:00Z'},capturedAt),/predates/);
  assert.throws(()=>assertOpenAIReviewFreshness({last_verified:null,updated_at:'2026-10-28T06:00:00Z',notes:'[aiplans:review-source] https://openai.com/'},capturedAt),/predates/);
  assert.doesNotThrow(()=>assertOpenAIReviewFreshness({last_verified:'2026-10-28T05:00:00Z'},capturedAt));
});
test('redirected Business FAQ confirms the historical Team name',()=>{
  assert.ok(parseOpenAIReview({...fixture,rename:'ChatGPT Team was renamed to ChatGPT Business on August 29, 2025.'}).some(row=>row.slug==='chatgpt-team'));
});
