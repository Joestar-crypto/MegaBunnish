import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('src/data/projects.json');
const data = JSON.parse(readFileSync(path, 'utf8'));

// Source of truth: Rabbithole featured-apps "LIVE NOW" section
// https://rabbithole.megaeth.com/featured-apps
const LIVE_IDS = new Set([
  'aveforge',
  'brix',
  'worldmarkets',
  'showdown',
  'topstrike',
  'kumbaya',
  'hitdotone',
  'nextrare',
  'nectar-ai',
]);

let added = 0;
let removed = 0;
let kept = 0;
const list = Array.isArray(data) ? data : data.projects;
for (const p of list) {
  const shouldBeLive = LIVE_IDS.has(p.id);
  const wasLive = p.isLive === true;
  if (shouldBeLive && !wasLive) {
    p.isLive = true;
    added++;
    console.log(`+ live: ${p.id}`);
  } else if (!shouldBeLive && wasLive) {
    p.isLive = false;
    removed++;
    console.log(`- live: ${p.id}`);
  } else if (shouldBeLive && wasLive) {
    kept++;
  }
}

writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`\nDone. added=${added} removed=${removed} kept=${kept}`);

// Sanity: report missing
for (const id of LIVE_IDS) {
  if (!list.find(p => p.id === id)) console.warn(`! missing in dataset: ${id}`);
}
