import { useEffect, useMemo, useState } from 'react';
import { APP_EVENTS, type AppEvent } from '../data/appEvents';
import { useConstellation } from '../state/constellation';
import { getCategoryColor } from '../utils/colors';

const SOCIAL_LINKS: { key: 'site' | 'twitter' | 'discord' | 'telegram' | 'nft'; label: string; icon: string }[] = [
  { key: 'site', label: 'Website', icon: '/logos/Website.webp' },
  { key: 'twitter', label: 'X', icon: '/icons/x.svg' },
  { key: 'discord', label: 'Discord', icon: '/logos/Discord.webp' },
  { key: 'telegram', label: 'Telegram', icon: '/logos/Telegram.webp' },
  { key: 'nft', label: 'NFT', icon: '/logos/NFT.webp' }
];

const INCENTIVE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric'
});

const formatIncentiveDateRange = (start?: string | null, end?: string | null) => {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const hasStart = Boolean(startDate && !Number.isNaN(startDate.getTime()));
  const hasEnd = Boolean(endDate && !Number.isNaN(endDate.getTime()));

  if (!hasStart && !hasEnd) {
    return null;
  }
  if (hasStart && hasEnd) {
    const startLabel = INCENTIVE_DATE_FORMATTER.format(startDate as Date);
    const endLabel = INCENTIVE_DATE_FORMATTER.format(endDate as Date);
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  }
  if (hasStart) {
    return INCENTIVE_DATE_FORMATTER.format(startDate as Date);
  }
  return INCENTIVE_DATE_FORMATTER.format(endDate as Date);
};

const formatIncentiveCountdown = (end?: string | null, nowMs?: number) => {
  if (!end) {
    return null;
  }
  const endTime = new Date(end).getTime();
  if (Number.isNaN(endTime)) {
    return null;
  }
  const now = nowMs ?? Date.now();
  const diffMs = endTime - now;
  if (diffMs <= 0) {
    return 'Ended';
  }
  if (diffMs > 28 * 24 * 60 * 60 * 1000) {
    return '?';
  }
  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  if (days === 0 && hours === 0) {
    parts.push(`${minutes}m`);
  }
  return `Ends in ${parts.join(' ')}`;
};

type DialogueSegment =
  | { kind: 'text'; content: string }
  | { kind: 'link'; label: string; targetId: string };

type DialogueBlock = DialogueSegment[];

const textSegment = (content: string): DialogueSegment => ({ kind: 'text', content });
const linkSegment = (label: string, targetId: string): DialogueSegment => ({ kind: 'link', label, targetId });

