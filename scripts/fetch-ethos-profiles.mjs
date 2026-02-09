#!/usr/bin/env node

const BASE_URL = 'https://app.ethos.network/profile/x/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const handles = process.argv.slice(2);

if (!handles.length) {
  console.error('Usage: node scripts/fetch-ethos-profiles.mjs <handle> [...]');
  process.exit(1);
}

const extractFromTitle = (title) => {
  if (!title) {
    return null;
  }
  const scoreMatch = title.match(/credibility profile -\s*(\d+)\s*\(([^)]+)\)/i);
  if (!scoreMatch) {
    return null;
  }
  return {
    score: Number(scoreMatch[1]),
    tier: scoreMatch[2]
  };
};

const extractFromMeta = (html) => {
  const metaMatch = html.match(/Credibility Score\"[^>]*?(\d+)/i);
  if (!metaMatch) {
    return null;
  }
  return {
    score: Number(metaMatch[1]),
    tier: null
  };
};

const fetchProfileScore = async (handle) => {
  const url = `${BASE_URL}${encodeURIComponent(handle)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    }
  });

  if (!response.ok) {
    return {
      handle,
      error: `HTTP ${response.status}`
    };
  }

  const html = await response.text();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : null;
  const titleData = extractFromTitle(title);
  const nameMatch = title ? title.match(/^([^|]+)\|/) : null;
  const metadata = titleData ?? extractFromMeta(html);

  return {
    handle,
    name: nameMatch ? nameMatch[1].trim() : handle,
    score: metadata?.score ?? null,
    tier: metadata?.tier ?? null,
    url
  };
};

const run = async () => {
  const results = [];
  for (const handle of handles) {
    try {
      results.push(await fetchProfileScore(handle));
    } catch (error) {
      results.push({
        handle,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  console.log(JSON.stringify(results, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
