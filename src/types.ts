export type ConstellationLinkMap = {
  site?: string;
  docs?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  nft?: string;
};

export type Incentive = {
  id: string;
  title: string;
  reward: string;
  expiresAt: string;
};

export type IncentiveMap = Record<string, Incentive[]>;

export type RawProject = {
  id: string;
  name: string;
  categories: string[];
  networks: string[];
  links: ConstellationLinkMap;
  logo: string;
  isLive?: boolean;
  incentives?: Incentive[];
  linkedIds?: string[];
};

export type SpecialFilters = {
  megamafia: boolean;
  jojo: boolean;
  mobile: boolean;
  native: boolean;
};

export type JojoProfile = {
  id: string;
  label: string;
  hint?: string;
  description?: string;
  projectIds?: string[];
};

export type ConstellationProject = RawProject & {
  position: { x: number; y: number };
  incentives: Incentive[];
  primaryCategory: string;
  linkedIds: string[];
  clusterOrigin: { x: number; y: number };
  isLive: boolean;
  highlight?: HighlightVariant;
  traits: SpecialFilters;
};

export type HighlightVariant = 'badbunnz' | 'megalio';

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
};

export type ConstellationState = {
  projects: ConstellationProject[];
  projectPoolSize: number;
  categories: string[];
  categoryCounts: Record<string, number>;
  activeCategories: string[];
  hoveredProjectId: string | null;
  selectedProjectId: string | null;
  camera: CameraState;
  cameraReturnPoint: { x: number; y: number; zoom: number } | null;
  filters: SpecialFilters;
  favoriteIds: string[];
  favoritesOnly: boolean;
  liveOnly: boolean;
  jojoProfileId: string;
  ethosScores: Record<string, number>;
  ethosProfileLinks: Record<string, string | null>;
  isEthosOverlayActive: boolean;
  ethosScoreThreshold: number | null;
};
