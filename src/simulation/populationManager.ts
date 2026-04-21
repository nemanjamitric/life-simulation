import type { BaseTraits, PlantFood, Point, SimulationConfig, TerrainMap, TerrainType } from '../types';
import { Creature } from './creature';
import { createCreature } from './reproduction';
import { Random } from './random';
import { randomPassablePoint } from './terrain';

const PLANT_RADIUS = 4;

export class PopulationManager {
  public predators: Creature[] = [];
  public prey: Creature[] = [];
  public plants: PlantFood[] = [];

  private creatureSerial = 0;
  private plantSerial = 0;
  private config: SimulationConfig | null = null;
  private terrain: TerrainMap | null = null;
  private random: Random | null = null;

  public reset = (config: SimulationConfig, terrain: TerrainMap, random: Random): void => {
    this.config = config;
    this.terrain = terrain;
    this.random = random;
    this.predators = [];
    this.prey = [];
    this.plants = [];
    this.creatureSerial = 0;
    this.plantSerial = 0;
    this.spawnInitialPopulation();
    this.ensurePlantPopulation(config.food.initialCount);
  };

  public getCreatures = (): Creature[] => [...this.prey, ...this.predators];

  public spawnOffspring = (species: Creature['species'], traits: BaseTraits): Creature => {
    const terrain = this.requireTerrain();
    const random = this.requireRandom();
    const child = new Creature(
      this.nextCreatureId(),
      species,
      random.next() < 0.5 ? 'female' : 'male',
      randomPassablePoint(terrain, random.next),
      traits,
    );

    if (species === 'predator') {
      this.predators.push(child);
    } else {
      this.prey.push(child);
    }

    return child;
  };

  public ensurePlantPopulation = (targetCount: number): void => {
    const config = this.requireConfig();
    const activePlantCount = this.plants.filter((plant) => !plant.consumed).length;
    const missingPlantCount = Math.max(0, targetCount - activePlantCount);

    for (let index = 0; index < missingPlantCount; index += 1) {
      this.spawnPlantOnAllowedTerrain(config.food.spawnTerrain);
    }
  };

  public spawnExtraPlants = (amount: number): void => {
    if (amount <= 0) {
      return;
    }

    const random = this.requireRandom();
    const wholePlantCount = Math.floor(amount);
    const extraPlantCount = random.next() < amount - wholePlantCount ? 1 : 0;
    const spawnCount = wholePlantCount + extraPlantCount;

    for (let index = 0; index < spawnCount; index += 1) {
      if (!this.spawnPlantOnAllowedTerrain(this.requireConfig().food.spawnTerrain)) {
        return;
      }
    }
  };

  public removeInactiveEntities = (): void => {
    this.predators = this.predators.filter((creature) => creature.alive);
    this.prey = this.prey.filter((creature) => creature.alive);
    this.plants = this.plants.filter((plant) => !plant.consumed);
  };

  private spawnInitialPopulation = (): void => {
    const config = this.requireConfig();
    const terrain = this.requireTerrain();
    const random = this.requireRandom();

    for (let index = 0; index < config.prey.initialCount; index += 1) {
      this.prey.push(createCreature(this.nextCreatureId(), 'prey', randomPassablePoint(terrain, random.next), config.prey, random));
    }

    for (let index = 0; index < config.predator.initialCount; index += 1) {
      this.predators.push(
        createCreature(this.nextCreatureId(), 'predator', randomPassablePoint(terrain, random.next), config.predator, random),
      );
    }
  };

  private spawnPlantOnAllowedTerrain = (allowedTerrain: TerrainType[]): boolean => {
    const config = this.requireConfig();
    const random = this.requireRandom();
    const position = this.randomPointOnAllowedTerrain(allowedTerrain);
    if (!position) {
      return false;
    }

    this.plants.push({
      id: `plant-${this.plantSerial++}`,
      position,
      radius: PLANT_RADIUS + random.range(-1, 1),
      nutrition: config.food.energyGain,
      consumed: false,
    });

    return true;
  };

  private randomPointOnAllowedTerrain = (allowedTerrain: TerrainType[]): Point | null => {
    const terrain = this.requireTerrain();
    const random = this.requireRandom();
    const allowedCells = terrain.cells.filter((cell) => allowedTerrain.includes(cell.type));
    if (allowedCells.length === 0) {
      return null;
    }

    const chosenCell = allowedCells[Math.floor(random.next() * allowedCells.length)];
    return {
      x: chosenCell.col * terrain.cellSize + terrain.cellSize * 0.5,
      y: chosenCell.row * terrain.cellSize + terrain.cellSize * 0.5,
    };
  };

  private nextCreatureId = (): string => `creature-${this.creatureSerial++}`;

  private requireConfig = (): SimulationConfig => {
    if (!this.config) {
      throw new Error('Population config is not initialized.');
    }

    return this.config;
  };

  private requireTerrain = (): TerrainMap => {
    if (!this.terrain) {
      throw new Error('Population terrain is not initialized.');
    }

    return this.terrain;
  };

  private requireRandom = (): Random => {
    if (!this.random) {
      throw new Error('Population random source is not initialized.');
    }

    return this.random;
  };
}
