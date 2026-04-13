import type { BaseTraits, MutationConfig, Point, Sex, SpeciesConfig, SpeciesKind } from '../types';
import { Creature } from './creature';
import { Random, clamp } from './random';

const TRAIT_KEYS: Array<keyof BaseTraits> = [
  'speed',
  'size',
  'perception',
  'maxAge',
  'hungerCapacity',
  'thirstCapacity',
  'reproductionRate',
];

export const varyTraits = (traits: BaseTraits, variation: number, random: Random): BaseTraits => {
  const nextTraits = { ...traits };

  for (const key of TRAIT_KEYS) {
    const delta = random.range(-variation, variation);
    nextTraits[key] = clamp(traits[key] * (1 + delta), 0.1, Number.POSITIVE_INFINITY);
  }

  return nextTraits;
};

export const inheritTraits = (
  parentA: Creature,
  parentB: Creature,
  speciesConfig: SpeciesConfig,
  mutation: MutationConfig,
  random: Random,
): BaseTraits => {
  const inherited = { ...speciesConfig.baseTraits };

  for (const key of TRAIT_KEYS) {
    const inheritedBase = random.next() < 0.5 ? parentA.traits[key] : parentB.traits[key];
    const variance = inheritedBase * random.range(-speciesConfig.variation, speciesConfig.variation);
    let value = inheritedBase + variance;

    if (random.next() <= mutation.chance) {
      value *= 1 + random.range(-mutation.amount, mutation.amount);
    }

    inherited[key] = clamp(value, 0.1, Number.POSITIVE_INFINITY);
  }

  return inherited;
};

export const createCreature = (
  id: string,
  species: SpeciesKind,
  position: Point,
  config: SpeciesConfig,
  random: Random,
): Creature => {
  const traits = varyTraits(config.baseTraits, config.variation, random);
  const sex: Sex = random.next() < 0.5 ? 'female' : 'male';
  return new Creature(id, species, sex, position, traits);
};
