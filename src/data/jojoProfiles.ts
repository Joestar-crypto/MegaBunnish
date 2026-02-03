import { JojoProfile } from '../types';

export const DEFAULT_JOJO_PROFILE_ID = 'lowRisk';

export const JOJO_PROFILES: JojoProfile[] = [
  {
    id: DEFAULT_JOJO_PROFILE_ID,
    label: 'Low risk',
    hint: 'Capital preservation',
    description: 'Battle-tested venues Jojo leans on for consistent flow.',
    projectIds: [
      'euphoria',
      'worldmarkets',
      'rocket',
      'blitzo',
      'topstrike',
      'hello-trade',
      'avon',
      'lemonade',
      'telis',
      'kumbaya',
      'hunch',
      'prismfi',
      'dorado',
      'aqua',
      'blackhaven',
      'aveforge'
    ]
  },
  {
    id: 'highPotential',
    label: 'High Potential',
    hint: 'Moonshot radar',
    description: 'High-upside experiments Jojo tracks for outsized upside.',
    projectIds: [
      'lora-finance',
      'supernova',
      'canonic',
      'bunnzpaw',
      'faster',
      'premarket',
      'clutch',
      'offshore',
      'sirio',
      'tulpea',
      'brix',
      'benchmark',
      'ubitel',
      'cilium',
      'showdown',
      'stomp'
    ]
  }
];
