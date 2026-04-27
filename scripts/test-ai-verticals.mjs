import * as advisor from '../server/ai-advisor.ts';
const { detectIntent, selectProjects } = advisor.__testables;
const prompts = [
  'are there any prediction market apps?',
  'show me NFT collections to mint',
  'best gambling app on megaeth',
  'gaming projects',
  'depin projects on megaeth',
  'is there a launchpad?',
  'i want a social app',
  'developer tooling',
  'meme coins',
  'trading bot recommendations'
];
for (const p of prompts) {
  console.log('\n=== ' + p + ' ===');
  const intent = detectIntent(p);
  console.log('verticals:', intent.verticals.map(v=>v.category).join(', ') || '(none)');
  const { ranked } = selectProjects(p, []);
  console.log('top 5:');
  ranked.slice(0,5).forEach(({project, score}, i) => console.log(`  ${i+1}. ${project.name} score=${score} cats=[${project.categories.join(', ')}]`));
}
