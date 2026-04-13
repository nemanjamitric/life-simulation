import { describe, expect, test } from 'vitest';
import type { Bounds, TerrainPreset } from '../types';
import { createTerrain, getTerrainStats, isNearWater, isPassablePoint } from './terrain';

const bounds: Bounds = { width: 720, height: 480 };

describe('terrain generation', () => {
  test('generated terrain follows requested band distribution within tolerance', () => {
    const terrain = createTerrain(bounds, {
      source: 'generated',
      preset: 'river',
      cellSize: 12,
      drinkDistance: 18,
      generator: {
        seed: 42,
        scale: 5.2,
        octaves: 4,
        persistence: 0.5,
      },
    });

    const stats = getTerrainStats(terrain);
    expect(stats.water).toBeCloseTo(0.4, 1);
    expect(stats.grass).toBeCloseTo(0.35, 1);
    expect(stats.forest).toBeCloseTo(0.15, 1);
    expect(stats.mountain).toBeCloseTo(0.05, 1);
    expect(stats.sand).toBeCloseTo(0.025, 1);
    expect(stats.peak).toBeCloseTo(0.025, 1);
  });

  test('preset terrains create distinct water layouts', () => {
    const presets: TerrainPreset[] = ['river', 'lake', 'multiple_lakes', 'delta'];
    const waterSignatures = presets.map((preset) => {
      const terrain = createTerrain(bounds, {
        source: 'preset',
        preset,
        cellSize: 12,
        drinkDistance: 18,
        generator: { seed: 1, scale: 4, octaves: 3, persistence: 0.5 },
      });

      const waterCells = terrain.cells.filter((cell) => cell.type === 'water');
      const avgCol = waterCells.reduce((sum, cell) => sum + cell.col, 0) / waterCells.length;
      const avgRow = waterCells.reduce((sum, cell) => sum + cell.row, 0) / waterCells.length;
      const minCol = Math.min(...waterCells.map((cell) => cell.col));
      const maxCol = Math.max(...waterCells.map((cell) => cell.col));
      const minRow = Math.min(...waterCells.map((cell) => cell.row));
      const maxRow = Math.max(...waterCells.map((cell) => cell.row));

      return [avgCol.toFixed(1), avgRow.toFixed(1), minCol, maxCol, minRow, maxRow].join('|');
    });

    expect(new Set(waterSignatures).size).toBe(presets.length);
  });

  test('water is blocked but drinking near water is allowed', () => {
    const terrain = createTerrain(bounds, {
      source: 'preset',
      preset: 'lake',
      cellSize: 12,
      drinkDistance: 18,
      generator: { seed: 4, scale: 4, octaves: 3, persistence: 0.5 },
    });

    const waterCell = terrain.cells.find((cell) => cell.type === 'water');
    const landNeighbor = terrain.cells.find((cell) => {
      if (cell.type === 'water') {
        return false;
      }

      return Math.abs(cell.col - (waterCell?.col ?? 0)) <= 1 && Math.abs(cell.row - (waterCell?.row ?? 0)) <= 1;
    });

    expect(waterCell).toBeTruthy();
    expect(landNeighbor).toBeTruthy();

    const waterPoint = { x: (waterCell?.col ?? 0) * terrain.cellSize + 2, y: (waterCell?.row ?? 0) * terrain.cellSize + 2 };
    const landPoint = {
      x: ((landNeighbor?.col ?? 0) + 0.5) * terrain.cellSize,
      y: ((landNeighbor?.row ?? 0) + 0.5) * terrain.cellSize,
    };

    expect(isPassablePoint(terrain, waterPoint)).toBe(false);
    expect(isNearWater(terrain, landPoint, 18)).toBe(true);
  });
});
