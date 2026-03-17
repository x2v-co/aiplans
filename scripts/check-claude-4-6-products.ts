#!/usr/bin/env tsx

import { getModelBySlug, getModelArenaElo } from './db/queries';

async function main() {
  console.log('🔍 Checking Claude 4.6 models in database...\n');

  const slugsToCheck = [
    'claude-3-5-sonnet',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-3-5-haiku',
    'claude-3-haiku-4-5',
  ];

  for (const slug of slugsToCheck) {
    const model = await getModelBySlug(slug);

    if (model) {
      const elo = await getModelArenaElo(model.id);
      console.log(`✅ ${slug}:`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Name: ${model.name}`);
      console.log(`   Arena ELO: ${elo || 'N/A'}\n`);
    } else {
      console.log(`❌ ${slug}: Not found\n`);
    }
  }
}

main().catch(console.error);