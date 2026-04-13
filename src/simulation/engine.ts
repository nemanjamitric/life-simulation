import type {
  BaseTraits,
  Bounds,
  CameraState,
  CreatureSnapshot,
  PlantFood,
  Point,
  SimulationConfig,
  SimulationSummary,
  TerrainMap,
  TerrainType,
} from '../types';
import { Creature } from './creature';
import { chooseEscapeTarget, chooseMate, choosePlantTarget, choosePreyTarget, chooseWaterTarget, determineDominantNeed } from './behavior';
import { createCreature, inheritTraits } from './reproduction';
import { Random, average, clamp } from './random';
import { PopulationHistory } from './species';
import { createTerrain, isNearWater, isPassablePoint, randomPassablePoint } from './terrain';

interface EngineCallbacks {
  onTick: () => void;
}

const PLANT_RADIUS = 4;
const PREDATION_SIZE_RATIO = 1.1;
const MATE_DISTANCE = 14;

const normalizeTraits = (traits: BaseTraits): BaseTraits => ({
  speed: clamp(traits.speed, 0.3, 6),
  size: clamp(traits.size, 0.4, 5),
  perception: clamp(traits.perception, 0.4, 7),
  maxAge: clamp(traits.maxAge, 40, 1800),
  hungerCapacity: clamp(traits.hungerCapacity, 10, 300),
  thirstCapacity: clamp(traits.thirstCapacity, 10, 300),
  reproductionRate: clamp(traits.reproductionRate, 0.1, 5),
});

const clampCamera = (camera: CameraState, viewport: Bounds, world: Bounds): CameraState => ({
  x: clamp(camera.x, 0, Math.max(0, world.width - viewport.width)),
  y: clamp(camera.y, 0, Math.max(0, world.height - viewport.height)),
});

export class SimulationEngine {
  private readonly callbacks: EngineCallbacks;
  private readonly history = new PopulationHistory();
  private config: SimulationConfig | null = null;
  private terrain: TerrainMap | null = null;
  private predators: Creature[] = [];
  private prey: Creature[] = [];
  private plants: PlantFood[] = [];
  private births = 0;
  private deaths = 0;
  private tick = 0;
  private creatureSerial = 0;
  private plantSerial = 0;
  private running = false;
  private tickAccumulator = 0;
  private lastFrameTime = 0;
  private animationFrameId = 0;
  private random = new Random(1);
  private camera: CameraState = { x: 0, y: 0 };
  private totalLifetime = 0;
  private lifetimeSamples = 0;
  private longestLifetime = 0;

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  public reset = (config: SimulationConfig): void => {
    this.stop();
    this.config = {
      ...config,
      predator: {
        ...config.predator,
        initialCount: Math.max(1, Math.round(config.predator.initialCount)),
        variation: clamp(config.predator.variation, 0, 0.5),
        baseTraits: normalizeTraits(config.predator.baseTraits),
      },
      prey: {
        ...config.prey,
        initialCount: Math.max(2, Math.round(config.prey.initialCount)),
        variation: clamp(config.prey.variation, 0, 0.5),
        baseTraits: normalizeTraits(config.prey.baseTraits),
      },
      food: {
        ...config.food,
        initialCount: Math.max(1, Math.round(config.food.initialCount)),
        respawnPerTick: clamp(config.food.respawnPerTick, 0, 8),
      },
      mutation: {
        chance: clamp(config.mutation.chance, 0, 1),
        amount: clamp(config.mutation.amount, 0.01, 0.8),
      },
      terrain: {
        ...config.terrain,
        cellSize: Math.max(8, Math.round(config.terrain.cellSize)),
        drinkDistance: Math.max(6, Math.round(config.terrain.drinkDistance)),
        generator: {
          ...config.terrain.generator,
          scale: clamp(config.terrain.generator.scale, 1, 20),
          octaves: Math.max(1, Math.round(config.terrain.generator.octaves)),
          persistence: clamp(config.terrain.generator.persistence, 0.1, 0.95),
        },
      },
      world: {
        width: Math.max(config.viewport.width, Math.round(config.world.width)),
        height: Math.max(config.viewport.height, Math.round(config.world.height)),
      },
      viewport: {
        width: Math.max(320, Math.round(config.viewport.width)),
        height: Math.max(220, Math.round(config.viewport.height)),
      },
      timing: {
        tickSeconds: clamp(config.timing.tickSeconds, 0.01, 0.2),
        simulationSpeed: clamp(config.timing.simulationSpeed, 0.25, 6),
      },
    };

    this.random = new Random(this.config.terrain.generator.seed);
    this.terrain = createTerrain(this.config.world, this.config.terrain);
    this.predators = [];
    this.prey = [];
    this.plants = [];
    this.births = 0;
    this.deaths = 0;
    this.tick = 0;
    this.creatureSerial = 0;
    this.plantSerial = 0;
    this.history.reset();
    this.camera = clampCamera(
      {
        x: Math.max(0, (this.config.world.width - this.config.viewport.width) * 0.5),
        y: Math.max(0, (this.config.world.height - this.config.viewport.height) * 0.5),
      },
      this.config.viewport,
      this.config.world,
    );
    this.totalLifetime = 0;
    this.lifetimeSamples = 0;
    this.longestLifetime = 0;

    this.spawnInitialPopulation();
    this.ensurePlantPopulation(this.config.food.initialCount);
    this.recordSnapshot();
    this.callbacks.onTick();
  };

