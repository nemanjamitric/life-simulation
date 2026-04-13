import type { CameraState, PlantFood, Point, TerrainMap } from '../types';
import { Creature } from '../simulation/creature';

const TERRAIN_COLORS: Record<string, string> = {
  water: '#7fb9de',
  sand: '#e8d9aa',
  grass: '#9ac87a',
  forest: '#628c56',
  mountain: '#9a8f82',
  peak: '#e8edf4',
};

const STATE_COLORS = {
  food: '#b8912e',
  water: '#287cb1',
  flee: '#8d61bf',
  mate: '#d087c3',
  hunt: '#cb6e49',
} as const;

const intentColor = (creature: Creature): string => {
  if (!creature.alive) {
    return 'rgba(78, 51, 40, 0.28)';
  }

  switch (creature.intent) {
    case 'seeking_food':
      return creature.species === 'predator' ? '#c65f3d' : '#4f87c8';
    case 'seeking_water':
    case 'drinking':
      return '#287cb1';
    case 'seeking_mate':
    case 'mating':
      return '#d087c3';
    case 'hunting':
      return '#cb6e49';
    case 'fleeing':
      return '#8d61bf';
    case 'eating':
      return '#b8912e';
    case 'resting':
      return '#62736e';
    case 'wandering':
    default:
      return creature.species === 'predator' ? '#8c6d48' : '#5f9d82';
  }
};

