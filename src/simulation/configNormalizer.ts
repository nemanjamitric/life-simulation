import type { BaseTraits, Bounds, CameraState, SimulationConfig } from '../types';
import { clamp } from './random';

const TRAIT_LIMITS = {
  speed: { min: 0.3, max: 6 },
  size: { min: 0.4, max: 5 },
  perception: { min: 0.4, max: 7 },
  maxAge: { min: 40, max: 1800 },
  hungerCapacity: { min: 10, max: 300 },
  thirstCapacity: { min: 10, max: 300 },
  reproductionRate: { min: 0.1, max: 5 },
} as const;

export const normalizeTraits = (traits: BaseTraits): BaseTraits => ({
  speed: clamp(traits.speed, TRAIT_LIMITS.speed.min, TRAIT_LIMITS.speed.max),
  size: clamp(traits.size, TRAIT_LIMITS.size.min, TRAIT_LIMITS.size.max),
  perception: clamp(traits.perception, TRAIT_LIMITS.perception.min, TRAIT_LIMITS.perception.max),
  maxAge: clamp(traits.maxAge, TRAIT_LIMITS.maxAge.min, TRAIT_LIMITS.maxAge.max),
  hungerCapacity: clamp(traits.hungerCapacity, TRAIT_LIMITS.hungerCapacity.min, TRAIT_LIMITS.hungerCapacity.max),
  thirstCapacity: clamp(traits.thirstCapacity, TRAIT_LIMITS.thirstCapacity.min, TRAIT_LIMITS.thirstCapacity.max),
  reproductionRate: clamp(traits.reproductionRate, TRAIT_LIMITS.reproductionRate.min, TRAIT_LIMITS.reproductionRate.max),
});

export const clampCameraToWorld = (camera: CameraState, viewport: Bounds, world: Bounds): CameraState => ({
  x: clamp(camera.x, 0, Math.max(0, world.width - viewport.width)),
  y: clamp(camera.y, 0, Math.max(0, world.height - viewport.height)),
});

export const normalizeSimulationConfig = (config: SimulationConfig): SimulationConfig => ({
  ...config,
  predator: {
    ...config.predator,
    initialCount: Math.max(1, Math.round(config.predator.initialCount)),
    variation: clamp(config.predator.variation, 0, 0.5),
    baseTraits: normalizeTraits(config.predator.baseTraits),
  },
  prey: {
    ...config.prey,
    initialCount: Math.max(2, Math.round(config.prey.initialCount)),
    variation: clamp(config.prey.variation, 0, 0.5),
    baseTraits: normalizeTraits(config.prey.baseTraits),
  },
  food: {
    ...config.food,
    initialCount: Math.max(1, Math.round(config.food.initialCount)),
    respawnPerTick: clamp(config.food.respawnPerTick, 0, 8),
  },
  mutation: {
    chance: clamp(config.mutation.chance, 0, 1),
    amount: clamp(config.mutation.amount, 0.01, 0.8),
  },
  terrain: {
    ...config.terrain,
    cellSize: Math.max(8, Math.round(config.terrain.cellSize)),
    drinkDistance: Math.max(6, Math.round(config.terrain.drinkDistance)),
    generator: {
      ...config.terrain.generator,
      scale: clamp(config.terrain.generator.scale, 1, 20),
      octaves: Math.max(1, Math.round(config.terrain.generator.octaves)),
      persistence: clamp(config.terrain.generator.persistence, 0.1, 0.95),
    },
  },
  world: {
    width: Math.max(config.viewport.width, Math.round(config.world.width)),
    height: Math.max(config.viewport.height, Math.round(config.world.height)),
  },
  viewport: {
    width: Math.max(320, Math.round(config.viewport.width)),
    height: Math.max(220, Math.round(config.viewport.height)),
  },
  timing: {
    tickSeconds: clamp(config.timing.tickSeconds, 0.01, 0.2),
    simulationSpeed: clamp(config.timing.simulationSpeed, 0.25, 6),
  },
});
