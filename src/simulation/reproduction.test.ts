import { describe, expect, test } from 'vitest';
import type { MutationConfig, SpeciesConfig } from '../types';
import { Creature } from './creature';
import { inheritTraits } from './reproduction';
import { Random } from './random';

const speciesConfig: SpeciesConfig = {
  initialCount: 8,
  variation: 0.1,
  baseTraits: {
    speed: 2,
    size: 1.5,
    perception: 2.2,
    maxAge: 450,
    hungerCapacity: 90,
    thirstCapacity: 84,
    reproductionRate: 1.7,
  },
};

const mutation: MutationConfig = {
  chance: 0.1,
  amount: 0.2,
};

describe('inheritance and mutation', () => {
  test('offspring inherits each trait from one parent before variation', () => {
    const exactSpeciesConfig = {
      ...speciesConfig,
      variation: 0,
    };
    const noMutation = {
      chance: 0,
      amount: 0.2,
    };
    const parentA = new Creature('a', 'prey', 'female', { x: 0, y: 0 }, { ...speciesConfig.baseTraits, speed: 3, size: 1.8 });
    const parentB = new Creature('b', 'prey', 'male', { x: 0, y: 0 }, { ...speciesConfig.baseTraits, speed: 1.5, size: 1.2 });

    const child = inheritTraits(parentA, parentB, exactSpeciesConfig, noMutation, new Random(3));

    expect([parentA.traits.speed, parentB.traits.speed]).toContain(child.speed);
    expect([parentA.traits.size, parentB.traits.size]).toContain(child.size);
  });

  test('offspring traits trend between parent values', () => {
    const parentA = new Creature('a', 'prey', 'female', { x: 0, y: 0 }, { ...speciesConfig.baseTraits, speed: 3, size: 1.8 });
    const parentB = new Creature('b', 'prey', 'male', { x: 0, y: 0 }, { ...speciesConfig.baseTraits, speed: 1.5, size: 1.2 });

    const child = inheritTraits(parentA, parentB, speciesConfig, mutation, new Random(10));

    expect(child.speed).toBeGreaterThan(1.2);
    expect(child.speed).toBeLessThan(3.4);
    expect(child.size).toBeGreaterThan(1);
    expect(child.size).toBeLessThan(2);
  });

  test('high mutation settings noticeably change traits', () => {
    const parentA = new Creature('a', 'predator', 'female', { x: 0, y: 0 }, speciesConfig.baseTraits);
    const parentB = new Creature('b', 'predator', 'male', { x: 0, y: 0 }, speciesConfig.baseTraits);

    const mutated = inheritTraits(
      parentA,
      parentB,
      speciesConfig,
      { chance: 1, amount: 0.2 },
      new Random(1),
    );

    const differences = Object.keys(mutated).filter((key) => {
      const typedKey = key as keyof typeof mutated;
      return mutated[typedKey] !== speciesConfig.baseTraits[typedKey];
    });

    expect(differences.length).toBeGreaterThan(0);
  });
});
