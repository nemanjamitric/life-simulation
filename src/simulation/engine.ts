import type {
  CameraState,
  CreatureSnapshot,
  PlantFood,
  SimulationConfig,
  SimulationSummary,
  TerrainMap,
} from '../types';
import { Creature } from './creature';
import { clampCameraToWorld, normalizeSimulationConfig } from './configNormalizer';
import { PopulationManager } from './populationManager';
import { Random, average } from './random';
import { PopulationHistory } from './species';
import { createTerrain } from './terrain';
import { SimulationTickCoordinator } from './tickCoordinator';

interface EngineCallbacks {
  onTick: () => void;
}

export class SimulationEngine {
  private readonly callbacks: EngineCallbacks;
  private readonly history = new PopulationHistory();
  private readonly population = new PopulationManager();
  private config: SimulationConfig | null = null;
  private terrain: TerrainMap | null = null;
  private births = 0;
  private deaths = 0;
  private tick = 0;
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
    this.config = normalizeSimulationConfig(config);

    this.random = new Random(this.config.terrain.generator.seed);
    this.terrain = createTerrain(this.config.world, this.config.terrain);
    this.births = 0;
    this.deaths = 0;
    this.tick = 0;
    this.history.reset();
    this.camera = clampCameraToWorld(
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

    this.population.reset(this.config, this.terrain, this.random);
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

    this.camera = clampCameraToWorld(camera, this.config.viewport, this.config.world);
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

  public getCreatures = (): Creature[] => this.population.getCreatures();

  public getPlants = (): PlantFood[] => this.population.plants;

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
      predatorCount: this.population.predators.filter((creature) => creature.alive).length,
      preyCount: this.population.prey.filter((creature) => creature.alive).length,
      plantCount: this.population.plants.filter((plant) => !plant.consumed).length,
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

  private updateTick = (dt: number): void => {
    if (!this.config || !this.terrain) {
      return;
    }

    this.tick += 1;
    const tickCoordinator = new SimulationTickCoordinator({
      config: this.config,
      terrain: this.terrain,
      population: this.population,
      random: this.random,
      recordLifetime: this.recordLifetime,
    });
    const result = tickCoordinator.runTick(dt);
    this.births = result.births;
    this.deaths = result.deaths;

    this.recordSnapshot();
    this.callbacks.onTick();
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
      this.population.plants.filter((plant) => !plant.consumed).length,
      this.births,
      this.deaths,
      this.lifetimeSamples === 0 ? 0 : this.totalLifetime / this.lifetimeSamples,
      this.longestLifetime,
    );
  };

  private recordLifetime = (age: number): void => {
    this.totalLifetime += age;
    this.lifetimeSamples += 1;
    this.longestLifetime = Math.max(this.longestLifetime, age);
  };
}
