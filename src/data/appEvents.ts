export type AppEvent = {
  id: string;
  title: string;
  projectId: string;
  start: string;
  end?: string;
  tweetUrl: string;
  detailsUrl?: string;
  phases: {
    label: string;
    start: string;
    end: string;
  }[];
};

export const APP_EVENTS: AppEvent[] = [
  {
    id: 'meganacci-mint-live',
    title: 'Mint live',
    projectId: 'meganacci',
    start: '2026-02-11T10:00:00-05:00',
    end: '2026-02-11T14:30:00-05:00',
    tweetUrl: 'https://x.com/meganacci/status/2021264150195048767?s=20',
    phases: [
      {
        label: 'Phase 1 (Guaranteed Whitelist)',
        start: '2026-02-11T10:00:00-05:00',
        end: '2026-02-11T13:00:00-05:00'
      },
      {
        label: 'Phase 2 (Fafelnacci FCFS Whitelist)',
        start: '2026-02-11T13:00:00-05:00',
        end: '2026-02-11T13:30:00-05:00'
      },
      {
        label: 'Phase 3 (FCFS Whitelist)',
        start: '2026-02-11T13:30:00-05:00',
        end: '2026-02-11T14:30:00-05:00'
      }
    ]
  },
  {
    id: 'miniminds-mint-live',
    title: 'Mint live',
    projectId: 'miniminds',
    start: '2026-02-16T00:00:00-05:00',
    end: '2026-02-16T23:59:00-05:00',
    tweetUrl: 'https://x.com/theminiminds/status/2021386441826144275?s=20',
    phases: [
      {
        label: 'All day',
        start: '2026-02-16T00:00:00-05:00',
        end: '2026-02-16T23:59:00-05:00'
      }
    ]
  },
  {
    id: 'euphoria-tapathon',
    title: 'Tapathon',
    projectId: 'euphoria',
    start: '2026-02-16T00:00:00-05:00',
    end: '2026-02-16T23:59:00-05:00',
    tweetUrl: 'https://x.com/Euphoria_fi/status/2018731493380796461?s=20',
    phases: [
      {
        label: 'All day',
        start: '2026-02-16T00:00:00-05:00',
        end: '2026-02-16T23:59:00-05:00'
      }
    ]
  },
  {
    id: 'prismfi-incentive-week',
    title: 'Incentive week',
    projectId: 'prismfi',
    start: '2026-02-11T00:00:00-05:00',
    end: '2099-12-31T23:59:00-05:00',
    tweetUrl: 'https://x.com/PrismFi_',
    detailsUrl: 'https://prismfi.cc?ref=joestar',
    phases: [
      {
        label: 'All day',
        start: '2026-02-11T00:00:00-05:00',
        end: '2099-12-31T23:59:00-05:00'
      }
    ]
  },
  {
    id: 'aveforge-cosmetic-sbt-early-users',
    title: 'Cosmetic SBT offered for early users this week',
    projectId: 'aveforge',
    start: '2026-02-12T00:00:00-05:00',
    end: '2026-02-13T23:59:00-05:00',
    tweetUrl: 'https://x.com/AveForge',
    detailsUrl: 'https://aveforge.gg/?referralCode=joestar633',
    phases: [
      {
        label: 'All day',
        start: '2026-02-12T00:00:00-05:00',
        end: '2026-02-13T23:59:00-05:00'
      }
    ]
  },
  {
    id: 'megarebel-mint',
    title: 'Mint',
    projectId: 'megarebel',
    start: '2026-02-13T13:00:00-05:00',
    end: '2026-02-13T14:00:00-05:00',
    tweetUrl: 'https://x.com/MegaRebelNFT',
    phases: [
      {
        label: 'Mint',
        start: '2026-02-13T13:00:00-05:00',
        end: '2026-02-13T14:00:00-05:00'
      }
    ]
  },
  {
    id: 'avon-bootstrapping-phase',
    title: 'Bootstrapping phase live',
    projectId: 'avon',
    start: '2026-02-09T00:00:00-05:00',
    end: '2026-02-16T23:59:00-05:00',
    tweetUrl: 'https://x.com/avon_xyz',
    phases: [
      {
        label: 'All day',
        start: '2026-02-09T00:00:00-05:00',
        end: '2026-02-16T23:59:00-05:00'
      }
    ]
  },
  {
    id: 'glitchy-bunnies-mint',
    title: 'Mint',
    projectId: 'glitchy-bunnies',
    start: '2026-02-19T00:00:00-05:00',
    end: '2026-02-19T23:59:00-05:00',
    tweetUrl: 'https://x.com/404bunnies',
    phases: [
      {
        label: 'All day',
        start: '2026-02-19T00:00:00-05:00',
        end: '2026-02-19T23:59:00-05:00'
      }
    ]
  },
  {
    id: 'survivors-presale-live-14d',
    title: 'Presale live for 14D',
    projectId: 'survivors',
    start: '2026-02-12T00:00:00-05:00',
    end: '2026-02-26T23:59:00-05:00',
    tweetUrl: 'https://x.com/JoinSurvivors/status/2021658154358960333?s=20',
    detailsUrl: 'https://app.joinsurvivors.com/dashboard?ref=GKM8U',
    phases: [
      {
        label: 'Presale',
        start: '2026-02-12T00:00:00-05:00',
        end: '2026-02-26T23:59:00-05:00'
      }
    ]
  }
];
