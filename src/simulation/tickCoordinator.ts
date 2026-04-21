import type { Point, SimulationConfig, TerrainMap } from '../types';
import { chooseEscapeTarget, chooseMate, choosePlantTarget, choosePreyTarget, chooseWaterTarget, determineDominantNeed } from './behavior';
import { Creature } from './creature';
import { PopulationManager } from './populationManager';
import { Random } from './random';
import { inheritTraits } from './reproduction';
import { isNearWater, isPassablePoint } from './terrain';

const PREDATION_SIZE_RATIO = 1.1;
const MATE_DISTANCE = 14;
const WANDER_ANGLE_VARIATION = 0.8;
const WATER_COLLISION_TURN = Math.PI * 0.5;
const EAT_DISTANCE_PADDING = 2;

interface TickCoordinatorDependencies {
  config: SimulationConfig;
  terrain: TerrainMap;
  population: PopulationManager;
  random: Random;
  recordLifetime: (age: number) => void;
}

export interface TickResult {
  births: number;
  deaths: number;
}

export class SimulationTickCoordinator {
  private readonly config: SimulationConfig;
  private readonly terrain: TerrainMap;
  private readonly population: PopulationManager;
  private readonly random: Random;
  private readonly recordLifetime: (age: number) => void;

  constructor(dependencies: TickCoordinatorDependencies) {
    this.config = dependencies.config;
    this.terrain = dependencies.terrain;
    this.population = dependencies.population;
    this.random = dependencies.random;
    this.recordLifetime = dependencies.recordLifetime;
  }

  public runTick = (dt: number): TickResult => {
    const counters: TickResult = { births: 0, deaths: 0 };

    for (const creature of this.population.prey) {
      this.resolvePreyTurn(creature, counters, dt);
    }

    for (const creature of this.population.predators) {
      this.resolvePredatorTurn(creature, counters, dt);
    }

    this.population.removeInactiveEntities();
    this.population.ensurePlantPopulation(this.config.food.initialCount);
    this.population.spawnExtraPlants(this.config.food.respawnPerTick);

    return counters;
  };

  private resolvePreyTurn = (creature: Creature, counters: TickResult, dt: number): void => {
    if (!this.prepareCreatureTurn(creature, counters, dt)) {
      return;
    }

    const escapeTarget = chooseEscapeTarget(creature, this.population.predators, this.terrain);
    if (escapeTarget) {
      creature.setIntent('fleeing');
      this.moveCreature(creature, escapeTarget, dt);
      return;
    }

    this.resolveNeedDrivenTurn(creature, this.population.prey, this.population.predators, counters, dt);
  };

  private resolvePredatorTurn = (creature: Creature, counters: TickResult, dt: number): void => {
    if (!this.prepareCreatureTurn(creature, counters, dt)) {
      return;
    }

    this.resolveNeedDrivenTurn(creature, this.population.predators, this.population.prey, counters, dt);
  };

  private prepareCreatureTurn = (creature: Creature, counters: TickResult, dt: number): boolean => {
    if (!creature.alive) {
      return false;
    }

    creature.updateNeeds(dt);
    if (creature.alive) {
      return true;
    }

    this.recordLifetime(creature.state.age);
    counters.deaths += 1;
    return false;
  };

  private resolveNeedDrivenTurn = (
    creature: Creature,
    sameSpecies: Creature[],
    oppositeSpecies: Creature[],
    counters: TickResult,
    dt: number,
  ): void => {
    const dominantNeed = determineDominantNeed(creature);
    creature.dominantNeed = dominantNeed;

    if (dominantNeed === 'reproduction') {
      this.resolveReproduction(creature, sameSpecies, counters, dt);
      return;
    }

    if (dominantNeed === 'thirst') {
      this.resolveThirst(creature, dt);
      return;
    }

    if (creature.species === 'prey') {
      this.resolvePreyHunger(creature, dt);
      return;
    }

    this.resolvePredatorHunger(creature, oppositeSpecies, counters, dt);
  };