const LEGEND_HEIGHT = 122;

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D context for simulation canvas was not created.');
    }

    this.ctx = context;
  }

  public setViewport = (width: number, height: number): void => {
    this.canvas.width = width;
    this.canvas.height = height + LEGEND_HEIGHT;
  };

  public render = (
    terrain: TerrainMap,
    creatures: Creature[],
    plants: PlantFood[],
    camera: CameraState,
    dragHint: Point | null,
  ): void => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground();
    this.drawTerrain(terrain, camera);
    this.drawPlants(plants, camera);
    this.drawCreatures(creatures, camera);
    this.drawFooter();
    this.drawFrame();
    this.drawLegend();
    this.drawMiniMap(terrain, creatures, camera);

    if (dragHint) {
      this.drawDragHint(dragHint);
    }
  };

  private drawBackground = (): void => {
    this.ctx.fillStyle = '#fcfaf5';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  };

  private getMapHeight = (): number => this.canvas.height - LEGEND_HEIGHT;

  private drawTerrain = (terrain: TerrainMap, camera: CameraState): void => {
    const mapHeight = this.getMapHeight();
    const startCol = Math.max(0, Math.floor(camera.x / terrain.cellSize));
    const startRow = Math.max(0, Math.floor(camera.y / terrain.cellSize));
    const endCol = Math.min(terrain.cols, Math.ceil((camera.x + this.canvas.width) / terrain.cellSize) + 1);
    const endRow = Math.min(terrain.rows, Math.ceil((camera.y + mapHeight) / terrain.cellSize) + 1);

    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const cell = terrain.cells[row * terrain.cols + col];
        const screenX = col * terrain.cellSize - camera.x;
        const screenY = row * terrain.cellSize - camera.y;
        this.ctx.fillStyle = TERRAIN_COLORS[cell.type];
        this.ctx.fillRect(screenX, screenY, terrain.cellSize + 1, terrain.cellSize + 1);
      }
    }
  };

  private drawPlants = (plants: PlantFood[], camera: CameraState): void => {
    const mapHeight = this.getMapHeight();
    for (const plant of plants) {
      if (plant.consumed) {
        continue;
      }

      const x = plant.position.x - camera.x;
      const y = plant.position.y - camera.y;
      if (x < -20 || y < -20 || x > this.canvas.width + 20 || y > mapHeight + 20) {
        continue;
      }

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.fillStyle = '#437332';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, plant.radius + 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#79c356';
      this.ctx.beginPath();
      this.ctx.arc(-1, -1, plant.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  };

  private drawCreatures = (creatures: Creature[], camera: CameraState): void => {
    const mapHeight = this.getMapHeight();
    for (const creature of creatures) {
      const x = creature.position.x - camera.x;
      const y = creature.position.y - camera.y;
      if (x < -30 || y < -30 || x > this.canvas.width + 30 || y > mapHeight + 30) {
        continue;
      }

      const radius = creature.getRadius();
      this.ctx.fillStyle = intentColor(creature);
      this.ctx.strokeStyle = creature.species === 'predator' ? 'rgba(49, 28, 12, 0.7)' : 'rgba(24, 54, 47, 0.7)';
      this.ctx.lineWidth = creature.species === 'predator' ? 2 : 1.5;

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      const sexMarkerRadius = Math.max(3.2, radius * 0.34);
      this.ctx.fillStyle = creature.sex === 'female' ? '#ff2f4f' : '#1f8cff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, sexMarkerRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();

      this.ctx.strokeStyle = 'rgba(33, 24, 18, 0.35)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + Math.cos(creature.heading) * (radius + 6), y + Math.sin(creature.heading) * (radius + 6));
      this.ctx.stroke();
    }
  };

  private drawFooter = (): void => {
    const footerTop = this.getMapHeight();
    this.ctx.fillStyle = '#f6f1e8';
    this.ctx.fillRect(0, footerTop, this.canvas.width, LEGEND_HEIGHT);
    this.ctx.strokeStyle = 'rgba(102, 81, 60, 0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, footerTop + 0.5);
    this.ctx.lineTo(this.canvas.width, footerTop + 0.5);
    this.ctx.stroke();
  };

  private drawFrame = (): void => {
    const mapHeight = this.getMapHeight();
    this.ctx.strokeStyle = '#66513c';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(1, 1, this.canvas.width - 2, mapHeight - 2);
  };

  private drawLegend = (): void => {
    const footerTop = this.getMapHeight();
    const terrainRowY = footerTop + 18;
    const stateRowY = footerTop + 54;
    const noteRowOneY = footerTop + 82;
    const noteRowTwoY = footerTop + 100;
    this.ctx.fillStyle = 'rgba(36, 27, 20, 0.78)';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Teren', 12, terrainRowY);
    this.ctx.fillText('Bitja in stanja', 12, stateRowY);

    this.drawSwatchLegend(
      [
        ['Voda', TERRAIN_COLORS.water],
        ['Pesek', TERRAIN_COLORS.sand],
        ['Trava', TERRAIN_COLORS.grass],
        ['Gozd', TERRAIN_COLORS.forest],
        ['Gora', TERRAIN_COLORS.mountain],
        ['Vrh', TERRAIN_COLORS.peak],
      ],
      64,
      terrainRowY,
    );

    this.drawSwatchLegend(
      [
        ['Hrana', '#79c356'],
        ['Voda', STATE_COLORS.water],
        ['Beg', STATE_COLORS.flee],
        ['Parjenje', STATE_COLORS.mate],
        ['Lov', STATE_COLORS.hunt],
        ['Hranjenje', STATE_COLORS.food],
      ],
      132,
      stateRowY,
    );

    this.ctx.fillStyle = 'rgba(36, 27, 20, 0.78)';
    this.ctx.fillText('Lisica = debelejsa rjava obroba | Zajec = tanjsa temna obroba', 12, noteRowOneY);
    this.ctx.fillText('Samica = rdeca pika | Samec = modra pika', 12, noteRowTwoY);
  };

  private drawSwatchLegend = (items: ReadonlyArray<readonly [string, string]>, startX: number, baselineY: number): void => {
    let x = startX;

    for (const [label, color] of items) {
      const width = this.ctx.measureText(label).width + 30;
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, baselineY - 9, 14, 10);
      this.ctx.strokeStyle = 'rgba(48, 38, 30, 0.35)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, baselineY - 9, 14, 10);
      this.ctx.fillStyle = 'rgba(36, 27, 20, 0.78)';
      this.ctx.fillText(label, x + 20, baselineY);
      x += width;
    }
  };

  private drawMiniMap = (terrain: TerrainMap, creatures: Creature[], camera: CameraState): void => {
    const width = 140;
    const height = 88;
    const x = this.canvas.width - width - 12;
    const y = 12;
    const mapHeight = this.getMapHeight();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeStyle = 'rgba(102, 81, 60, 0.45)';
    this.ctx.strokeRect(x, y, width, height);

    const scaleX = width / terrain.width;
    const scaleY = height / terrain.height;
    const step = Math.max(1, Math.floor(terrain.cells.length / 900));

    for (let index = 0; index < terrain.cells.length; index += step) {
      const cell = terrain.cells[index];
      this.ctx.fillStyle = TERRAIN_COLORS[cell.type];
      this.ctx.fillRect(x + cell.col * terrain.cellSize * scaleX, y + cell.row * terrain.cellSize * scaleY, 2, 2);
    }

    for (const creature of creatures) {
      this.ctx.fillStyle = creature.species === 'predator' ? '#cb6e49' : '#4f87c8';
      this.ctx.fillRect(x + creature.position.x * scaleX, y + creature.position.y * scaleY, 2.5, 2.5);
    }

    this.ctx.strokeStyle = '#2f2721';
    this.ctx.lineWidth = 1.2;
    this.ctx.strokeRect(x + camera.x * scaleX, y + camera.y * scaleY, this.canvas.width * scaleX, mapHeight * scaleY);
  };

  private drawDragHint = (dragHint: Point): void => {
    const footerTop = this.getMapHeight();
    this.ctx.fillStyle = 'rgba(23, 38, 55, 0.74)';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`Premik pogleda: ${Math.round(dragHint.x)}, ${Math.round(dragHint.y)}`, 12, footerTop + 36);
  };
}
