// Local reproduction: prove the AI advisor selects Tulpea for an RWA real-estate prompt.
// Usage: npx tsx scripts/test-ai-rwa.mjs
// (Does NOT call the LLM. Only exercises selection + context build.)

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Use tsx to import the TS source directly.
const advisor = await import('../server/ai-advisor.ts');

const internals = advisor.__testables ?? null;

const prompt = "where can i put my money to work";

console.log('--- PROMPT ---');
console.log(prompt);
console.log();

if (!internals) {
  console.log('No __testables export found. Falling back to full reply (will hit the LLM).');
  const reply = await advisor.generateAiAdvisorReply({ message: prompt, history: [] });
  console.log('--- ANSWER ---');
  console.log(reply.answer);
  console.log();
  console.log('--- RECOMMENDATIONS ---');
  console.log(reply.recommendations);
  process.exit(0);
}

const { selectProjects, buildContextBlock, detectIntent } = internals;

const intent = detectIntent(prompt);
console.log('--- INTENT ---');
console.log(intent);
console.log();

const { ranked, intent: intent2 } = selectProjects(prompt, []);
console.log('--- RANKED PROJECTS (top 6) ---');
ranked.forEach(({ project, score }, i) => {
  console.log(`${i + 1}. ${project.name} (${project.id}) score=${score} cats=[${project.categories.join(', ')}]`);
});
console.log();

const ctx = buildContextBlock(ranked, intent2);
console.log('--- CONTEXT (first 1500 chars) ---');
console.log(ctx.text.slice(0, 1500));



