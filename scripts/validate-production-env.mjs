#!/usr/bin/env node
import process from 'node:process';
const required = ['POSTGRES_PASSWORD', 'PLANPRICE_CATALOG_TOKEN'];
const errors = [];
for (const name of required) {
  const value = process.env[name] ?? '';
  if (!value || value.startsWith('replace-') || value.length < 32) errors.push(`${name} must be a random value of at least 32 characters`);
}
const role = process.env.PLANPRICE_SERVICE_ROLE;
if (role !== 'public' && role !== 'admin') errors.push('PLANPRICE_SERVICE_ROLE must be public or admin');
if (role === 'admin') {
  if (!process.env.PLANPRICE_ADMIN_HOST) errors.push('PLANPRICE_ADMIN_HOST is required for admin deployment');
  if (!process.env.EXCHANGE_RATE_API_KEY || process.env.EXCHANGE_RATE_API_KEY.length < 32 || process.env.EXCHANGE_RATE_API_KEY.startsWith('replace-')) errors.push('EXCHANGE_RATE_API_KEY must be a random value of at least 32 characters');
} else if (role === 'public' && process.env.EXCHANGE_RATE_API_KEY) {
  errors.push('EXCHANGE_RATE_API_KEY must not be present in the public catalog deployment');
}
console.log(JSON.stringify({ schemaVersion: 'planprice.production-env.v1', status: errors.length ? 'failed' : 'passed', ...(errors.length ? { errors } : {}) }, null, 2));
process.exitCode = errors.length ? 1 : 0;
