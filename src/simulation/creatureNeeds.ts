import type { BaseTraits, CreatureState } from '../types';
import { clamp } from './random';

const INITIAL_NEED_RATIO = 0.8;
const STARVATION_THIRST_MULTIPLIER = 1.7;
const THIRST_DRAIN_BOOST = 1.4;
const REPRODUCTION_GROWTH_RATE = 0.06;
const LOW_HUNGER_THRESHOLD = 0.18;

const hungerDrainPerSecond = (traits: BaseTraits): number => 0.34 + traits.size * 0.26 + traits.perception * 0.03;

const thirstDrainPerSecond = (traits: BaseTraits): number => 0.34 + traits.speed * 0.24 + traits.perception * 0.03;

export const createInitialCreatureState = (traits: BaseTraits): CreatureState => ({
  hunger: traits.hungerCapacity * INITIAL_NEED_RATIO,
  thirst: traits.thirstCapacity * INITIAL_NEED_RATIO,
  reproductionDrive: 0,
  age: 0,
});

export const applyNeedDelta = (state: CreatureState, traits: BaseTraits, hungerRatio: number, dt: number): CreatureState => {
  const thirstMultiplier = hungerRatio < LOW_HUNGER_THRESHOLD ? STARVATION_THIRST_MULTIPLIER : 1;

  return {
    age: state.age + dt,
    hunger: clamp(state.hunger - dt * hungerDrainPerSecond(traits), 0, traits.hungerCapacity),
    thirst: clamp(
      state.thirst - dt * thirstDrainPerSecond(traits) * thirstMultiplier * THIRST_DRAIN_BOOST,
      0,
      traits.thirstCapacity,
    ),
    reproductionDrive: clamp(state.reproductionDrive + dt * traits.reproductionRate * REPRODUCTION_GROWTH_RATE, 0, 1.4),
  };
};
