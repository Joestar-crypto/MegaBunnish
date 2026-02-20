import fs from 'node:fs';
import path from 'node:path';

// Change to use the bulk score endpoint which returns level
const ETHOS_SCORE_API_URL = 'https://api.ethos.network/api/v2/score/userkeys';
const PROJECTS_PATH = path.join(process.cwd(), 'src', 'data', 'projects.json');
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'data', 'ethosManualProfiles.ts');

// Helper to normalize handle from URL
const normalizeTwitterHandle = (urlProp) => {
  if (!urlProp) return null;
  try {
    const url = new URL(urlProp);
    if (url.hostname === 'x.com' || url.hostname === 'twitter.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[0];
    }
  } catch (e) {
    // console.warn('Invalid URL:', urlProp);
  }
  return null;
};

// Helper to capitalize first letter
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const fetchScoresAndLevels = async (handles) => {
  const chunks = [];
  const chunkSize = 50; // API limit is 500, let's span requests reasonably

  // Create userkeys. Note: construction is service:x.com:username:<handle>
  // Handles might be case sensitive? Usually Twitter handles are case insensitive but the key format might matter.
  // We will use the handle as is.
  const handleToKey = new Map();
  const userkeys = handles.map(h => {
    const key = `service:x.com:username:${h}`;
    handleToKey.set(key.toLowerCase(), h);
    return key;
  });

  const results = [];

  for (let i = 0; i < userkeys.length; i += chunkSize) {
    const chunk = userkeys.slice(i, i + chunkSize);
    console.log(`Fetching scores for chunk ${i / chunkSize + 1}/${Math.ceil(userkeys.length / chunkSize)}...`);

    try {
      const response = await fetch(ETHOS_SCORE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ethos-Client': 'ConstellationProject'
        },
        body: JSON.stringify({ userkeys: chunk })
      });

      if (!response.ok) {
        console.error(`Error fetching chunk: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value.score === 'number') {
          const handle = handleToKey.get(key.toLowerCase());
          if (handle) {
            results.push({
              handle,
              score: value.score,
              level: value.level
            });
          }
        }
      }

    } catch (e) {
      console.error('Fetch error:', e);
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  return results;
};

const main = async () => {
  console.log('Reading projects...');
  const projects = JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'));
  
  const handleToProject = new Map();
  const handlesToFetch = new Set();

  projects.forEach(p => {
    const handle = normalizeTwitterHandle(p.links?.twitter);
    if (handle) {
      handlesToFetch.add(handle);
      handleToProject.set(handle.toLowerCase(), p);
    }
  });

  const handles = Array.from(handlesToFetch);
  console.log(`Found ${handles.length} unique Twitter handles.`);

  if (handles.length === 0) {
    console.log('No handles to fetch.');
    return;
  }

  const scoreData = await fetchScoresAndLevels(handles);
  console.log(`Successfully fetched scores for ${scoreData.length} profiles.`);

  const overrides = scoreData.map(item => {
    const project = handleToProject.get(item.handle.toLowerCase());
    return {
      projectId: project ? project.id : undefined,
      handle: item.handle,
      score: item.score,
      tier: item.level ? capitalize(item.level) : undefined,
      displayName: project ? project.name : item.handle,
      url: `https://app.ethos.network/profile/x/${item.handle}`
    };
  }).filter(item => item.projectId); // Only keep those that map to a project

  // Sort by score
  overrides.sort((a, b) => b.score - a.score);

  const fileContent = `export type EthosProfileOverride = {
  handle: string;
  score: number;
  tier?: string;
  displayName?: string;
  url?: string;
  projectId?: string;
};

export const ETHOS_PROFILE_OVERRIDES: EthosProfileOverride[] = ${JSON.stringify(overrides, null, 2)};
`;

  fs.writeFileSync(OUTPUT_PATH, fileContent);
  console.log(`Updated ${OUTPUT_PATH} with ${overrides.length} profiles.`);
};

main().catch(console.error);
