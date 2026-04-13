import type { CreatureSnapshot, PopulationSnapshot } from '../types';
import { average } from './random';

export class PopulationHistory {
  public readonly snapshots: PopulationSnapshot[] = [];

  constructor(private readonly maxSnapshots = 360) {}

  public reset = (): void => {
    this.snapshots.length = 0;
  };

  public record = (
    tick: number,
    creatures: CreatureSnapshot[],
    plantCount: number,
    births: number,
    deaths: number,
    averageLifetime: number,
    longestLifetime: number,
  ): PopulationSnapshot => {
    const predators = creatures.filter((creature) => creature.species === 'predator' && creature.alive);
    const prey = creatures.filter((creature) => creature.species === 'prey' && creature.alive);

    const snapshot: PopulationSnapshot = {
      tick,
      predatorCount: predators.length,
      preyCount: prey.length,
      plantCount,
      births,
      deaths,
      averageAge: average(creatures.filter((creature) => creature.alive).map((creature) => creature.state.age)),
      averageLifetime,
      longestLifetime,
      averagePredatorSpeed: average(predators.map((creature) => creature.traits.speed)),
      averagePreySpeed: average(prey.map((creature) => creature.traits.speed)),
      averagePredatorSize: average(predators.map((creature) => creature.traits.size)),
      averagePreySize: average(prey.map((creature) => creature.traits.size)),
      averagePredatorPerception: average(predators.map((creature) => creature.traits.perception)),
      averagePreyPerception: average(prey.map((creature) => creature.traits.perception)),
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  };
}
