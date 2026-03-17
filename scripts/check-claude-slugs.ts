#!/usr/bin/env tsx

import { getModelBySlug } from './db/queries';

async function main() {
  const slugs = ['claude-opus-4.6', 'claude-sonnet-4.6', 'claude-3-7-sonnet'];

  console.log('Checking exact slug matches:\n');
  for (const slug of slugs) {
    const model = await getModelBySlug(slug);
    console.log(`Looking for '${slug}': ${model ? 'FOUND - ID=' + model.id : 'NOT FOUND'}`);
  }
}

main().catch(console.error);