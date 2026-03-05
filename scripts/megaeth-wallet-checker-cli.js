#!/usr/bin/env node

import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { analyzeWallet } from './megaeth-wallet-checker/analyzer.js';

// CLI entry: accepts one wallet address.
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('Usage: node scripts/megaeth-wallet-checker-cli.js <walletAddress>');
  process.exit(1);
}

try {
  const report = await analyzeWallet(walletAddress);

  // Persist JSON artifact for local inspection and tooling.
  const outputPath = resolve(process.cwd(), `wallet-checker-${walletAddress}.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nSaved report to ${outputPath}`);
} catch (error) {
  console.error('Wallet checker failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