  public start = (): void => {
    if (this.running || !this.config) {
      return;
    }

    this.running = true;
    this.lastFrameTime = 0;
    this.tickAccumulator = 0;
    this.animationFrameId = requestAnimationFrame(this.frameLoop);
  };

  public stop = (): void => {
    this.running = false;
    if (this.animationFrameId !== 0) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  };

  public setCamera = (camera: CameraState): void => {
    if (!this.config) {
      return;
    }

    this.camera = clampCamera(camera, this.config.viewport, this.config.world);
    this.callbacks.onTick();
  };

  public panCamera = (dx: number, dy: number): void => {
    this.setCamera({ x: this.camera.x + dx, y: this.camera.y + dy });
  };

  public getCamera = (): CameraState => this.camera;

  public getTerrain = (): TerrainMap => {
    if (!this.terrain) {
      throw new Error('Terrain is not initialized.');
    }

    return this.terrain;
  };

  public getCreatures = (): Creature[] => [...this.prey, ...this.predators];

  public getPlants = (): PlantFood[] => this.plants;

  public getHistory = () => this.history.snapshots;

  public getConfig = (): SimulationConfig => {
    if (!this.config) {
      throw new Error('Simulation config is not initialized.');
    }

    return this.config;
  };

  public getSummary = (): SimulationSummary => {
    const creatures = this.getCreatures().filter((creature) => creature.alive);
    const averageWaterPressure = average(creatures.map((creature) => 1 - creature.getThirstRatio()));

    return {
      tick: this.tick,
      terrainModeLabel: this.config?.terrain.source === 'generated' ? 'Perlin teren' : `Predloga: ${this.config?.terrain.preset ?? ''}`,
      predatorCount: this.predators.filter((creature) => creature.alive).length,
      preyCount: this.prey.filter((creature) => creature.alive).length,
      plantCount: this.plants.filter((plant) => !plant.consumed).length,
      births: this.births,
      deaths: this.deaths,
      averageAge: average(creatures.map((creature) => creature.state.age)),
      averageLifetime: this.lifetimeSamples === 0 ? 0 : this.totalLifetime / this.lifetimeSamples,
      longestLifetime: this.longestLifetime,
      averageWaterPressure,
      camera: { ...this.camera },
    };
  };

