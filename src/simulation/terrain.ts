import type { Bounds, Point, TerrainCell, TerrainConfig, TerrainMap, TerrainPreset, TerrainStats, TerrainType } from '../types';
import { octavePerlin } from './noise';
import { clamp } from './random';

const TERRAIN_ORDER: TerrainType[] = ['water', 'sand', 'grass', 'forest', 'mountain', 'peak'];

const TERRAIN_TARGETS: Record<TerrainType, number> = {
  water: 0.4,
  sand: 0.025,
  grass: 0.35,
  forest: 0.15,
  mountain: 0.05,
  peak: 0.025,
};

const pointToIndex = (col: number, row: number, cols: number): number => row * cols + col;

const inBounds = (col: number, row: number, map: TerrainMap): boolean => col >= 0 && row >= 0 && col < map.cols && row < map.rows;

const computeThresholds = (values: number[]): Map<TerrainType, number> => {
  const sorted = [...values].sort((a, b) => a - b);
  const thresholds = new Map<TerrainType, number>();
  let cumulative = 0;

  for (const type of TERRAIN_ORDER) {
    cumulative += TERRAIN_TARGETS[type];
    const index = Math.min(sorted.length - 1, Math.floor(cumulative * (sorted.length - 1)));
    thresholds.set(type, sorted[index] ?? 0);
  }

  return thresholds;
};

const terrainFromValue = (value: number, thresholds: Map<TerrainType, number>): TerrainType => {
  for (const type of TERRAIN_ORDER) {
    const limit = thresholds.get(type) ?? 0;
    if (value <= limit) {
      return type;
    }
  }

  return 'peak';
};

const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
};

const presetHeight = (preset: TerrainPreset, normalizedX: number, normalizedY: number): number => {
  const hill = 0.52 + normalizedY * 0.12 - normalizedX * 0.06;
  const point = { x: normalizedX, y: normalizedY };

  switch (preset) {
    case 'river': {
      const riverCenter = 0.42 + Math.sin(normalizedY * 10) * 0.09;
      const riverWidth = 0.12 + Math.cos(normalizedY * 8) * 0.02;
      const riverDistance = Math.abs(normalizedX - riverCenter);
      return hill - Math.max(0, riverWidth - riverDistance) * 3.4;
    }
    case 'lake': {
      const lakeDistance = Math.hypot(normalizedX - 0.52, normalizedY - 0.48);
      return hill - Math.max(0, 0.28 - lakeDistance) * 2.8;
    }
    case 'multiple_lakes': {
      const centers = [
        { x: 0.28, y: 0.32, radius: 0.15 },
        { x: 0.65, y: 0.36, radius: 0.13 },
        { x: 0.45, y: 0.68, radius: 0.16 },
      ];
      let value = hill;
      for (const center of centers) {
        const distance = Math.hypot(normalizedX - center.x, normalizedY - center.y);
        value -= Math.max(0, center.radius - distance) * 3.2;
      }

      return value;
    }
    case 'delta':
    default: {
      const trunk = distanceToSegment(point, { x: 0.08, y: 0.2 }, { x: 0.44, y: 0.56 });
      const branchA = distanceToSegment(point, { x: 0.44, y: 0.56 }, { x: 0.94, y: 0.3 });
      const branchB = distanceToSegment(point, { x: 0.44, y: 0.56 }, { x: 0.92, y: 0.82 });
      const lagoon = Math.hypot(normalizedX - 0.84, normalizedY - 0.56);
      const channelDistance = Math.min(trunk, branchA, branchB);
      return hill - Math.max(0, 0.1 - channelDistance) * 3.1 - Math.max(0, 0.2 - lagoon) * 2.4;
    }
  }
};

const buildCells = (map: TerrainMap, heights: number[]): TerrainCell[] => {
  const thresholds = computeThresholds(heights);

  return heights.map((height, index) => {
    const col = index % map.cols;
    const row = Math.floor(index / map.cols);

    return {
      col,
      row,
      height,
      type: terrainFromValue(height, thresholds),
    };
  });
};

export const createTerrain = (bounds: Bounds, config: TerrainConfig): TerrainMap => {
  const cellSize = Math.max(8, Math.round(config.cellSize));
  const cols = Math.ceil(bounds.width / cellSize);
  const rows = Math.ceil(bounds.height / cellSize);
  const map: TerrainMap = {
    width: bounds.width,
    height: bounds.height,
    cellSize,
    cols,
    rows,
    cells: [],
  };

  const heights: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const normalizedX = cols <= 1 ? 0 : col / (cols - 1);
      const normalizedY = rows <= 1 ? 0 : row / (rows - 1);

      if (config.source === 'preset') {
        heights.push(presetHeight(config.preset, normalizedX, normalizedY));
        continue;
      }

      const sampleX = normalizedX * config.generator.scale;
      const sampleY = normalizedY * config.generator.scale;
      const base = octavePerlin(
        config.generator.seed,
        sampleX,
        sampleY,
        config.generator.octaves,
        config.generator.persistence,
      );
      const radialBias = 0.3 - Math.hypot(normalizedX - 0.5, normalizedY - 0.5) * 0.4;
      heights.push(base + radialBias);
    }
  }

  map.cells = buildCells(map, heights);
  return map;
};

