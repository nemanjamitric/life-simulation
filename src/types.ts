export interface Bounds {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type TerrainType = 'water' | 'sand' | 'grass' | 'forest' | 'mountain' | 'peak';

export type TerrainSource = 'preset' | 'generated';

export type TerrainPreset = 'river' | 'lake' | 'multiple_lakes' | 'delta';

export type SpeciesKind = 'predator' | 'prey';

export type Sex = 'female' | 'male';

export type CreatureNeed = 'reproduction' | 'thirst' | 'hunger';

export type CreatureIntent =
  | 'wandering'
  | 'seeking_food'
  | 'seeking_water'
  | 'seeking_mate'
  | 'hunting'
  | 'fleeing'
  | 'drinking'
  | 'eating'
  | 'mating'
  | 'resting';

export interface BaseTraits {
  speed: number;
  size: number;
  perception: number;
  maxAge: number;
  hungerCapacity: number;
  thirstCapacity: number;
  reproductionRate: number;
}

export interface CreatureState {
  hunger: number;
  thirst: number;
  reproductionDrive: number;
  age: number;
}

export interface SpeciesConfig {
  initialCount: number;
  baseTraits: BaseTraits;
  variation: number;
}

export interface FoodConfig {
  initialCount: number;
  respawnPerTick: number;
  energyGain: number;
  spawnTerrain: TerrainType[];
}

export interface MutationConfig {
  chance: number;
  amount: number;
}

export interface TimingConfig {
  tickSeconds: number;
  simulationSpeed: number;
}

export interface TerrainGeneratorConfig {
  seed: number;
  scale: number;
  octaves: number;
  persistence: number;
}

export interface TerrainConfig {
  source: TerrainSource;
  preset: TerrainPreset;
  generator: TerrainGeneratorConfig;
  cellSize: number;
  drinkDistance: number;
}

export interface SimulationConfig {
  world: Bounds;
  viewport: Bounds;
  terrain: TerrainConfig;
  predator: SpeciesConfig;
  prey: SpeciesConfig;
  food: FoodConfig;
  mutation: MutationConfig;
  timing: TimingConfig;
}

export interface TerrainCell {
  col: number;
  row: number;
  height: number;
  type: TerrainType;
}

export interface TerrainMap {
  width: number;
  height: number;
  cellSize: number;
  cols: number;
  rows: number;
  cells: TerrainCell[];
}

export interface PlantFood {
  id: string;
  position: Point;
  radius: number;
  nutrition: number;
  consumed: boolean;
}

export interface CreatureSnapshot {
  id: string;
  species: SpeciesKind;
  sex: Sex;
  position: Point;
  traits: BaseTraits;
  state: CreatureState;
  alive: boolean;
  intent: CreatureIntent;
}

export interface TerrainStats {
  water: number;
  sand: number;
  grass: number;
  forest: number;
  mountain: number;
  peak: number;
}

export interface PopulationSnapshot {
  tick: number;
  predatorCount: number;
  preyCount: number;
  plantCount: number;
  births: number;
  deaths: number;
  averageAge: number;
  averageLifetime: number;
  longestLifetime: number;
  averagePredatorSpeed: number;
  averagePreySpeed: number;
  averagePredatorSize: number;
  averagePreySize: number;
  averagePredatorPerception: number;
  averagePreyPerception: number;
}

export interface SimulationSummary {
  tick: number;
  terrainModeLabel: string;
  predatorCount: number;
  preyCount: number;
  plantCount: number;
  births: number;
  deaths: number;
  averageAge: number;
  averageLifetime: number;
  longestLifetime: number;
  averageWaterPressure: number;
  camera: Point;
}

export interface CameraState {
  x: number;
  y: number;
}