const JOJO_DIALOGUE: Record<string, DialogueBlock[]> = {
  'cap-money': [
    [
      textSegment(
        'Cap is creating a new way to get stablecoin yield by using EigenLayer security with an autonomous layer of operators to capture the best yield at any moment, regardless of market conditions.'
      )
    ],
    [
      textSegment(
        'This fixes a common problem with yield-bearing stablecoins: their strategies only offer good yields when optimal conditions are met. Cap automatically pivots its strategy depending on conditions, making it a very strong actor in the space.'
      )
    ]
  ],
  euphoria: [
    [
      textSegment(
        'Euphoria is the most addictive mobile-first trading app in the ecosystem. It leverages MegaETH scalability and RedStone\'s optimized oracle to deliver fast trading, coupled with tap trading, a completely new way to abstract the worst parts of the trading experience while making it fun and addictive.'
      )
    ],
    [textSegment('Definitely one of my favorites.')]
  ],
  rocket: [
    [
      textSegment(
        'Rocket is redefining prediction markets with redistribution markets. Instead of keeping capital idle until long-term resolution, everyone wins or loses a portion of their bet every 5 seconds.'
      )
    ],
    [textSegment("Definitely the gaming app I\'m the most excited about, I love every boss design.")]
  ],
  aveforge: [
    [
      textSegment(
        'Built by a team that has shipped Bloomtown and Graveyard Keeper on Steam, this addictive battler game is creating a strong IP around mecha, using blockchain as settlement for rewards and cosmetics.'
      )
    ],
    [textSegment("Definitely the gaming app I'm the most excited about (I love every boss design).")]
  ],
  'hello-trade': [
    [
      textSegment(
        'Mobile-first trading app built by ex-BlackRock (yes, the team that made IBIT possible), HelloTrade focuses on bringing TradFi assets onchain, such as stocks, RWAs, ETFs, and commodities.'
      )
    ],
    [
      textSegment(
        'I\'m genuinely excited about this one: the team is top-tier, they\'ve raised significant funding, and they\'re targeting a still untouched area of crypto adoption, using blockchain as a 24/7 settlement layer to trade anything at the speed of light on mobile.'
      )
    ]
  ],
  'bad-bunnz': [
    [
      textSegment('The biggest NFT collection imo (who\'s surprised?), they are cooking hard on 3 different products: '),
      linkSegment('PrismFi', 'prismfi'),
      textSegment(', '),
      linkSegment('BunnzPaw', 'bunnzpaw'),
      textSegment(', and '),
      linkSegment('Faster', 'faster'),
      textSegment('.')
    ],
    [textSegment('Not holding a BadBunnz should be considered a crime in MegaETH territory.')]
  ],
  blitzo: [
    [
      textSegment(
        "Ngl I don't fully understand this one lol, it seems like a payment app coupled with something like TikTok lmao, making every payment memeable and tradable."
      )
    ],
    [textSegment("Idk, but it's a MegaMafia project, so don't fade it.")]
  ],
  prismfi: [
    [
      textSegment('THE MegaETH super app, built by BadBunnz, already packed with major announcements like '),
      linkSegment('World Markets', 'worldmarkets'),
      textSegment(' integration for perps, Polymarket for prediction markets, and '),
      linkSegment('Avon', 'avon'),
      textSegment(' for lending.')
    ],
    [textSegment("I\'m pretty sure this is the app you\'ll use the most.")]
  ],
  bunnzpaw: [
    [
      textSegment('The only Gacha game I know of on MegaETH, built by BadBunnz and using their strong IP for design and style.')
    ],
    [textSegment("Definitely a solid product that\'s likely to find PMF.")]
  ],
  faster: [
    [
      textSegment('One of the most anticipated launchpads on MegaETH, communicating on my TL like a real schizo.')
    ],
    [textSegment('Built by BadBunnz, it totally matches their vibe lol.')]
  ],
  brix: [
    [
      textSegment(
        'Brix is the first app bringing emerging markets onchain. While everyone is focusing on classic TradFi assets to earn 4% APR, Brix is doing the hard work of tokenizing emerging markets that can offer exposure of up to 40% APR.'
      )
    ],
    [textSegment("Maybe you\'re not the PMF here, but there\'s definitely an untouched one.")]
  ],
  sectorone: [
    [
      textSegment('SectorOne is the only DEX using DLMM, an upgrade from classic AMMs where liquidity is placed strategically instead of everywhere.')
    ],
    [
      textSegment("The goal is to deliver better quotes and deeper liquidity dynamically. I don't know much more yet, but I like the DLMM architecture.")
    ]
  ],
  valhalla: [
    [
      textSegment('Valhally is a Perps, Spot and DeFi platform all in one, beneficiating from the composability of each service.')
    ],
    [
      textSegment("Didn't hear from them since a month tho, I don't know if they are cooking and if they stopped.")
    ]
  ],
  breadio: [
    [
      textSegment("Tut is really an OG, and Legend of Breadio is a very respected collection. I didn't follow this collection that closely, there are just too many good NFT collections on this blockchain, damn.")
    ]
  ],
  tulpea: [
    [
      textSegment("Tulpea is bringing undercollateralized loans onchain by using a DAO for risk management and by making debt and equity programmable.")
    ],
    [
      textSegment("I don't know how, or if, it's going to work, but whenever a new actor tries to solve undercollateralized lending onchain, I'm listening.")
    ]
  ],
  gmx: [
    [
      textSegment("The OG of perps trading is expanding to MegaETH, and that's big.")
    ],
    [
      textSegment("Even though it's lost market share to Hyperliquid and competitors, it still sits at around $350M TVL, and its community is going to love the 10ms latency on MegaETH.")
    ]
  ],
  ren: [
    [
      textSegment('Used to be the main protocol for cross-chain BTC/BCH/ZEC DeFi, then collapsed after the Alameda acquisition and the FTX crash.')
    ]
  ],
  lemonade: [
    [
      textSegment('Probably one of the best social apps on MegaETH. They have a big vision for onchain social interactions, events, and networks.')
    ],
    [textSegment('I think you should be part of the community, just sayin\'.')]
  ],
  dorado: [
    [
      textSegment(
        "Fully trustless gambling app, leveraging blockchain to create a truly fair onchain casino. I\'m not sure I fully get how it will work with LPs, but it\'s clearly experimenting with something new, and I love the innovation."
      )
    ]
  ],
  pumpparty: [
    [
      textSegment(
        "This one is weird: it used to be a Megamafia project with AI, trading, and battles, then it went silent. Now it\'s back with a game, still mentioning Megamafia, but Megamafia doesn\'t seem to support it anymore."
      )
    ],
    [
      textSegment(
        'Either it stopped because ambitions were too high and came back with a simpler game to ride mainnet hype, or it\'s really cooking. I don\'t know.'
      )
    ]
  ],
  strip: [
    [
      textSegment(
        'DeFi loop that kind of looks like a Ponzi or a 2020 experiment. I like those, but always approach with caution.'
      )
    ]
  ],
  cryptsai: [
    [
      textSegment(
        'Seems like an adventure game using AI prompts. Could be a fun one.'
      )
    ]
  ],
  mania: [
    [
      textSegment(
        'Another meme launchpad, nothing else to say.'
      )
    ]
  ],
  alzena: [
    [
      textSegment(
        'Not sure I understand it well, but it looks like a world with beautiful art. It feels like lore and world-building.'
      )
    ]
  ],
  worldmarkets: [
    [
      textSegment(
        'WCM is an all-in-one platform combining perps, spot, and lending on the same margin for maximum capital efficiency.'
      )
    ],
    [textSegment('The only limit is your imagination, definitely one of the best apps imo.')]
  ],
  wrapx: [
    [
      textSegment("Not much to say except that it's another DEX on MegaETH.")
    ]
  ],
  benchmark: [
    [
      textSegment(
        "It\'s the curation layer for USDm and beyond, the actor that finds the best risk-reward strategies for protocols or institutions."
      )
    ],
    [textSegment("You\'re probably not the PMF here, but this is typically a sign of a mature ecosystem.")]
  ],
  avon: [
    [
      textSegment(
        'Imagine if lending offers worked like trading orders, with personalized risk, LTV, rates, and more. That\'s exactly what Avon is doing by using a CLOB with isolated markets, creating a real-time, dynamic market for lending rates.'
      )
    ],
    [textSegment("Imo this is huge, isolated markets have already proven successful, but this is the first to use a CLOB architecture onchain. Definitely the lending app I\'m most excited about.")]
  ],
  blackhaven: [
    [
      textSegment(
        "By the crazy mind behind OlympusDAO, the one who created those insane flywheels back in the day. He\'s back, this time on the best blockchain to build an onchain DAT, like MicroStrategy, but faster, crazier, stronger, and for $MEGA."
      )
    ],
    [textSegment("Definitely something I\'ll love to follow.")]
  ],
  aqua: [
    [
      textSegment(
        'Aqua could be your go-to LST, letting you hold OMEGA, which receives yield from $MEGA staking, and additionally uses the Tide and Current model to offer extra yield with a strong risk-reward ratio.'
      )
    ]
  ],
  aave: [
    [
      textSegment(
        "Well, the biggest lending protocol is expanding on MegaETH even after swearing they'd avoid L2s without conviction about their future success. Interesting, isn't it?"
      )
    ]
  ],
  aurion: [
    [
      textSegment('Aurion is building a concentrated liquidity AMM and a prediction market on MegaETH with Algebra and Aegas.')
    ],
    [textSegment("I'm curious about this one, the DEX and prediction market combined is original.")]
  ],
  showdown: [
    [
      textSegment(
        "The biggest card game on MegaETH, built by a Magic and Hearthstone card champion, with its own set of cards and rules. I\'m not a card player, more of a chess player, but I recognize talent, and this game has a lot of it, with an already strong community."
      )
    ]
  ],
  topstrike: [
    [
      textSegment(
        'The only football trading game on MegaETH as far as I know, focused on mobile and adjusting in real time to match events.'
      )
    ],
    [textSegment('Definitely an app you\'ll love if you\'re a football connoisseur, but it\'s clearly one of the best mobile apps out there.')]
  ],
  stomp: [
    [
      textSegment('Think of it as a Pokemon-like onchain game, creating its own set of monsters.')
    ],
    [textSegment("It\'s a MegaMafia project, so definitely a solid one, and I love Pokemon, so expect me to be on the leaderboard.")]
  ],
  rainmaker: [
    [
      textSegment('An AI and meme launchpad on MegaETH, with 100% of fees going to $RAIN.')
    ],
    [textSegment("Ngl guys, I don\'t know much about this one, so you\'re on your own, and you should always be careful when entering a new ecosystem.")]
  ],
  kumbaya: [
    [
      textSegment(
        'Definitely one of the main actors of the ecosystem and one of the biggest MegaMafia projects, building what will probably be the next big DEX and a launchpad expected to create and monetize cults.'
      )
    ],
    [textSegment("I\'m excited, but we still don\'t have much info right now.")]
  ],
  meth: [
    [
      textSegment("I\'d say it\'s the most hyped memecoin in the ecosystem. Memecoins are still pretty calm on MegaETH for now, but I expect that to change once everyone enters MegaETH.")
    ]
  ],
  mevx: [
    [
      textSegment('MEVX is a trading platform with a Telegram bot and they\'re now expanding to MegaETH.')
    ]
  ],
  megarafia: [
    [
      textSegment("Megarafia is a MegaETH memecoin and a future NFT collection. I don\'t know much about them, only that they\'ve been around for a long time now.")
    ]
  ],
  cilium: [
    [
      textSegment('Cilium is an alien technology that uses MegaETH to create a spatial layer for drones, robots, and self-driving vehicles. Yeah, the team is already in 2056.')
    ]
  ],
  meridian: [
    [
      textSegment('Tbh I love that one, they\'re building x402 rails for the AI agent economy and that might be the next huge narrative.')
    ],
    [
      textSegment("I'm glad to see one of the x402 projects expanding to MegaETH, it should unlock a ton of AI interactions.")
    ]
  ],
  ubitel: [
    [
      textSegment('A very interesting DePIN project using TEE technology to exchange internet access anywhere in the world for verifiable compute.')
    ]
  ],
  hunch: [
    [
      textSegment('Hunch is like Polymarket on steroids, with fast bets and resolutions. This might be very addictive, and it\'s accelerated by MegaMafia, so expect something interesting.')
    ]
  ],
  'mega-heroes': [
    [
      textSegment(
        "Trading app using AI and NFTs for copy trading and PvP. I thought the project was dead, then they came back. I don\'t know much about this one tbh, dyor, nfa, blablabla."
      )
    ]
  ],
  everwatch: [
    [
      textSegment('Everwatch is using AI to power a trading assistant.')
    ],
    [textSegment("I don\'t have more information, there\'s been no communication for months, but it\'s a MegaMafia project, so if they\'re still cooking, it might be interesting.")]
  ],
  'nectar-ai': [
    [
      textSegment('Best app if you want to create your waifu companion with AI.')
    ],
    [textSegment("I don\'t know who the PMF is here, but it\'s a MegaMafia project, and I promised myself not to fade those.")]
  ],
  mtrkr: [
    [
      textSegment('Probably the wallet tracker you\'ll use the most, especially if you want to track your activity for the campaign.')
    ]
  ],
  funes: [
    [
      textSegment('3D modeling museum onchain, I have no idea what to expect, which is exactly why I\'m so curious about this one.')
    ]
  ],
  fluffle: [
    [
      textSegment("Well, it's just like the main NFT project led directly by the foundation that was sold as fundraising a year ago.")
    ],
    [
      textSegment("But that's not all, it's going to evolve at mainnet so keep an eye on them.")
    ]
  ],
  netizens: [
    [
      textSegment('One of the last big NFT collections to pop up in the ecosystem, they seem heavily backed and hyped, so it\'s probably one you\'ll want to keep an eye on when mainnet launches.')
    ]
  ],
  meganacci: [
    [
      textSegment('Very low-supply NFT collection by a GOAT artist, I\'d say it\'s the most hyped NFT launch right now. The low supply and the art make it quite unique.')
    ]
  ],
  enjoyooors: [
    [
      textSegment("Ngl I don\'t really know this NFT collection properly, but it\'s one I keep seeing a lot on my timeline.")
    ]
  ],
  digitrabbits: [
    [
      textSegment('OG NFT collection with schizo but beautiful art, already live and one of my favorites tbh.')
    ]
  ],
  barry: [
    [
      textSegment('No idea about this collection, I just know Barry is an OG and a respected member of the MegaETH community. Just be careful, this guy eats English food and criticizes French food, weird.')
    ]
  ],
  based: [
    [
      textSegment('Based is a Telegram bot expanding to MegaETH.')
    ]
  ],
  'glitchy-bunnies': [
    [
      textSegment('Schizo art NFT collection, definitely one of my favorites, with a talented and kind artist. One of the best imo.')
    ]
  ],
  megalio: [
    [
      textSegment('One of the OG NFT collections, cooking hard on '),
      linkSegment('Priority', 'priority'),
      textSegment(', you definitely have to know them.')
    ]
  ],
  priority: [
    [
      textSegment('Probably your best companion if you\'re a trencher, it\'s a Telegram bot for trading on MegaETH, a must-have, built by '),
      linkSegment('Megalio', 'megalio'),
      textSegment(' chads.')
    ]
  ],
  'lora-finance': [
    [
      textSegment('A very interesting innovation that lets anyone borrow market exposure with leverage, without experiencing liquidations or funding management. The only thing to do is pay a small streaming fee.')
    ],
    [textSegment('A very solid product that abstracts options and makes them more efficient imo.')]
  ],
  'leverage-sir': [
    [
      textSegment('Lets you pay a one-time fee to get leveraged market exposure without liquidations, pretty cool if you\'re a long-term trader.')
    ],
    [textSegment('Very complicated though, go to the docs to understand exactly what you\'re using.')]
  ],
  supernova: [
    [
      textSegment('Very interesting innovation that lets anyone get fixed rates on borrows, which is badly needed, while the rates are tradable and create a market for rate discovery.')
    ],
    [textSegment('This one really takes programmable money seriously, will keep an eye on it.')]
  ],
  nunchi: [
    [
      textSegment('The global rates trading app, where you can trade things like Hyperliquid APY, a very interesting and still untouched type of asset imo.')
    ],
    [textSegment('I\'m very bullish on the tokenize and trade everything thesis.')]
  ],
  sirio: [
    [
      textSegment('Sirio is a launchpad using the same governance mechanism as MetaDAO, the futarchy model, which basically turns every proposal into a market.')
    ],
    [textSegment("I love futarchy, I love MetaDAO, I have no idea if Sirio is good, but I\'ll keep an eye on it.")]
  ],
  telis: [
    [
      textSegment("It\'s a bridge that leverages MegaETH\'s 10ms block time to create a delta-neutral strategy and arbitrage on "),
      linkSegment('WCM', 'worldmarkets'),
      textSegment(' paying you to bridge when it\'s net positive.')
    ],
    [textSegment('Quite amazing, frankly, if you want innovation, here it is.')]
  ],
  hitdotone: [
    [
      textSegment('The full degen app, it\'s like a lottery machine, but it chooses the asset, the size, and the direction for you.')
    ],
    [textSegment("Usually people think this is useless because they\'re not the PMF. I\'m not the PMF either, but I think this kind of casino product can be really strong and adopted fast.")]
  ],
  '1perday': [
    [
      textSegment('An interesting launchpad concept that only lists one memecoin per day, making each drop far less competitive and protecting it from the usual sniper swarm.')
    ],
    [textSegment("Sounds great on paper but I don\'t know the founder yet, so I\'m keeping some caution until we see execution.")]
  ],
  redstone: [
    [
      textSegment('You\'re going to enjoy full MegaETH scalability because the Redstone team built the fastest oracle exactly for that use case.')
    ],
    [textSegment("Just for that alone they\'re basically GOATED, so yeah, show them some love.")]
  ],
  megatruther: [
    [
      textSegment('MegaTruther is a cryptic community crafting games, puzzles, and IRL events across MegaETH.')
    ],
    [textSegment("It\'s honestly one of the biggest active squads around Mega, so keep tabs on whatever they tease.")]
  ],
  huntertales: [
    [
      textSegment('Huntertales is a pixel-art battlefield where you recruit hunters, form parties, and deploy them to earn the REDACTED token for packs.')
    ],
    [textSegment("I don\'t know them deeply yet, but the following is solid so I\'ll dig deeper and keep an eye on it.")]
  ],
  'dead-bit-nation': [
    [
      textSegment('Another NFT collection planning to launch the HOMIE memecoin and use trading fees to buy back NFTs, kind of a Punk strategy.')
    ],
    [textSegment("Didn\'t follow it closely but it\'s definitely an interesting one.")]
  ],
  megarebel: [
    [
      textSegment('Rebel is a low-supply NFT that isn\'t as hyped as others but clearly worked hard to win the MegaETH community.')
    ],
    [
      textSegment("They\'re even building a launchpad called "),
      linkSegment('Odds', 'odds'),
      textSegment(', so watch how that duo evolves.')
    ]
  ],
  odds: [
    [
      textSegment('Odds looks like an NFT launchpad to create, mint, and trade collections built by '),
      linkSegment('MegaRebel', 'megarebel'),
      textSegment('.')
    ],
    [textSegment('If they nail UX it could quickly become the native mint hub.')]
  ],
  gearbox: [
    [
      textSegment('Gearbox is a lending infra for tokens and RWAs that used to sit near $400M TVL and still has about $60M while deploying on MegaETH.')
    ],
    [textSegment("That\'s a strong signal OG protocols see MegaETH as a real opportunity.")]
  ],
  gains: [
    [
      textSegment('Gains Network is another perp DEX expanding to MegaETH, they really get our culture so kudos.')
    ]
  ],
  syndicate: [
    [
      textSegment('Syndicate is the biggest MegaETH community I know of, period.')
    ],
    [textSegment('If you need help navigating the ecosystem, that\'s the Discord you want.')]
  ],
  rarible: [
    [
      textSegment("You don\'t know Rarible? Come on bro... seriously???")
    ]
  ],
  smasher: [
    [
      textSegment('Smasher was one of the only apps live during the MegaETH stress test with slick 3D art.')
    ],
    [textSegment('Not much alpha yet but I\'m curious to see how it evolves.')]
  ],
  megabeers: [
    [
      textSegment('MegaBeers is an NFT project fused with a gacha game.')
    ],
    [textSegment("Pretty intriguing even though I don\'t know that much about them tbh.")]
  ],
  survivors: [
    [
      textSegment('Survivors is a beautifully animated series where you can chat directly with the protagonist on a webpage.')
    ],
    [textSegment('I was honestly surprised by the quality when I tried it and still wonder how I missed it for months.')]
  ],
  reach: [
    [
      textSegment('Reach is a social growth and engagement platform using LLMs to help creators maximize visibility and monetization.')
    ],
    [textSegment("First time I come across a protocol like this so I'm curious even if I don't know much yet.")]
  ],
  realtime: [
    [
      textSegment('This superapp is made by the FusionX devs (a former DEX on Mantle) and will integrate CLOB, perps, a launchpad, and an aggregator.')
    ]
  ],
  miniminds: [
    [
      textSegment('Ngl I love this art and universe, plus it\'s made by core community members, so I\'ll watch it closely.')
    ]
  ],
  chainlink: [
    [
      textSegment('Did you know that Chainlink has a TikTok account? I had nothing to say here, come on, it\'s Chainlink, but at least I taught you something lol.')
    ]
  ],
  ethena: [
    [
      textSegment('Did you know that I\'m a big fan of Ethena? So I\'m definitely very happy they announced backing USDm, the main MegaETH stablecoin that will play an important role in this ecosystem. Yup.')
    ]
  ],
  renzo: [
    [
      textSegment('One of the biggest LRT protocols deploying ezETH on MegaETH.')
    ]
  ],
  opensea: [
    [
      textSegment("If you don't know OpenSea, I don't know what to tell you lmao.")
    ]
  ],
  'magic-eden': [
    [
      textSegment("Everyone knows Magic Eden, they're one of the biggest NFT marketplaces, come onnnn.")
    ]
  ],
  clutch: [
    [
      textSegment("It's a prediction market for livestreaming. We don't have much more for now, but I'll keep an eye on this one.")
    ]
  ],
  premarket: [
    [
      textSegment('Premarket lets you trade options on everything, from IPOs to RWAs and TGEs. It\'s pure exposure, no margin, no liquidations, no funding.')
    ],
    [
      textSegment("It's a small project for now, but the promise is very interesting, and it's built by Stryke, an options protocol that used to be quite famous in the past.")
    ]
  ],
  offshore: [
    [
      textSegment('I have no idea bro lmao.')
    ]
  ],
  syscall: [
    [
      textSegment("This one is weird lol, it's a reverse oracle that lets you send an SMS or an email from a smart contract.")
    ],
    [
      textSegment('This is the kind of innovation that could be useful for no one, or literally change the world lmao.')
    ]
  ],
  warren: [
    [
      textSegment('A "Permaweb" app that lets you host anything onchain on MegaETH. Pretty cool tbh, this kind of thing never took off because of fees, but it could work on Mega maybe.')
    ]
  ],
  megacorp: [
    [
      textSegment("I have no idea at what I'm looking at bro lol, but I like lores.")
    ]
  ],
  skrrtlords: [
    [
      textSegment('This is an NFT racing game with tournaments and rewards, not much more to say tbh.')
    ]
  ],
  canonic: [
    [
      textSegment('Pretty cool ngl, it\'s a trading app solving a common problem of perp DEXs: market makers have to cancel and requote constantly to provide liquidity and execute orders, and this cost inevitably falls on users.')
    ],
    [
      textSegment('By using MOAB architecture and '),
      linkSegment('Redstone', 'redstone'),
      textSegment(', Canonic can link liquidity to price continuously, so market makers don\'t need to requote all the time.')
    ],
    [
      textSegment('This is very promising on paper, but the hard part will be getting enough liquidity and partners to prove it for real.')
    ]
  ],
  gocash: [
    [
      textSegment('GoCash is a gaming hub with different mini-games, not much to say tbh.')
    ]
  ]
};

