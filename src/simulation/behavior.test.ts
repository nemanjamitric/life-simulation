import { describe, expect, test } from 'vitest';
import type { BaseTraits } from '../types';
import { chooseEscapeTarget, chooseMate, choosePreyTarget, determineDominantNeed } from './behavior';
import { Creature } from './creature';
import { createTerrain } from './terrain';

const makeTraits = (overrides: Partial<BaseTraits> = {}): BaseTraits => ({
  speed: 2,
  size: 1.5,
  perception: 2,
  maxAge: 400,
  hungerCapacity: 80,
  thirstCapacity: 80,
  reproductionRate: 2,
  ...overrides,
});

describe('behavior rules', () => {
  test('need priority is reproduction over thirst over hunger', () => {
    const creature = new Creature('a', 'prey', 'female', { x: 40, y: 40 }, makeTraits());
    creature.state.reproductionDrive = 1.1;
    creature.state.thirst = 5;
    creature.state.hunger = 1;
    expect(determineDominantNeed(creature)).toBe('reproduction');

    creature.state.reproductionDrive = 0.3;
    expect(determineDominantNeed(creature)).toBe('thirst');

    creature.state.thirst = 40;
    expect(determineDominantNeed(creature)).toBe('hunger');
  });

  test('hunger depletion increases thirst loss', () => {
    const creature = new Creature('a', 'prey', 'female', { x: 0, y: 0 }, makeTraits({ hungerCapacity: 100, thirstCapacity: 100 }));
    const wellFed = new Creature('b', 'prey', 'female', { x: 0, y: 0 }, makeTraits({ hungerCapacity: 100, thirstCapacity: 100 }));

    creature.state.hunger = 5;
    wellFed.state.hunger = 90;
    creature.updateNeeds(1);
    wellFed.updateNeeds(1);

    expect(creature.state.thirst).toBeLessThan(wellFed.state.thirst);
  });

  test('mate selection prefers larger viable partner', () => {
    const subject = new Creature('self', 'prey', 'female', { x: 10, y: 10 }, makeTraits());
    subject.state.reproductionDrive = 1.1;
    const smaller = new Creature('small', 'prey', 'male', { x: 12, y: 10 }, makeTraits({ size: 1.2 }));
    const larger = new Creature('large', 'prey', 'male', { x: 16, y: 10 }, makeTraits({ size: 2.3 }));
    smaller.state.reproductionDrive = 1.1;
    larger.state.reproductionDrive = 1.1;

    expect(chooseMate(subject, [subject, smaller, larger])?.id).toBe('large');
  });

  test('same sex creatures cannot reproduce with each other', () => {
    const subject = new Creature('self', 'prey', 'female', { x: 10, y: 10 }, makeTraits());
    const candidate = new Creature('candidate', 'prey', 'female', { x: 12, y: 10 }, makeTraits({ size: 2.2 }));
    subject.state.reproductionDrive = 1.1;
    candidate.state.reproductionDrive = 1.1;

    expect(chooseMate(subject, [subject, candidate])).toBeNull();
  });

  test('predator prefers closer slower larger prey', () => {
    const predator = new Creature('pred', 'predator', 'male', { x: 40, y: 40 }, makeTraits({ speed: 2.8, size: 2.5 }));
    const nearSlowLarge = new Creature('best', 'prey', 'female', { x: 55, y: 40 }, makeTraits({ speed: 1.4, size: 1.8 }));
    const farFastSmall = new Creature('worst', 'prey', 'female', { x: 110, y: 40 }, makeTraits({ speed: 2.6, size: 1 }));

    expect(choosePreyTarget(predator, [nearSlowLarge, farFastSmall])?.id).toBe('best');
  });

  test('prey escape avoids moving toward predator cluster', () => {
    const terrain = createTerrain(
      { width: 300, height: 220 },
      {
        source: 'generated',
        preset: 'river',
        cellSize: 12,
        drinkDistance: 18,
        generator: { seed: 2, scale: 4.5, octaves: 4, persistence: 0.5 },
      },
    );
    const prey = new Creature('prey', 'prey', 'female', { x: 120, y: 120 }, makeTraits({ perception: 3 }));
    const predatorA = new Creature('pred-a', 'predator', 'male', { x: 150, y: 120 }, makeTraits());
    const predatorB = new Creature('pred-b', 'predator', 'male', { x: 160, y: 132 }, makeTraits());

    const escapeTarget = chooseEscapeTarget(prey, [predatorA, predatorB], terrain);
    expect(escapeTarget).toBeTruthy();
    expect((escapeTarget?.x ?? 999) < prey.position.x).toBe(true);
  });
});