  private frameLoop = (timestampMs: number): void => {
    if (!this.running || !this.config) {
      return;
    }

    if (this.lastFrameTime === 0) {
      this.lastFrameTime = timestampMs;
    }

    const deltaSeconds = (timestampMs - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestampMs;
    this.tickAccumulator += deltaSeconds * this.config.timing.simulationSpeed;

    while (this.tickAccumulator >= this.config.timing.tickSeconds) {
      this.updateTick(this.config.timing.tickSeconds);
      this.tickAccumulator -= this.config.timing.tickSeconds;
    }

    this.animationFrameId = requestAnimationFrame(this.frameLoop);
  };

  private spawnInitialPopulation = (): void => {
    if (!this.config || !this.terrain) {
      return;
    }

    for (let index = 0; index < this.config.prey.initialCount; index += 1) {
      this.prey.push(createCreature(this.nextCreatureId(), 'prey', randomPassablePoint(this.terrain, this.random.next), this.config.prey, this.random));
    }

    for (let index = 0; index < this.config.predator.initialCount; index += 1) {
      this.predators.push(
        createCreature(this.nextCreatureId(), 'predator', randomPassablePoint(this.terrain, this.random.next), this.config.predator, this.random),
      );
    }
  };

  private ensurePlantPopulation = (targetCount: number): void => {
    if (!this.config || !this.terrain) {
      return;
    }

    const activePlants = this.plants.filter((plant) => !plant.consumed).length;
    const missing = Math.max(0, targetCount - activePlants);
    for (let index = 0; index < missing; index += 1) {
      const position = this.randomPointOnAllowedTerrain(this.config.food.spawnTerrain);
      if (!position) {
        break;
      }

      this.plants.push({
        id: `plant-${this.plantSerial++}`,
        position,
        radius: PLANT_RADIUS + this.random.range(-1, 1),
        nutrition: this.config.food.energyGain,
        consumed: false,
      });
    }
  };

  private randomPointOnAllowedTerrain = (allowed: TerrainType[]): Point | null => {
    if (!this.terrain) {
      return null;
    }

    const cells = this.terrain.cells.filter((cell) => allowed.includes(cell.type));
    if (cells.length === 0) {
      return null;
    }

    const chosen = cells[Math.floor(this.random.next() * cells.length)];
    return {
      x: chosen.col * this.terrain.cellSize + this.terrain.cellSize * 0.5,
      y: chosen.row * this.terrain.cellSize + this.terrain.cellSize * 0.5,
    };
  }

  private updateTick = (dt: number): void => {
    if (!this.config || !this.terrain) {
      return;
    }

    this.tick += 1;
    this.births = 0;
    this.deaths = 0;

    for (const creature of this.prey) {
      this.updateCreature(creature, this.prey, this.predators, dt);
    }

    for (const creature of this.predators) {
      this.updateCreature(creature, this.predators, this.prey, dt);
    }

    this.removeDeadPopulation();
    this.ensurePlantPopulation(this.config.food.initialCount);
    this.spawnExtraPlants(this.config.food.respawnPerTick);

    this.recordSnapshot();
    this.callbacks.onTick();
  };

  private updateCreature = (creature: Creature, sameSpecies: Creature[], oppositeSpecies: Creature[], dt: number): void => {
    if (!this.config || !this.terrain || !creature.alive) {
      return;
    }

    creature.updateNeeds(dt);
    if (!creature.alive) {
      this.recordLifetime(creature.state.age);
      this.deaths += 1;
      return;
    }

    if (creature.species === 'prey') {
      const escapeTarget = chooseEscapeTarget(creature, this.predators, this.terrain);
      if (escapeTarget) {
        creature.intent = 'fleeing';
        this.moveCreature(creature, escapeTarget, dt, true);
        return;
      }
    }

    const need = determineDominantNeed(creature);
    creature.dominantNeed = need;

    switch (need) {
      case 'reproduction':
        this.handleReproduction(creature, sameSpecies, dt);
        break;
      case 'thirst':
        this.handleThirst(creature, dt);
        break;
      case 'hunger':
      default:
        this.handleHunger(creature, oppositeSpecies, dt);
        break;
    }
  };

  private handleReproduction = (creature: Creature, sameSpecies: Creature[], dt: number): void => {
    const mate = chooseMate(creature, sameSpecies);
    if (!mate) {
      creature.intent = 'wandering';
      this.wander(creature, dt);
      return;
    }

    creature.targetId = mate.id;
    creature.intent = 'seeking_mate';
    this.moveCreature(creature, mate.position, dt, true);

    if (creature.distanceTo(mate.position) <= MATE_DISTANCE) {
      this.tryCreateOffspring(creature, mate);
    }
  };

  private handleThirst = (creature: Creature, dt: number): void => {
    if (!this.terrain || !this.config) {
      return;
    }

    if (isNearWater(this.terrain, creature.position, this.config.terrain.drinkDistance)) {
      creature.drink();
      return;
    }

    const waterTarget = chooseWaterTarget(creature, this.terrain, this.config.terrain.drinkDistance);
    if (!waterTarget) {
      creature.intent = 'wandering';
      this.wander(creature, dt);
      return;
    }

    creature.intent = 'seeking_water';
    this.moveCreature(creature, waterTarget, dt, false);
  };

  private handleHunger = (creature: Creature, oppositeSpecies: Creature[], dt: number): void => {
    if (creature.species === 'prey') {
      const plant = choosePlantTarget(creature, this.plants);
      if (!plant) {
        creature.intent = 'wandering';
        this.wander(creature, dt);
        return;
      }

      creature.intent = 'seeking_food';
      creature.targetId = plant.id;
      this.moveCreature(creature, plant.position, dt, true);
      if (!plant.consumed && creature.distanceTo(plant.position) <= creature.getRadius() + plant.radius + 2) {
        plant.consumed = true;
        creature.eat(plant.nutrition);
      }
      return;
    }

    const preyTarget = choosePreyTarget(creature, oppositeSpecies);
    if (!preyTarget) {
      creature.intent = 'wandering';
      this.wander(creature, dt);
      return;
    }

    creature.intent = 'hunting';
    creature.targetId = preyTarget.id;
    this.moveCreature(creature, preyTarget.position, dt, true);

    if (
      preyTarget.alive &&
      creature.distanceTo(preyTarget.position) <= creature.getRadius() + preyTarget.getRadius() + 2 &&
      creature.traits.size >= preyTarget.traits.size * PREDATION_SIZE_RATIO
    ) {
      preyTarget.alive = false;
      this.recordLifetime(preyTarget.state.age);
      this.deaths += 1;
      creature.eat(preyTarget.traits.size * 14);
    }
  };

  private moveCreature = (creature: Creature, target: Point, dt: number, _allowCloseWater: boolean): void => {
    if (!this.terrain) {
      return;
    }

    const current = { ...creature.position };
    creature.moveToward(target, dt);

    if (!isPassablePoint(this.terrain, creature.position)) {
      creature.position = current;
      this.wander(creature, dt);
    }
  };

  private wander = (creature: Creature, dt: number): void => {
    if (!this.config || !this.terrain) {
      return;
    }

    creature.heading += this.random.range(-0.8, 0.8);
    const current = { ...creature.position };
    creature.moveInDirection(creature.heading, dt, this.config.world);
    if (!isPassablePoint(this.terrain, creature.position)) {
      creature.position = current;
      creature.heading += Math.PI * 0.5;
    }
  };

  private tryCreateOffspring = (parentA: Creature, parentB: Creature): void => {
    if (!this.config || !this.terrain || !parentA.canMateWith(parentB)) {
      return;
    }

    const speciesConfig = parentA.species === 'predator' ? this.config.predator : this.config.prey;
    const traits = inheritTraits(parentA, parentB, speciesConfig, this.config.mutation, this.random);
    const child = new Creature(
      this.nextCreatureId(),
      parentA.species,
      this.random.next() < 0.5 ? 'female' : 'male',
      randomPassablePoint(this.terrain, this.random.next),
      traits,
    );

    if (parentA.species === 'predator') {
      this.predators.push(child);
    } else {
      this.prey.push(child);
    }

    parentA.completeReproduction();
    parentB.completeReproduction();
    this.births += 1;
  };

  private removeDeadPopulation = (): void => {
    this.predators = this.predators.filter((creature) => creature.alive);
    this.prey = this.prey.filter((creature) => creature.alive);
    this.plants = this.plants.filter((plant) => !plant.consumed);
  };

  private spawnExtraPlants = (amount: number): void => {
    if (!this.config || amount <= 0) {
      return;
    }

    const whole = Math.floor(amount);
    const extra = this.random.next() < amount - whole ? 1 : 0;
    const count = whole + extra;

    for (let index = 0; index < count; index += 1) {
      const position = this.randomPointOnAllowedTerrain(this.config.food.spawnTerrain);
      if (!position) {
        return;
      }

      this.plants.push({
        id: `plant-${this.plantSerial++}`,
        position,
        radius: PLANT_RADIUS + this.random.range(-1, 1),
        nutrition: this.config.food.energyGain,
        consumed: false,
      });
    }
  };

  private recordSnapshot = (): void => {
    const creatures: CreatureSnapshot[] = this.getCreatures().map((creature) => ({
      id: creature.id,
      species: creature.species,
      sex: creature.sex,
      position: { ...creature.position },
      traits: { ...creature.traits },
      state: { ...creature.state },
      alive: creature.alive,
      intent: creature.intent,
    }));

    this.history.record(
      this.tick,
      creatures,
      this.plants.filter((plant) => !plant.consumed).length,
      this.births,
      this.deaths,
      this.lifetimeSamples === 0 ? 0 : this.totalLifetime / this.lifetimeSamples,
      this.longestLifetime,
    );
  };

  private nextCreatureId = (): string => `creature-${this.creatureSerial++}`;

  private recordLifetime = (age: number): void => {
    this.totalLifetime += age;
    this.lifetimeSamples += 1;
    this.longestLifetime = Math.max(this.longestLifetime, age);
  };
}
