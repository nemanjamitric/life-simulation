import type { CreatureNeed, PlantFood, Point, TerrainMap } from '../types';
import { Creature } from './creature';
import { clamp } from './random';
import { findNearestDrinkingPoint, isNearWater } from './terrain';

export const determineDominantNeed = (creature: Creature): CreatureNeed => {
  if (creature.getReproductionRatio() >= 1) {
    return 'reproduction';
  }

  if (creature.getThirstRatio() <= 0.38) {
    return 'thirst';
  }

  return 'hunger';
};

export const chooseMate = (creature: Creature, population: Creature[]): Creature | null => {
  const candidates = population.filter((other) => isVisibleMateCandidate(creature, other));

  candidates.sort((left, right) => {
    if (right.traits.size !== left.traits.size) {
      return right.traits.size - left.traits.size;
    }

    return creature.distanceTo(left.position) - creature.distanceTo(right.position);
  });

  return candidates[0] ?? null;
};

export const choosePlantTarget = (creature: Creature, plants: PlantFood[]): PlantFood | null => {
  const visible = plants.filter((plant) => !plant.consumed && creature.distanceTo(plant.position) <= creature.getPerceptionRadius());
  visible.sort((left, right) => creature.distanceTo(left.position) - creature.distanceTo(right.position));
  return visible[0] ?? null;
};

export const choosePreyTarget = (predator: Creature, preyPopulation: Creature[]): Creature | null => {
  const sensed = preyPopulation.filter((prey) => prey.alive && predator.distanceTo(prey.position) <= predator.getPerceptionRadius());
  if (sensed.length === 0) {
    return null;
  }

  const hungerPressure = 1 - predator.getHungerRatio();
  const thirstPressure = 1 - predator.getThirstRatio();
  let bestTarget: Creature | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const prey of sensed) {
    const score = scorePreyTarget(predator, prey, hungerPressure, thirstPressure);

    if (score > bestScore) {
      bestScore = score;
      bestTarget = prey;
    }
  }

  return bestTarget;
};

const sampleEscapeAngles = (count: number): number[] => {
  const angles: number[] = [];
  for (let index = 0; index < count; index += 1) {
    angles.push((Math.PI * 2 * index) / count);
  }

  return angles;
};

export const chooseEscapeTarget = (creature: Creature, predators: Creature[], terrain: TerrainMap): Point | null => {
  const nearbyPredators = predators.filter((predator) => predator.alive && creature.distanceTo(predator.position) <= creature.getPerceptionRadius());
  if (nearbyPredators.length === 0) {
    return null;
  }

  const distance = creature.getPerceptionRadius() * 0.7;
  let bestTarget: Point | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const angle of sampleEscapeAngles(16)) {
    const candidate = {
      x: clamp(creature.position.x + Math.cos(angle) * distance, 2, terrain.width - 2),
      y: clamp(creature.position.y + Math.sin(angle) * distance, 2, terrain.height - 2),
    };
    const score = scoreEscapeCandidate(creature, candidate, nearbyPredators, terrain);
    if (score > bestScore) {
      bestScore = score;
      bestTarget = candidate;
    }
  }

  return bestTarget;
};

export const chooseWaterTarget = (creature: Creature, terrain: TerrainMap, drinkDistance: number): Point | null => {
  if (isNearWater(terrain, creature.position, drinkDistance)) {
    return creature.position;
  }

  return findNearestDrinkingPoint(terrain, creature.position, creature.getPerceptionRadius() * 1.6, drinkDistance);
};

const isVisibleMateCandidate = (creature: Creature, other: Creature): boolean => {
  if (other.id === creature.id || !creature.canMateWith(other)) {
    return false;
  }

  return creature.distanceTo(other.position) <= creature.getPerceptionRadius();
};

const scorePreyTarget = (predator: Creature, prey: Creature, hungerPressure: number, thirstPressure: number): number => {
  const distance = Math.max(1, predator.distanceTo(prey.position));
  const closeness = 1 / distance;
  const slowerBonus = Math.max(0, predator.traits.speed - prey.traits.speed);
  const sizeBonus = prey.traits.size;

  return closeness * (120 + thirstPressure * 70) + slowerBonus * 6 + sizeBonus * (4 + hungerPressure * 7);
};

const scoreEscapeCandidate = (creature: Creature, candidate: Point, predators: Creature[], terrain: TerrainMap): number => {
  const movesTowardPredator = predators.some((predator) => {
    const currentDistance = creature.distanceTo(predator.position);
    const candidateDistance = Math.hypot(candidate.x - predator.position.x, candidate.y - predator.position.y);
    return candidateDistance < currentDistance;
  });

  if (movesTowardPredator) {
    return Number.NEGATIVE_INFINITY;
  }

  const dangerPenalty = predators.reduce(
    (sum, predator) => sum + 1 / Math.max(12, Math.hypot(candidate.x - predator.position.x, candidate.y - predator.position.y)),
    0,
  );
  const waterPenalty = isNearWater(terrain, candidate, terrain.cellSize * 0.65) ? 0.18 : 0;
  return -dangerPenalty - waterPenalty;
};
