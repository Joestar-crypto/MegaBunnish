import { __testables } from '../server/ai-advisor.ts';

const queries = [
  'best TCG apps?',
  'best perp dex on megaeth?',
  'best spot dex?',
  'what are the prediction market apps?',
  'is bread ass bullish for megaeth?'
];

for (const q of queries) {
  const intent = __testables.detectIntent(q);
  const { ranked } = __testables.selectProjects(q, []);
  console.log(`\n=== "${q}" ===`);
  console.log('preferNative:', intent.preferNative, '| wantsNftCollections:', intent.wantsNftCollections, '| verticals:', intent.verticals.map(v => v.category).join(','), '| narratives:', intent.narratives.map(n => n.id).join(','));
  console.log('top picks:');
  for (const r of ranked.slice(0, 10)) {
    console.log(`  ${r.score.toFixed(0).padStart(4)}  ${r.project.id.padEnd(28)}  [${r.project.categories.join(', ')}]`);
  }
}
