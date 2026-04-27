import { __testables } from '../server/ai-advisor.ts';

const queries = [
  'What is the best project to farm right now?',
  'Best NFT collection to buy on MegaETH?',
  'Which app should I farm for an airdrop?',
  'Best NFT to mint?'
];

for (const q of queries) {
  const intent = __testables.detectIntent(q);
  const { ranked } = __testables.selectProjects(q, []);
  console.log(`\n=== "${q}" ===`);
  console.log('preferNative:', intent.preferNative, '| wantsNftCollections:', intent.wantsNftCollections, '| verticals:', intent.verticals.map(v => v.category).join(','));
  console.log('top picks:');
  for (const r of ranked.slice(0, 6)) {
    console.log(`  ${r.score.toFixed(0).padStart(4)}  ${r.project.id.padEnd(28)}  [${r.project.categories.join(', ')}]`);
  }
}
