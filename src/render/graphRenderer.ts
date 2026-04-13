import type { PopulationSnapshot } from '../types';

interface GraphArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class GraphRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement, width: number, height: number) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D context for graph canvas was not created.');
    }

    this.ctx = context;
    canvas.width = width;
    canvas.height = height;
  }

  public setSize = (width: number, height: number): void => {
    this.canvas.width = width;
    this.canvas.height = height;
  };

  public render = (history: PopulationSnapshot[]): void => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#fcfbf7';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (history.length === 0) {
      return;
    }

    const topArea: GraphArea = { left: 56, top: 58, width: this.canvas.width - 82, height: 112 };
    const bottomArea: GraphArea = { left: 56, top: 224, width: this.canvas.width - 82, height: 96 };
    const legendTop = bottomArea.top + bottomArea.height + 54;

    this.drawTitle();
    this.drawPopulationGraph(history, topArea);
    this.drawTraitsGraph(history, bottomArea);
    this.drawLegend(legendTop);
  };

  private drawTitle = (): void => {
    this.ctx.fillStyle = '#2b241e';
    this.ctx.font = '600 14px monospace';
    this.ctx.fillText('Razvoj populacij in povprecnih lastnosti', 18, 24);
  };

  private drawPopulationGraph = (history: PopulationSnapshot[], area: GraphArea): void => {
    const tickDomain = this.getTickDomain(history);
    const maxPopulation = Math.max(2, ...history.map((item) => Math.max(item.predatorCount, item.preyCount, item.plantCount)));

    this.drawAxes(area, tickDomain.min, tickDomain.max, maxPopulation, 'Populacije', 'Stevilo');
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxPopulation, (item) => item.predatorCount, '#c25a3b');
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxPopulation, (item) => item.preyCount, '#3e79ba');
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxPopulation, (item) => item.plantCount, '#4d8c42', [5, 4]);
  };

  private drawTraitsGraph = (history: PopulationSnapshot[], area: GraphArea): void => {
    const tickDomain = this.getTickDomain(history);
    const maxValue = Math.max(
      2,
      ...history.map((item) =>
        Math.max(
          item.averageAge / 20,
          item.averagePredatorSpeed,
          item.averagePreySpeed,
          item.averagePredatorPerception,
          item.averagePreyPerception,
        ),
      ),
    );

    this.drawAxes(area, tickDomain.min, tickDomain.max, maxValue, 'Povprecja', 'Vrednost');
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxValue, (item) => item.averageAge / 20, '#6d5cc2');
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxValue, (item) => item.averagePredatorSpeed, '#cb6e49');
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxValue, (item) => item.averagePreySpeed, '#3e79ba');
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxValue, (item) => item.averagePredatorPerception, '#b29533', [6, 4]);
    this.drawLine(history, area, tickDomain.min, tickDomain.max, maxValue, (item) => item.averagePreyPerception, '#4f9d82', [2, 3]);
  };

  private drawAxes = (area: GraphArea, minX: number, maxX: number, maxY: number, title: string, yLabel: string): void => {
    const bottom = area.top + area.height;

    this.ctx.fillStyle = '#2f2721';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(title, area.left, area.top - 12);

    this.ctx.strokeStyle = '#cabca9';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(area.left, area.top, area.width, area.height);

    const yTicks = 5;
    for (let index = 0; index <= yTicks; index += 1) {
      const ratio = index / yTicks;
      const y = bottom - ratio * area.height;
      const label = (ratio * maxY).toFixed(maxY > 12 ? 0 : 1);

      this.ctx.strokeStyle = 'rgba(120, 97, 73, 0.14)';
      this.ctx.beginPath();
      this.ctx.moveTo(area.left, y);
      this.ctx.lineTo(area.left + area.width, y);
      this.ctx.stroke();

      this.ctx.fillStyle = '#59493b';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(label, area.left - 8, y + 4);
    }

    const xTicks = 8;
    for (let index = 0; index <= xTicks; index += 1) {
      const ratio = index / xTicks;
      const x = area.left + ratio * area.width;
      const label = Math.round(minX + ratio * (maxX - minX));

      this.ctx.strokeStyle = 'rgba(120, 97, 73, 0.14)';
      this.ctx.beginPath();
      this.ctx.moveTo(x, area.top);
      this.ctx.lineTo(x, bottom);
      this.ctx.stroke();

      this.ctx.fillStyle = '#59493b';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(String(label), x, bottom + 16);
    }

    this.ctx.fillStyle = '#59493b';
    this.ctx.fillText('Koraki simulacije', area.left + area.width / 2, bottom + 34);

    this.ctx.save();
    this.ctx.translate(18, area.top + area.height / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.fillText(yLabel, 0, 0);
    this.ctx.restore();
    this.ctx.textAlign = 'left';
  };

  private drawLine = (
    history: PopulationSnapshot[],
    area: GraphArea,
    minTick: number,
    maxTick: number,
    maxValue: number,
    valueGetter: (snapshot: PopulationSnapshot) => number,
    color: string,
    dash: number[] = [],
  ): void => {
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2.1;
    this.ctx.setLineDash(dash);
    this.ctx.beginPath();

    const tickSpan = Math.max(1, maxTick - minTick);

    history.forEach((item, index) => {
      const x = area.left + ((item.tick - minTick) / tickSpan) * area.width;
      const y = area.top + area.height - (valueGetter(item) / maxValue) * area.height;

      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.stroke();
    this.ctx.restore();
  };

  private drawLegend = (top: number): void => {
    const items = [
      ['Lisice', '#c25a3b'],
      ['Zajci', '#3e79ba'],
      ['Rastline', '#4d8c42'],
      ['Starost / 20', '#6d5cc2'],
      ['Hitrost lisic', '#cb6e49'],
      ['Hitrost zajcev', '#3e79ba'],
      ['Zaznava lisic', '#b29533'],
      ['Zaznava zajcev', '#4f9d82'],
    ] as const;

    this.ctx.font = '12px monospace';
    let x = 18;
    let y = top;

    for (const [label, color] of items) {
      const width = this.ctx.measureText(label).width + 28;
      if (x + width > this.canvas.width - 18) {
        x = 18;
        y += 18;
      }

      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y - 9, 14, 6);
      this.ctx.fillStyle = '#2f2721';
      this.ctx.fillText(label, x + 20, y - 4);
      x += width;
    }
  };

  private getTickDomain = (history: PopulationSnapshot[]): { min: number; max: number } => {
    const min = history[0]?.tick ?? 0;
    const max = history[history.length - 1]?.tick ?? 1;
    return {
      min,
      max: Math.max(min + 1, max),
    };
  };
}
