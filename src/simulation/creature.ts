import type { BaseTraits, Bounds, CreatureIntent, CreatureNeed, CreatureState, Point, Sex, SpeciesKind } from '../types';
import { clamp } from './random';
import { applyNeedDelta, createInitialCreatureState } from './creatureNeeds';

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
  public mealsConsumed = 0;

  constructor(id: string, species: SpeciesKind, sex: Sex, position: Point, traits: BaseTraits) {
    this.id = id;
    this.species = species;
    this.sex = sex;
    this.position = position;
    this.traits = traits;
    this.state = createInitialCreatureState(traits);
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
    this.state = applyNeedDelta(this.state, this.traits, this.getHungerRatio(), dt);

    if (this.state.thirst <= 0 || this.state.age >= this.traits.maxAge) {
      this.kill();
    }
  };

  public eat = (amount: number): void => {
    this.state.hunger = clamp(this.state.hunger + amount, 0, this.traits.hungerCapacity);
    this.mealsConsumed += 1;
    this.setIntent('eating');
  };

  public drink = (): void => {
    this.state.thirst = this.traits.thirstCapacity;
    this.clearTarget();
    this.setIntent('drinking');
  };

  public completeReproduction = (): void => {
    this.state.reproductionDrive = 0.2;
    this.offspringCount += 1;
    this.clearTarget();
    this.setIntent('mating');
  };

  public distanceTo = (point: Point): number => Math.hypot(this.position.x - point.x, this.position.y - point.y);

  public setIntent = (intent: CreatureIntent): void => {
    this.intent = intent;
  };

  public setTarget = (targetId: string): void => {
    this.targetId = targetId;
  };

  public clearTarget = (): void => {
    this.targetId = null;
  };

  public kill = (): void => {
    this.alive = false;
    this.clearTarget();
    this.setIntent('resting');
  };

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