export const getTerrainCell = (map: TerrainMap, col: number, row: number): TerrainCell | null => {
  if (!inBounds(col, row, map)) {
    return null;
  }

  return map.cells[pointToIndex(col, row, map.cols)] ?? null;
};

export const getTerrainCellAtPoint = (map: TerrainMap, point: Point): TerrainCell | null => {
  const col = Math.floor(point.x / map.cellSize);
  const row = Math.floor(point.y / map.cellSize);
  return getTerrainCell(map, col, row);
};

export const isPassablePoint = (map: TerrainMap, point: Point): boolean => {
  const cell = getTerrainCellAtPoint(map, point);
  return cell !== null && cell.type !== 'water';
};

export const isNearWater = (map: TerrainMap, point: Point, drinkDistance: number): boolean => {
  const radius = Math.max(1, Math.ceil(drinkDistance / map.cellSize));
  const centerCol = Math.floor(point.x / map.cellSize);
  const centerRow = Math.floor(point.y / map.cellSize);

  for (let row = centerRow - radius; row <= centerRow + radius; row += 1) {
    for (let col = centerCol - radius; col <= centerCol + radius; col += 1) {
      const cell = getTerrainCell(map, col, row);
      if (!cell || cell.type !== 'water') {
        continue;
      }

      const cellCenter = { x: (col + 0.5) * map.cellSize, y: (row + 0.5) * map.cellSize };
      if (Math.hypot(point.x - cellCenter.x, point.y - cellCenter.y) <= drinkDistance + map.cellSize * 0.75) {
        return true;
      }
    }
  }

  return false;
};

export const findNearestTerrainPoint = (
  map: TerrainMap,
  point: Point,
  terrainTypes: TerrainType[],
  maxDistance: number,
): Point | null => {
  let bestPoint: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const maxCells = Math.ceil(maxDistance / map.cellSize);
  const centerCol = Math.floor(point.x / map.cellSize);
  const centerRow = Math.floor(point.y / map.cellSize);

  for (let row = centerRow - maxCells; row <= centerRow + maxCells; row += 1) {
    for (let col = centerCol - maxCells; col <= centerCol + maxCells; col += 1) {
      const cell = getTerrainCell(map, col, row);
      if (!cell || !terrainTypes.includes(cell.type)) {
        continue;
      }

      const candidate = { x: (cell.col + 0.5) * map.cellSize, y: (cell.row + 0.5) * map.cellSize };
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance < bestDistance && distance <= maxDistance) {
        bestDistance = distance;
        bestPoint = candidate;
      }
    }
  }

  return bestPoint;
};

export const findNearestDrinkingPoint = (map: TerrainMap, point: Point, maxDistance: number, drinkDistance: number): Point | null => {
  let bestPoint: Point | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const maxCells = Math.ceil(maxDistance / map.cellSize);
  const centerCol = Math.floor(point.x / map.cellSize);
  const centerRow = Math.floor(point.y / map.cellSize);

  for (let row = centerRow - maxCells; row <= centerRow + maxCells; row += 1) {
    for (let col = centerCol - maxCells; col <= centerCol + maxCells; col += 1) {
      const cell = getTerrainCell(map, col, row);
      if (!cell || cell.type === 'water') {
        continue;
      }

      const candidate = { x: (cell.col + 0.5) * map.cellSize, y: (cell.row + 0.5) * map.cellSize };
      if (!isNearWater(map, candidate, drinkDistance)) {
        continue;
      }

      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance < bestDistance && distance <= maxDistance) {
        bestDistance = distance;
        bestPoint = candidate;
      }
    }
  }

  return bestPoint;
};

export const randomPassablePoint = (map: TerrainMap, randomValue: () => number): Point => {
  const passableCells = map.cells.filter((cell) => cell.type !== 'water');
  const chosen = passableCells[Math.floor(randomValue() * passableCells.length)] ?? map.cells[0];
  return {
    x: chosen.col * map.cellSize + map.cellSize * 0.5,
    y: chosen.row * map.cellSize + map.cellSize * 0.5,
  };
};

export const getTerrainStats = (map: TerrainMap): TerrainStats => {
  const counts: TerrainStats = {
    water: 0,
    sand: 0,
    grass: 0,
    forest: 0,
    mountain: 0,
    peak: 0,
  };

  for (const cell of map.cells) {
    counts[cell.type] += 1;
  }

  const total = map.cells.length || 1;
  return {
    water: counts.water / total,
    sand: counts.sand / total,
    grass: counts.grass / total,
    forest: counts.forest / total,
    mountain: counts.mountain / total,
    peak: counts.peak / total,
  };
};
