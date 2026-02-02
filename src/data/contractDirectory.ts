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
    projectId: 'bad-bunnz',
    nftContracts: ['0xbdb13add477e76c1df52192d4f5f4dd67f6a40d8']
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