const JojoOracle = ({ projectId, onNavigate }: { projectId: string; onNavigate: (targetId: string) => void }) => {
  const script = JOJO_DIALOGUE[projectId];

  if (!script) {
    return null;
  }

  return (
    <section className="jojo-panel">
      <div className="jojo-avatar">
        <img src="/logos/Jojo2.webp" alt="Jojo avatar" />
      </div>
      <div className="jojo-bubble">
        <p className="jojo-title">Jojo's Insight</p>
        <div className="jojo-dialogue">
          {script.map((block, blockIndex) => (
            <p key={`jojo-line-${blockIndex}`}>
              {block.map((segment, segmentIndex) =>
                segment.kind === 'text' ? (
                  <span key={`text-${segmentIndex}`}>{segment.content}</span>
                ) : (
                  <button
                    key={`link-${segmentIndex}-${segment.label}`}
                    type="button"
                    className="jojo-link"
                    onClick={() => onNavigate(segment.targetId)}
                  >
                    {segment.label}
                  </button>
                )
              )}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
};

export const ProjectDetailDrawer = () => {
  const [nowTick, setNowTick] = useState(() => Date.now());
  const {
    selectedProjectId,
    selectProject,
    setActiveCategory,
    resolveProjectById,
    favoriteIds,
    toggleFavorite,
    ethosProfileLinks
  } = useConstellation();
  const project = useMemo(
    () => resolveProjectById(selectedProjectId),
    [resolveProjectById, selectedProjectId]
  );
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const isFavorite = project ? favoriteSet.has(project.id) : false;
  const ethosProfileUrl = project ? ethosProfileLinks[project.id] ?? null : null;
  const mintEvents = useMemo(() => {
    if (!project) {
      return [] as AppEvent[];
    }
    return APP_EVENTS.filter((event) => event.projectId === project.id)
      .filter((event) => event.title.toLowerCase().includes('mint'))
      .filter((event) => {
        const endValue = event.end ?? event.start;
        const endMs = new Date(endValue).getTime();
        return !Number.isNaN(endMs) && endMs >= nowTick;
      });
  }, [project, nowTick]);
  const specialEvent = useMemo(() => {
    if (!project || (project.id !== 'euphoria' && project.id !== 'survivors' && project.id !== 'blackhaven')) {
      return null;
    }
    const targetId =
      project.id === 'euphoria'
        ? 'euphoria-tapathon'
        : project.id === 'survivors'
          ? 'survivors-presale-live-14d'
          : 'blackhaven-ico-registration';
    const event = APP_EVENTS.find((entry) => entry.id === targetId);
    if (!event) {
      return null;
    }
    const endValue = event.end ?? event.start;
    const endMs = new Date(endValue).getTime();
    if (Number.isNaN(endMs) || endMs < nowTick) {
      return null;
    }
    return event;
  }, [project, nowTick]);
  const activeIncentives = useMemo(() => {
    if (!project) {
      return [];
    }
    return project.incentives.filter((incentive) => {
      const endMs = new Date(incentive.expiresAt).getTime();
      return !Number.isNaN(endMs) && endMs > nowTick;
    });
  }, [project, nowTick]);
  const hasLiveIncentives = activeIncentives.length > 0;
  const hasMintEvents = mintEvents.length > 0;
  const hasSpecialEvent = Boolean(specialEvent);
  const incentiveSectionLabel = hasMintEvents ? 'Mint Date' : hasSpecialEvent ? 'Event' : 'Active incentives';
  const showIncentiveBell = hasLiveIncentives || hasMintEvents || hasSpecialEvent;
  const socialLinks = useMemo(
    () =>
      project
        ? SOCIAL_LINKS.filter(({ key }) => Boolean(project.links[key])).map((entry) => ({
            ...entry,
            href: project.links[entry.key] as string
          }))
        : [],
    [project]
  );
  const incentiveDetailsUrl = project
    ? project.links.site ?? project.links.docs ?? project.links.twitter ?? null
    : null;

  const isVisible = Boolean(project);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <aside className={`detail-drawer ${isVisible ? 'is-active' : 'is-hidden'}`} aria-hidden={!isVisible}>
      {project ? (
        <div className="drawer-content">
          <header>
            <div className="detail-heading">
              <div className="detail-eyebrow">
                <p className="eyebrow">{project.primaryCategory}</p>
                {ethosProfileUrl ? (
                  <a
                    className="detail-ethos-link"
                    href={ethosProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View Ethos profile"
                    title="View Ethos profile"
                  >
                    <img src="/logos/Ethos.webp" alt="" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              <div className="detail-title">
                <img src={project.logo} alt={`${project.name} logo`} loading="lazy" />
                <div className="detail-title__heading">
                  <h2>{project.name}</h2>
                  {showIncentiveBell ? (
                    <span className="incentive-bell" aria-label={incentiveSectionLabel} title={incentiveSectionLabel}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path
                          d="M12 4a4 4 0 0 1 4 4v3.2l1.2 2.6a1 1 0 0 1-.9 1.4H7.7a1 1 0 0 1-.9-1.4L8 11.2V8a4 4 0 0 1 4-4Z"
                          fill="currentColor"
                        />
                        <path d="M10 17.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
                      </svg>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={isFavorite ? 'favorite-toggle is-active' : 'favorite-toggle'}
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={() => toggleFavorite(project.id)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M12 3.5 14.4 9l5.6.5-4.2 3.6 1.3 5.7L12 15.9l-5.1 2.9 1.3-5.7L4 9.5l5.6-.5Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth={0.9}
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <button className="ghost" type="button" onClick={() => selectProject(null)}>
              Close
            </button>
          </header>
          {socialLinks.length ? (
            <section>
              <h3>Access</h3>
              <div className="icon-link-row">
                {socialLinks.map(({ key, label, icon, href }) => (
                  <a key={key} className="icon-link" href={href} target="_blank" rel="noreferrer" aria-label={label}>
                    <img src={icon} alt="" aria-hidden />
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}
          <JojoOracle projectId={project.id} onNavigate={selectProject} />
          <section>
            <h3>Categories</h3>
            <div className="badge-row">
              {project.categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className="badge badge--link"
                  style={{ borderColor: getCategoryColor(category) }}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>{incentiveSectionLabel}</h3>
            {hasSpecialEvent ? (
              <ul className="incentive-list">
                <li key={specialEvent?.id ?? 'euphoria-event'}>
                  <div className="incentive-item__row">
                    <div className="incentive-item__meta">
                      <h4>
                        {project.id === 'survivors'
                          ? 'Presale Open'
                          : project.id === 'blackhaven'
                            ? 'ICO Registration'
                            : 'Tapathon'}
                      </h4>
                      {formatIncentiveDateRange(specialEvent?.start, specialEvent?.end) ? (
                        <div className="incentive-item__dates">
                          {formatIncentiveDateRange(specialEvent?.start, specialEvent?.end)}
                        </div>
                      ) : null}
                    </div>
                    {formatIncentiveCountdown(specialEvent?.end ?? specialEvent?.start, nowTick) ? (
                      <div
                        className="ethos-events-panel__countdown"
                        aria-label={
                          formatIncentiveCountdown(specialEvent?.end ?? specialEvent?.start, nowTick) ?? undefined
                        }
                      >
                        {formatIncentiveCountdown(specialEvent?.end ?? specialEvent?.start, nowTick)}
                      </div>
                    ) : null}
                  </div>
                  <div className="incentive-item__actions">
                    <a
                      className="ethos-events-panel__action"
                      href={specialEvent?.detailsUrl ?? specialEvent?.tweetUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Details
                    </a>
                  </div>
                </li>
              </ul>
            ) : hasMintEvents ? (
              <ul className="incentive-list">
                {mintEvents.map((event) => (
                  <li key={event.id}>
                    <div className="incentive-item__row">
                      <div className="incentive-item__meta">
                        <h4>{event.title}</h4>
                        {formatIncentiveDateRange(event.start, event.end) ? (
                          <div className="incentive-item__dates">
                            {formatIncentiveDateRange(event.start, event.end)}
                          </div>
                        ) : null}
                      </div>
                      {formatIncentiveCountdown(event.end ?? event.start, nowTick) ? (
                        <div
                          className="ethos-events-panel__countdown"
                          aria-label={formatIncentiveCountdown(event.end ?? event.start, nowTick) ?? undefined}
                        >
                          {formatIncentiveCountdown(event.end ?? event.start, nowTick)}
                        </div>
                      ) : null}
                    </div>
                    <div className="incentive-item__actions">
                      <a
                        className="ethos-events-panel__action"
                        href={event.detailsUrl ?? event.tweetUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Details
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : activeIncentives.length === 0 ? (
              <p className="muted">Nothing live right now. Check back soon.</p>
            ) : (
              <ul className="incentive-list">
                {activeIncentives.map((incentive) => (
                  <li key={incentive.id}>
                    <div className="incentive-item__row">
                      <div className="incentive-item__meta">
                        <h4>{incentive.title}</h4>
                        <p>{incentive.reward}</p>
                        {formatIncentiveDateRange(incentive.startsAt, incentive.expiresAt) ? (
                          <div className="incentive-item__dates">
                            {formatIncentiveDateRange(incentive.startsAt, incentive.expiresAt)}
                          </div>
                        ) : null}
                      </div>
                      {formatIncentiveCountdown(incentive.expiresAt, nowTick) ? (
                        <div
                          className="ethos-events-panel__countdown"
                          aria-label={formatIncentiveCountdown(incentive.expiresAt, nowTick) ?? undefined}
                        >
                          {formatIncentiveCountdown(incentive.expiresAt, nowTick)}
                        </div>
                      ) : null}
                    </div>
                    {incentiveDetailsUrl ? (
                      <div className="incentive-item__actions">
                        <a
                          className="ethos-events-panel__action"
                          href={incentiveDetailsUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Details
                        </a>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </aside>
  );
};