  private resolveReproduction = (creature: Creature, sameSpecies: Creature[], counters: TickResult, dt: number): void => {
    const mate = chooseMate(creature, sameSpecies);
    if (!mate) {
      this.wander(creature, dt);
      return;
    }

    creature.setTarget(mate.id);
    creature.setIntent('seeking_mate');
    this.moveCreature(creature, mate.position, dt);

    if (creature.distanceTo(mate.position) > MATE_DISTANCE) {
      return;
    }

    if (!creature.canMateWith(mate)) {
      return;
    }

    const speciesConfig = creature.species === 'predator' ? this.config.predator : this.config.prey;
    const traits = inheritTraits(creature, mate, speciesConfig, this.config.mutation, this.random);
    this.population.spawnOffspring(creature.species, traits);
    creature.completeReproduction();
    mate.completeReproduction();
    counters.births += 1;
  };

  private resolveThirst = (creature: Creature, dt: number): void => {
    if (isNearWater(this.terrain, creature.position, this.config.terrain.drinkDistance)) {
      creature.drink();
      return;
    }

    const waterTarget = chooseWaterTarget(creature, this.terrain, this.config.terrain.drinkDistance);
    if (!waterTarget) {
      this.wander(creature, dt);
      return;
    }

    creature.clearTarget();
    creature.setIntent('seeking_water');
    this.moveCreature(creature, waterTarget, dt);
  };

  private resolvePreyHunger = (creature: Creature, dt: number): void => {
    const plant = choosePlantTarget(creature, this.population.plants);
    if (!plant) {
      this.wander(creature, dt);
      return;
    }

    creature.setIntent('seeking_food');
    creature.setTarget(plant.id);
    this.moveCreature(creature, plant.position, dt);

    if (plant.consumed) {
      return;
    }

    if (creature.distanceTo(plant.position) > creature.getRadius() + plant.radius + EAT_DISTANCE_PADDING) {
      return;
    }

    plant.consumed = true;
    creature.eat(plant.nutrition);
  };

  private resolvePredatorHunger = (
    creature: Creature,
    preyPopulation: Creature[],
    counters: TickResult,
    dt: number,
  ): void => {
    const preyTarget = choosePreyTarget(creature, preyPopulation);
    if (!preyTarget) {
      this.wander(creature, dt);
      return;
    }

    creature.setIntent('hunting');
    creature.setTarget(preyTarget.id);
    this.moveCreature(creature, preyTarget.position, dt);

    const isCloseEnough = creature.distanceTo(preyTarget.position) <= creature.getRadius() + preyTarget.getRadius() + EAT_DISTANCE_PADDING;
    const isLargeEnough = creature.traits.size >= preyTarget.traits.size * PREDATION_SIZE_RATIO;
    if (!preyTarget.alive || !isCloseEnough || !isLargeEnough) {
      return;
    }

    preyTarget.kill();
    this.recordLifetime(preyTarget.state.age);
    counters.deaths += 1;
    creature.eat(preyTarget.traits.size * 14);
  };

  private moveCreature = (creature: Creature, target: Point, dt: number): void => {
    const currentPosition = { ...creature.position };
    creature.moveToward(target, dt);

    if (isPassablePoint(this.terrain, creature.position)) {
      return;
    }

    creature.position = currentPosition;
    this.wander(creature, dt);
  };

  private wander = (creature: Creature, dt: number): void => {
    creature.clearTarget();
    creature.setIntent('wandering');
    creature.heading += this.random.range(-WANDER_ANGLE_VARIATION, WANDER_ANGLE_VARIATION);
    const currentPosition = { ...creature.position };
    creature.moveInDirection(creature.heading, dt, this.config.world);

    if (isPassablePoint(this.terrain, creature.position)) {
      return;
    }

    creature.position = currentPosition;
    creature.heading += WATER_COLLISION_TURN;
  };
}
