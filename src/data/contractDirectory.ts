export type ContractDirectoryEntry = {
  projectId: string;
  contracts?: string[];
  nftContracts?: string[];
};

const RAW_DIRECTORY: ContractDirectoryEntry[] = [
  {
    projectId: 'smasher',
    contracts: ['0x0e0f4dd25ae8ab20e1583d9e8edff319a88e1d3f']
  },
  {
    projectId: 'survivors',
    contracts: [
      '0x5132fb10ac1d4b42682f5b92b6a1b2ff915ef460',
      '0xc83f59e71878966f7fb5cf7740360e8d25762af2'
    ]
  },
  {
    projectId: 'offshore',
    contracts: [
      '0x5ba66a7ae8dbf2bd239cd32bbff1fb8009f58e14',
      '0x943b75c86b83b8125d8e2b56d15fd30e8e1a0e74'
    ],
    nftContracts: ['0x943b75c86b83b8125d8e2b56d15fd30e8e1a0e74']
  },
  {
    projectId: 'bad-bunnz',
    nftContracts: ['0xbdb13add477e76c1df52192d4f5f4dd67f6a40d8']
  },
  {
    projectId: 'digitrabbits',
    nftContracts: ['0x0dc2a6df9ce984f1d7cbcb662fb44a87779ec30a']
  }
];

const normalizeAddress = (value: string) => value.trim().toLowerCase();

type ContractKind = 'contracts' | 'nftContracts';

const buildLookup = (kind: ContractKind) => {
  return RAW_DIRECTORY.reduce<Record<string, string>>((acc, entry) => {
    const addresses = entry[kind];
    if (!addresses) {
      return acc;
    }
    addresses.forEach((address) => {
      const normalized = normalizeAddress(address);
      if (normalized) {
        acc[normalized] = entry.projectId;
      }
    });
    return acc;
  }, {});
};

export const INTERACTION_CONTRACT_MAP = buildLookup('contracts');
export const NFT_CONTRACT_MAP = buildLookup('nftContracts');
export const CONTRACT_DIRECTORY = RAW_DIRECTORY;
