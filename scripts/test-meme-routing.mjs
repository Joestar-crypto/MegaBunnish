import { __testables } from '../server/ai-advisor.ts';

const queries = [
  'is bread ass bullish for megaeth?',
  'is the megamafia secretly run by bunnies?',
  'why are bunnies so cooked?',
  'what if megaeth went down for a day?',
  'gm fam, vibe check on megaeth?',
  'is jojo a real person or a meme?',
  'best perp dex on megaeth?',     // should stay serious
  'best NFT collection to buy?'    // should stay serious
];

for (const q of queries) {
  const intent = __testables.detectIntent(q);
  const meme = __testables.isMemeCulturePrompt?.(q);
  const tech = __testables.isSeriousTechnicalPrompt?.(q);
  console.log(`\n=== "${q}" ===`);
  console.log('meme:', meme, '| serious:', tech, '| verticals:', intent.verticals.map(v=>v.category).join(','), '| narratives:', intent.narratives.map(n=>n.id).join(','));
}
