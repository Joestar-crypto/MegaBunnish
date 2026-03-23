const accentOverrides: Record<string, string> = {
  // Core financial
  DeFi: '#4ef1ff',        // cyan
  Trading: '#ff9a3c',     // orange
  'Trading bot': '#ff5e7a', // rose-red
  RWA: '#f4a84a',         // amber
  Launchpad: '#ffe566',   // yellow

  // NFT / Gaming / Social
  NFT: '#bf6fff',         // purple
  Gaming: '#39e88f',      // green
  Social: '#ff6fea',      // magenta-pink
  Meme: '#ffe0a0',        // cream-yellow
  Gambling: '#ff4d6d',    // crimson

  // Infrastructure
  Bridge: '#38c9ff',      // sky blue
  Depin: '#5bc8f5',       // light blue (distinct from Bridge)
  AI: '#90e0ff',          // pale blue
  Tools: '#95f7c4',       // mint

  // Prediction
  'Prediction Market': '#a78bfa', // violet (raw data alias)
  'Prediction M.': '#a78bfa',     // violet (canonical label)

  // Special/meta
  Native: '#34d9b5',      // teal
  Mobile: '#ffb347',      // peach
  Megamafia: '#ff3864',   // hot red
  Jojo: '#f9d46e',        // warm gold
};

const generatedColorCache: Record<string, string> = {};

const hashCategory = (category: string) => {
  let hash = 0;
  for (let index = 0; index < category.length; index += 1) {
    hash = (hash << 5) - hash + category.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const createColorFromHash = (category: string) => {
  const hash = hashCategory(category || 'default');
  const hue = (hash * 137.508) % 360;
  const saturation = 55 + (hash % 15);
  const lightness = 42 + (hash % 12);
  const color = `hsl(${hue.toFixed(2)}, ${saturation}%, ${lightness}%)`;
  generatedColorCache[category] = color;
  return color;
};

export const getCategoryColor = (category: string) => {
  if (accentOverrides[category]) {
    return accentOverrides[category];
  }
  if (generatedColorCache[category]) {
    return generatedColorCache[category];
  }
  return createColorFromHash(category);
};

export const CATEGORY_ACCENTS = accentOverrides;
