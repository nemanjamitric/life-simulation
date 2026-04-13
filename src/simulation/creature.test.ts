import { describe, expect, test } from 'vitest';
import { Creature } from './creature';

const makeTraits = (overrides: Partial<ConstructorParameters<typeof Creature>[4]> = {}) => ({
  speed: 2,
  size: 1.5,
  perception: 2,
  maxAge: 20,
  hungerCapacity: 100,
  thirstCapacity: 100,
  reproductionRate: 1.5,
  ...overrides,
});

describe('creature needs', () => {
  test('dehydration causes death', () => {
    const creature = new Creature('a', 'prey', 'female', { x: 0, y: 0 }, makeTraits({ thirstCapacity: 1, speed: 5 }));
    creature.state.thirst = 0.05;
    creature.updateNeeds(1);

    expect(creature.alive).toBe(false);
  });

  test('higher speed increases thirst drain more than hunger drain', () => {
    const slow = new Creature('slow', 'prey', 'female', { x: 0, y: 0 }, makeTraits({ speed: 1, size: 1.5 }));
    const fast = new Creature('fast', 'prey', 'female', { x: 0, y: 0 }, makeTraits({ speed: 4, size: 1.5 }));

    slow.updateNeeds(1);
    fast.updateNeeds(1);

    expect(fast.state.thirst).toBeLessThan(slow.state.thirst);
    expect(fast.state.hunger).toBeCloseTo(slow.state.hunger, 5);
  });

  test('larger size increases hunger drain more than thirst drain', () => {
    const small = new Creature('small', 'prey', 'female', { x: 0, y: 0 }, makeTraits({ speed: 2, size: 1 }));
    const large = new Creature('large', 'prey', 'female', { x: 0, y: 0 }, makeTraits({ speed: 2, size: 3 }));

    small.updateNeeds(1);
    large.updateNeeds(1);

    expect(large.state.hunger).toBeLessThan(small.state.hunger);
    expect(large.state.thirst).toBeCloseTo(small.state.thirst, 5);
  });
});
