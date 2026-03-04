#!/usr/bin/env tsx

async function main() {
  console.log('🔥 Testing Hot Models API...\n');

  const response = await fetch('http://localhost:3000/api/products?featured=true&include_plan_count=true');
  const data = await response.json();

  console.log('Top 8 Hot Models (one per provider):\n');
  data.forEach((p: any, i: number) => {
    console.log(`${i + 1}. ${p.name} (${p.slug})`);
    console.log(`   ELO: ${p.benchmark_arena_elo}, Plans: ${p.planCount}`);
    console.log(`   Provider: ${p.providers?.name} (${p.providers?.slug})\n`);
  });
}

main().catch(console.error);
