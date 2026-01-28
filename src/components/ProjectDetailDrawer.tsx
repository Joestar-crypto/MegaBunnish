import { useMemo } from 'react';
import { useConstellation } from '../state/constellation';
import { getCategoryColor } from '../utils/colors';

const SOCIAL_LINKS: { key: 'site' | 'twitter' | 'discord' | 'telegram' | 'nft'; label: string; icon: string }[] = [
  { key: 'site', label: 'Website', icon: '/icons/globe.svg' },
  { key: 'twitter', label: 'X', icon: '/icons/x.svg' },
  { key: 'discord', label: 'Discord', icon: '/icons/discord.svg' },
  { key: 'telegram', label: 'Telegram', icon: '/icons/telegram.svg' },
  { key: 'nft', label: 'NFT', icon: '/icons/nft.svg' }
];

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
    [
      textSegment(
        'This, coupled with margin on every bet, creates high capital efficiency and a real-time prediction market that constantly adjusts. Even if Trump tweets something dumb and makes you lose your bet at the last minute, you would still have made a lot of money on Rocket by being directionally right, unlike on Polymarket. That\'s one of my favorites tbh.'
      )
    ]
  ],
  aveforge: [
    [
      textSegment(
        'Built by a team that has shipped Bloomtown and Graveyard Keeper on Steam, this addictive battler game is creating a strong IP around Mecha, using blockchain as settlement for rewards and cosmetics.'
      )
    ],
    [textSegment("Definitely the gaming app I\'m the most excited about, I love every boss design.")]
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
  legend: [
    [
      textSegment(
        'Still not sure this one will launch on MegaETH, as it was incubated by GTE, which is moving to its own L1. It\'s still a solid PvP trading project that deserves to be highlighted.'
      )
    ],
    [textSegment('Would just love to get a bit of an update please.')]
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
  yokai: [
    [
      textSegment("Yokai is an NFT project that minted recently. I don't know much about them tbh, but I really like the art, and it looks like they're pretty respected in the community.")
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
    ],
    [
      textSegment("Since then, they've been rebuilding, and after years of waiting, they're about to unveil their v2 on MegaETH. I have no idea what this is about exactly, but I'm very excited to discover it.")
    ]
  ],
  wrapx: [
    [
      textSegment('Another DEX, not much to say tbh.')
    ]
  ],
  blitzo: [
    [
      textSegment(
        "Ngl I don\'t fully understand this one lol, it seems like a payment app coupled with something like TikTok, making every payment memeable and tradable. Idk, but it\'s a MegaMafia project, so don\'t fade it."
      )
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
        "A social app that uses AI to clone personalities and trade. I\'m not sure if it\'s still alive, they haven\'t been communicating, but it had some hype a few months ago, so I\'ll keep an eye on it."
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
  ubitel: [
    [
      textSegment('A very interesting DePIN project using TEE technology to exchange internet access anywhere in the world for verifiable compute.')
    ]
  ],
  hop: [
    [
      textSegment("Not sure this one is still building, but Hop Network is a VPN project leveraging MegaETH scalability.")
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
  const {
    selectedProjectId,
    selectProject,
    setActiveCategory,
    resolveProjectById,
    favoriteIds,
    toggleFavorite
  } = useConstellation();
  const project = useMemo(
    () => resolveProjectById(selectedProjectId),
    [resolveProjectById, selectedProjectId]
  );
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const isFavorite = project ? favoriteSet.has(project.id) : false;
  const hasLiveIncentives = Boolean(project?.incentives.length);
  const showIncentiveBell = hasLiveIncentives;
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

  const isVisible = Boolean(project);

  return (
    <aside className={`detail-drawer ${isVisible ? 'is-active' : 'is-hidden'}`} aria-hidden={!isVisible}>
      {project ? (
        <div className="drawer-content">
          <header>
            <div className="detail-heading">
              <p className="eyebrow">{project.primaryCategory}</p>
              <div className="detail-title">
                <img src={project.logo} alt={`${project.name} logo`} loading="lazy" />
                <div className="detail-title__heading">
                  <h2>{project.name}</h2>
                  {showIncentiveBell ? (
                    <span className="incentive-bell" aria-label="Incentives actives" title="Incentives actives">
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
                    aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
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
            <h3>Active incentives</h3>
            {project.incentives.length === 0 ? (
              <p className="muted">Nothing live right now. Check back soon.</p>
            ) : (
              <ul className="incentive-list">
                {project.incentives.map((incentive) => (
                  <li key={incentive.id}>
                    <h4>{incentive.title}</h4>
                    <p>{incentive.reward}</p>
                    <span className="muted">
                      Ends {new Date(incentive.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
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
