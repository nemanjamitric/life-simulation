import './styles.css';
import { GraphRenderer } from './render/graphRenderer';
import { CanvasRenderer } from './render/canvasRenderer';
import { SimulationEngine } from './simulation/engine';
import type { Point, SimulationConfig } from './types';
import { UIController } from './ui/controls';

const DEFAULT_CONFIG: SimulationConfig = {
  world: { width: 1100, height: 760 },
  viewport: { width: 680, height: 420 },
  terrain: {
    source: 'preset',
    preset: 'river',
    cellSize: 12,
    drinkDistance: 18,
    generator: {
      seed: 42,
      scale: 5.2,
      octaves: 4,
      persistence: 0.5,
    },
  },
  predator: {
    initialCount: 10,
    variation: 0.1,
    baseTraits: {
      speed: 2.1,
      size: 2.2,
      perception: 2.4,
      maxAge: 640,
      hungerCapacity: 110,
      thirstCapacity: 95,
      reproductionRate: 1.6,
    },
  },
  prey: {
    initialCount: 28,
    variation: 0.12,
    baseTraits: {
      speed: 2.5,
      size: 1.2,
      perception: 2.7,
      maxAge: 520,
      hungerCapacity: 86,
      thirstCapacity: 82,
      reproductionRate: 2,
    },
  },
  food: {
    initialCount: 120,
    respawnPerTick: 0.4,
    energyGain: 28,
    spawnTerrain: ['grass', 'forest'],
  },
  mutation: {
    chance: 0.1,
    amount: 0.2,
  },
  timing: {
    tickSeconds: 0.05,
    simulationSpeed: 1,
  },
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Application container #app is missing.');
}

const ui = new UIController(app, DEFAULT_CONFIG);
const worldCanvas = document.querySelector<HTMLCanvasElement>('#world-canvas');
const graphCanvas = document.querySelector<HTMLCanvasElement>('#graph-canvas');

if (!worldCanvas || !graphCanvas) {
  throw new Error('Required canvas elements are missing.');
}

const worldRenderer = new CanvasRenderer(worldCanvas);
const graphRenderer = new GraphRenderer(graphCanvas, DEFAULT_CONFIG.viewport.width, DEFAULT_CONFIG.viewport.height);
let dragStart: Point | null = null;
let dragOrigin: Point | null = null;
let dragHint: Point | null = null;

const engine = new SimulationEngine({
  onTick: () => {
    const config = engine.getConfig();
    const summary = engine.getSummary();
    worldRenderer.setViewport(config.viewport.width, config.viewport.height);
    graphRenderer.setSize(config.viewport.width, config.viewport.height);
    worldRenderer.render(engine.getTerrain(), engine.getCreatures(), engine.getPlants(), engine.getCamera(), dragHint);
    graphRenderer.render(engine.getHistory());

    ui.setStatus(
      `Korak ${summary.tick} | Teren: ${summary.terrainModeLabel} | Pogled: ${Math.round(summary.camera.x)}, ${Math.round(summary.camera.y)}`,
    );
    ui.setTotals(
      `Lisice: ${summary.predatorCount} | Zajci: ${summary.preyCount} | Rastline: ${summary.plantCount} | Rojstva: ${summary.births} | Smrti: ${summary.deaths}`,
    );
    ui.setSummary(
      `Povprecna starost zivih: ${summary.averageAge.toFixed(1)} | Povprecna zivljenjska doba: ${summary.averageLifetime.toFixed(1)} | Najdaljse prezivetje: ${summary.longestLifetime.toFixed(1)} | Pritisk zeje: ${(summary.averageWaterPressure * 100).toFixed(0)}%`,
    );
  },
});

const centerCamera = (): void => {
  const config = engine.getConfig();
  engine.setCamera({
    x: Math.max(0, (config.world.width - config.viewport.width) * 0.5),
    y: Math.max(0, (config.world.height - config.viewport.height) * 0.5),
  });
};

const resetAndStart = (): void => {
  const config = ui.readConfig();
  worldRenderer.setViewport(config.viewport.width, config.viewport.height);
  graphRenderer.setSize(config.viewport.width, config.viewport.height);
  engine.reset(config);
  centerCamera();
  engine.start();
};

ui.onStartReset(resetAndStart);
ui.onCenterCamera(centerCamera);

worldCanvas.addEventListener('pointerdown', (event) => {
  dragStart = { x: event.clientX, y: event.clientY };
  dragOrigin = engine.getCamera();
  dragHint = { x: 0, y: 0 };
  worldCanvas.setPointerCapture(event.pointerId);
});

worldCanvas.addEventListener('pointermove', (event) => {
  if (!dragStart || !dragOrigin) {
    return;
  }

  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  dragHint = { x: -dx, y: -dy };
  engine.setCamera({ x: dragOrigin.x - dx, y: dragOrigin.y - dy });
});

worldCanvas.addEventListener('pointerup', (event) => {
  dragStart = null;
  dragOrigin = null;
  dragHint = null;
  worldCanvas.releasePointerCapture(event.pointerId);
  engine.setCamera(engine.getCamera());
});

window.addEventListener('keydown', (event) => {
  const step = event.shiftKey ? 80 : 36;
  switch (event.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      engine.panCamera(0, -step);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      engine.panCamera(0, step);
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      engine.panCamera(-step, 0);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      engine.panCamera(step, 0);
      break;
    default:
      break;
  }
});

resetAndStart();
