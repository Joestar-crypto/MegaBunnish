import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectsPath = resolve('src/data/projects.json');
const dump = JSON.parse(readFileSync(resolve('tmp/discover-list.json'), 'utf8'));
const projects = JSON.parse(readFileSync(projectsPath, 'utf8'));

const stripWww = (h) => h.replace(/^www\./, '');
const baseHost = (url) => {
  try {
    if (!url) return '';
    const u = new URL(url);
    return stripWww(u.hostname.toLowerCase());
  } catch { return ''; }
};
const rootDomain = (host) => {
  if (!host) return '';
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
};

const projectByHost = new Map();
const projectByRoot = new Map();
const projectByTwitter = new Map();
for (const p of projects) {
  const sites = [];
  if (p.links?.site) sites.push(p.links.site);
  if (Array.isArray(p.links?.sites)) sites.push(...p.links.sites);
  if (p.website) sites.push(p.website);
  for (const s of sites) {
    const h = baseHost(s);
    if (h) {
      if (!projectByHost.has(h)) projectByHost.set(h, p);
      const r = rootDomain(h);
      if (r && !projectByRoot.has(r)) projectByRoot.set(r, p);
    }
  }
  const tw = p.links?.twitter || p.links?.x;
  if (tw) {
    const m = String(tw).match(/(?:x\.com|twitter\.com)\/([^/?#]+)/i);
    if (m) projectByTwitter.set(m[1].toLowerCase(), p);
  }
}

const liveApps = dump.data.filter((a) => a.is_live === true);
const liveIds = new Set();
const unmatched = [];

for (const app of liveApps) {
  const host = baseHost(app.website);
  const root = rootDomain(host);
  const twHandle = app.twitter
    ? (String(app.twitter).match(/(?:x\.com|twitter\.com)\/([^/?#]+)/i)?.[1] || '').toLowerCase()
    : '';
  const match =
    projectByHost.get(host) ||
    projectByRoot.get(root) ||
    (twHandle ? projectByTwitter.get(twHandle) : null);
  if (match) liveIds.add(match.id);
  else unmatched.push({ name: app.name, website: app.website, twitter: app.twitter });
}

let added = 0, removed = 0, kept = 0;
for (const p of projects) {
  const shouldBeLive = liveIds.has(p.id);
  const wasLive = p.isLive === true;
  if (shouldBeLive && !wasLive) { p.isLive = true; added++; console.log(`+ live: ${p.id}`); }
  else if (!shouldBeLive && wasLive) { p.isLive = false; removed++; console.log(`- live: ${p.id}`); }
  else if (shouldBeLive && wasLive) kept++;
}

writeFileSync(projectsPath, JSON.stringify(projects, null, 2) + '\n', 'utf8');
console.log(`\nLive in dataset: ${liveIds.size} | added=${added} removed=${removed} kept=${kept}`);
console.log(`\nUnmatched Rabbithole live apps (not in our dataset):`);
for (const u of unmatched) console.log(`  - ${u.name} (${u.website})`);
