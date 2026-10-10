#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.resolve(__dirname, '..');
const TRACKER_PATH = path.join(packRoot, 'generation_tracker.json');

if (!fs.existsSync(TRACKER_PATH)) {
  console.log('Tracker not found. Initializing now...');
  import('./init-tracker.mjs');
}

const data = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
const apps = data.apps || [];
const completed = apps.filter((a) => a.status === 'completed');
const raw = apps.filter((a) => a.status === 'raw_generated');
const pending = apps.filter((a) => a.status === 'pending');

console.log('\n======================================================');
console.log('📱 DISCO ICON PACK — TOP 3K GENERATION TRACKER');
console.log('======================================================');
console.log(`📊 Total Catalog:      ${apps.length}`);
console.log(`✅ Completed (Shipped): ${completed.length} (${((completed.length / apps.length) * 100).toFixed(1)}%)`);
console.log(`⏳ Raw Generated:       ${raw.length}`);
console.log(`⚪ Pending Generation:  ${pending.length} (${((pending.length / apps.length) * 100).toFixed(1)}%)`);
console.log('------------------------------------------------------');

const nextBatch = pending.slice(0, 10);
if (nextBatch.length > 0) {
  console.log('🚀 Next 10 Pending Icons:');
  nextBatch.forEach((a) => {
    console.log(`   #${String(a.rank).padStart(4, ' ')} | ${a.slug.padEnd(25, ' ')} | ${a.name} (${a.downloads} downloads)`);
  });
} else {
  console.log('🎉 All 3,000 top icons completed!');
}
console.log('======================================================\n');
