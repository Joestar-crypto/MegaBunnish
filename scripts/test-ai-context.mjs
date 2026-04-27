import * as advisor from '../server/ai-advisor.ts';
const { detectIntent, selectProjects } = advisor.__testables;
const history = [
  { role: 'user', content: 'Looking for ai project to use' },
  { role: 'assistant', content: 'Here are some AI projects...' }
];
const msg = 'where can i put my money to work';
console.log('intent:', detectIntent([...history.filter(h=>h.role==='user').map(h=>h.content), msg].join(' ')));
const { ranked } = selectProjects(msg, history);
console.log('top 6:');
ranked.forEach(({project, score}, i) => console.log(`${i+1}. ${project.name} score=${score} cats=[${project.categories.join(', ')}]`));
