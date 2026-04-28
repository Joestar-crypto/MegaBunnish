// Per-project Jojo scores.
//
// IMPORTANT: These numbers are derived strictly from what Jojo wrote in the
// `jojoInsight` field of each project in `src/data/projects.json`. They are
// NOT independent opinions — every score is anchored to a quote from the
// insight. The `rationale` field is the literal phrase from Jojo's insight
// that justifies the score, so the mapping stays auditable.
//
// - trust    : how strongly Jojo vouches for the project being a real,
//              well-built thing in the MegaETH ecosystem (1 = "no opinion /
//              never tried", 10 = "best in category / give them love").
// - potential: the upside Jojo sees in the project (1 = "not much to say",
//              10 = "sleeping giant / definitely watching").
//
// When a project's insight is explicitly noncommittal ("never tried tbh",
// "not much to say", "limited info"), both scores stay around 4-5 to reflect
// that Jojo himself stayed neutral — they are not silently boosted.
//
// Scoring is layered ON TOP of the existing signals (Ethos trust, incentives,
// Megamafia / BadBunnz family bonuses) inside `server/ai-advisor.ts`. It does
// not replace them.

export type JojoScore = {
  trust: number;     // 1 (low) .. 10 (high)
  potential: number; // 1 (low) .. 10 (high)
  rationale: string; // Literal phrase from the project's jojoInsight
};

export const JOJO_SCORES_BY_PROJECT_ID: Record<string, JojoScore> = {
  brix: {
    trust: 7,
    potential: 6,
    rationale: '"Strong RWA angle, but not the cleanest match if you want specifically rental or real-estate exposure."'
  },
  tulpea: {
    trust: 9,
    potential: 8,
    rationale: '"Tulpea is the clearest real-estate-flavored RWA app in the current MegaETH set."'
  },
  'wink-realm': {
    trust: 8,
    potential: 9,
    rationale: '"cooked by my bro Chef Goose, clearly one of the upcoming things I\'m watching"'
  },
  dotmegadomains: {
    trust: 8,
    potential: 7,
    rationale: '"Cooked by the best bread in the world... this could become very useful for the eco later on"'
  },
  'mega-punk': {
    trust: 4,
    potential: 4,
    rationale: '"not much more to say"'
  },
  bungee: {
    trust: 8,
    potential: 7,
    rationale: '"Bungee is probably your cheapest bridge option, real chads ngl"'
  },
  avail: {
    trust: 4,
    potential: 4,
    rationale: '"never tried tbh so can\'t comment on that one"'
  },
  jumper: {
    trust: 7,
    potential: 5,
    rationale: '"definitely the easiest one for most" but "I don\'t know if it\'s the cheapest option"'
  },
  backed: {
    trust: 6,
    potential: 8,
    rationale: '"the promise is pretty cool ngl. MegaETH is perfectly fit for everything around agents so I\'m curious to see this one live."'
  },
  pulse: {
    trust: 7,
    potential: 7,
    rationale: '"pretty cool and useful"'
  },
  megafarm: {
    trust: 4,
    potential: 4,
    rationale: '"not much to say on this one, maybe give it a try"'
  },
  ferdy: {
    trust: 4,
    potential: 4,
    rationale: '"Not much to say"'
  },
  megablobz: {
    trust: 5,
    potential: 5,
    rationale: '"Seen them active in the community... i don\'t know much more about them ngl"'
  },
  dream: {
    trust: 8,
    potential: 9,
    rationale: '"latest app to join the Megamafia program... a category with a lot of potential. I\'d definitely keep an eye on them."'
  },
  orchid: {
    trust: 9,
    potential: 9,
    rationale: '"I love neobanks, so this is very interesting to me"'
  },
  evently: {
    trust: 7,
    potential: 7,
    rationale: '"rewards market creators with 1% of trading volume to incentivize faster and more dynamic market creation"'
  },
  'betman-genesis': {
    trust: 8,
    potential: 8,
    rationale: '"very low supply and kind of the VIP collection on Mega"'
  },
  duon: {
    trust: 8,
    potential: 8,
    rationale: '"Ngl that\'s pretty cool... Impressive."'
  },
  'nx-terminal': {
    trust: 8,
    potential: 8,
    rationale: '"Very cool experience, I recommend"'
  },
  chisino: {
    trust: 7,
    potential: 7,
    rationale: '"the focus is to be the most rewarding casino. Very interesting."'
  },
  aori: {
    trust: 9,
    potential: 8,
    rationale: '"Aori has been the best bridge for MegaETH... Give them some love!"'
  },
  nextrare: {
    trust: 7,
    potential: 8,
    rationale: '"looks sick. Imo TCG is one of the most interesting narratives... love to see NextRare iterate!"'
  },
  purrlend: {
    trust: 6,
    potential: 6,
    rationale: '"We love every app here, give them some love" (no deeper personal take)'
  },
  monster: {
    trust: 8,
    potential: 8,
    rationale: '"bringing an amazing TCG app to the ecosystem. Welcome them to the family!"'
  },
  xeet: {
    trust: 7,
    potential: 7,
    rationale: '"innovative SocialFi app... Welcome them to the Mega family!"'
  },
  omen: {
    trust: 7,
    potential: 9,
    rationale: '"Backed by the same team that backed Robinhood, this might be a sleeping giant who knows?"'
  }
};
