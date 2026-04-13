import type { BaseTraits, Bounds, CreatureIntent, CreatureNeed, CreatureState, Point, Sex, SpeciesKind } from '../types';
import { clamp } from './random';

export class Creature {
  public readonly id: string;
  public readonly species: SpeciesKind;
  public readonly sex: Sex;
  public position: Point;
  public readonly traits: BaseTraits;
  public state: CreatureState;
  public alive = true;
  public intent: CreatureIntent = 'wandering';
  public dominantNeed: CreatureNeed = 'hunger';
  public targetId: string | null = null;
  public heading = Math.random() * Math.PI * 2;
  public offspringCount = 0;
  public consumedUnits = 0;

  constructor(id: string, species: SpeciesKind, sex: Sex, position: Point, traits: BaseTraits) {
    this.id = id;
    this.species = species;
    this.sex = sex;
    this.position = position;
    this.traits = traits;
    this.state = {
      hunger: traits.hungerCapacity * 0.8,
      thirst: traits.thirstCapacity * 0.8,
      reproductionDrive: 0,
      age: 0,
    };
  }

  public getRadius = (): number => clamp(4 + this.traits.size * 2.4, 4, 17);

  public getSpeedPerSecond = (): number => 18 + this.traits.speed * 16;

  public getPerceptionRadius = (): number => 42 + this.traits.perception * 18;

  public getHungerRatio = (): number => this.state.hunger / this.traits.hungerCapacity;

  public getThirstRatio = (): number => this.state.thirst / this.traits.thirstCapacity;

  public getReproductionRatio = (): number => clamp(this.state.reproductionDrive, 0, 1);

  public moveToward = (target: Point, dt: number): number => {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.001) {
      this.position = { x: target.x, y: target.y };
      return 0;
    }

    this.heading = Math.atan2(dy, dx);
    const step = Math.min(distance, this.getSpeedPerSecond() * dt);
    this.position = {
      x: this.position.x + (dx / distance) * step,
      y: this.position.y + (dy / distance) * step,
    };
    return step;
  };

  public moveInDirection = (angle: number, dt: number, bounds: Bounds): number => {
    this.heading = angle;
    const step = this.getSpeedPerSecond() * dt;
    const x = clamp(this.position.x + Math.cos(angle) * step, 2, bounds.width - 2);
    const y = clamp(this.position.y + Math.sin(angle) * step, 2, bounds.height - 2);
    const movedDistance = Math.hypot(x - this.position.x, y - this.position.y);
    this.position = { x, y };
    return movedDistance;
  };

  public updateNeeds = (dt: number): void => {
    const hungerLoss = 0.34 + this.traits.size * 0.26 + this.traits.perception * 0.03;
    const thirstLoss = 0.34 + this.traits.speed * 0.24 + this.traits.perception * 0.03;
    const thirstMultiplier = this.getHungerRatio() < 0.18 ? 1.7 : 1;

    this.state.age += dt;
    this.state.hunger = clamp(this.state.hunger - dt * hungerLoss, 0, this.traits.hungerCapacity);
    this.state.thirst = clamp(this.state.thirst - dt * thirstLoss * thirstMultiplier * 1.4, 0, this.traits.thirstCapacity);
    this.state.reproductionDrive = clamp(this.state.reproductionDrive + dt * this.traits.reproductionRate * 0.06, 0, 1.4);

    if (this.state.thirst <= 0 || this.state.age >= this.traits.maxAge) {
      this.alive = false;
      this.intent = 'resting';
    }
  };

  public eat = (amount: number): void => {
    this.state.hunger = clamp(this.state.hunger + amount, 0, this.traits.hungerCapacity);
    this.consumedUnits += 1;
    this.intent = 'eating';
  };

  public drink = (): void => {
    this.state.thirst = this.traits.thirstCapacity;
    this.intent = 'drinking';
  };

  public completeReproduction = (): void => {
    this.state.reproductionDrive = 0.2;
    this.offspringCount += 1;
    this.intent = 'mating';
  };

  public distanceTo = (point: Point): number => Math.hypot(this.position.x - point.x, this.position.y - point.y);

  public canMateWith = (other: Creature): boolean => {
    return (
      this.alive &&
      other.alive &&
      this.species === other.species &&
      this.sex !== other.sex &&
      this.getReproductionRatio() >= 1 &&
      other.getReproductionRatio() >= 1
    );
  };
}
