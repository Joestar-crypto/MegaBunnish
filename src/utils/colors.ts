const accentOverrides: Record<string, string> = {
  DeFi: '#4ef1ff',
  Trading: '#ff9a62',
  NFT: '#b17bff',
  Gaming: '#66f2a2',
  Social: '#ff7ad9',
  Launchpad: '#f8d477',
  Tools: '#9ff7c1',
  Depin: '#9bd8ff',
  Meme: '#ffd966',
  Gambling: '#ff6f91',
  'Prediction M.': '#c4a2ff',
  AI: '#7ad6ff'
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
