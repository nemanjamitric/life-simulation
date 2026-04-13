import type { SimulationConfig, TerrainPreset, TerrainSource, TerrainType } from '../types';

interface ControlRefs {
  root: HTMLElement;
  startButton: HTMLButtonElement;
  centerButton: HTMLButtonElement;
  status: HTMLElement;
  totals: HTMLElement;
  summary: HTMLElement;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class UIController {
  private readonly controls: ControlRefs;

  constructor(container: HTMLElement, defaults: SimulationConfig) {
    container.innerHTML = this.getMarkup(defaults);
    this.controls = {
      root: container,
      startButton: this.mustQuery('#start-reset-btn'),
      centerButton: this.mustQuery('#center-camera-btn'),
      status: this.mustQuery('#status-text'),
      totals: this.mustQuery('#totals-text'),
      summary: this.mustQuery('#summary-text'),
    };
  }

  public onStartReset = (handler: () => void): void => {
    this.controls.startButton.addEventListener('click', handler);
  };

  public onCenterCamera = (handler: () => void): void => {
    this.controls.centerButton.addEventListener('click', handler);
  };

  public readConfig = (): SimulationConfig => {
    const root = this.controls.root;
    const terrainSource = this.readSelect(root, 'terrainSource') as TerrainSource;
    const terrainPreset = this.readSelect(root, 'terrainPreset') as TerrainPreset;

    return {
      world: {
        width: this.readNumber(root, 'worldWidth', 500, 2400, true),
        height: this.readNumber(root, 'worldHeight', 360, 1800, true),
      },
      viewport: {
        width: this.readNumber(root, 'viewportWidth', 320, 1200, true),
        height: this.readNumber(root, 'viewportHeight', 220, 900, true),
      },
      terrain: {
        source: terrainSource,
        preset: terrainPreset,
        cellSize: this.readNumber(root, 'cellSize', 8, 30, true),
        drinkDistance: this.readNumber(root, 'drinkDistance', 6, 48, true),
        generator: {
          seed: this.readNumber(root, 'noiseSeed', 1, 999999, true),
          scale: this.readNumber(root, 'noiseScale', 1, 20),
          octaves: this.readNumber(root, 'noiseOctaves', 1, 6, true),
          persistence: this.readNumber(root, 'noisePersistence', 0.1, 0.95),
        },
      },
      predator: {
        initialCount: this.readNumber(root, 'predatorCount', 1, 120, true),
        variation: this.readNumber(root, 'predatorVariation', 0, 0.5),
        baseTraits: {
          speed: this.readNumber(root, 'predatorSpeed', 0.3, 6),
          size: this.readNumber(root, 'predatorSize', 0.4, 5),
          perception: this.readNumber(root, 'predatorPerception', 0.4, 7),
          maxAge: this.readNumber(root, 'predatorMaxAge', 40, 2500, true),
          hungerCapacity: this.readNumber(root, 'predatorHunger', 10, 300),
          thirstCapacity: this.readNumber(root, 'predatorThirst', 10, 300),
          reproductionRate: this.readNumber(root, 'predatorReproduction', 0.1, 5),
        },
      },
      prey: {
        initialCount: this.readNumber(root, 'preyCount', 2, 240, true),
        variation: this.readNumber(root, 'preyVariation', 0, 0.5),
        baseTraits: {
          speed: this.readNumber(root, 'preySpeed', 0.3, 6),
          size: this.readNumber(root, 'preySize', 0.4, 5),
          perception: this.readNumber(root, 'preyPerception', 0.4, 7),
          maxAge: this.readNumber(root, 'preyMaxAge', 40, 2500, true),
          hungerCapacity: this.readNumber(root, 'preyHunger', 10, 300),
          thirstCapacity: this.readNumber(root, 'preyThirst', 10, 300),
          reproductionRate: this.readNumber(root, 'preyReproduction', 0.1, 5),
        },
      },
      food: {
        initialCount: this.readNumber(root, 'plantCount', 1, 400, true),
        respawnPerTick: this.readNumber(root, 'plantRespawn', 0, 8),
        energyGain: this.readNumber(root, 'plantNutrition', 5, 120),
        spawnTerrain: this.readTerrainList(root, 'plantTerrain'),
      },
      mutation: {
        chance: this.readNumber(root, 'mutationChance', 0, 1),
        amount: this.readNumber(root, 'mutationAmount', 0.01, 0.8),
      },
      timing: {
        tickSeconds: this.readNumber(root, 'tickSeconds', 0.01, 0.2),
        simulationSpeed: this.readNumber(root, 'simulationSpeed', 0.25, 6),
      },
    };
  };

  public setStatus = (message: string): void => {
    this.controls.status.textContent = message;
  };

  public setTotals = (line: string): void => {
    this.controls.totals.textContent = line;
  };

  public setSummary = (line: string): void => {
    this.controls.summary.textContent = line;
  };

  private readTerrainList = (root: HTMLElement, name: string): TerrainType[] => {
    const select = root.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
    if (!select) {
      throw new Error(`Select ${name} is missing.`);
    }

    return Array.from(select.selectedOptions).map((option) => option.value as TerrainType);
  };

  private readNumber = (root: HTMLElement, name: string, min: number, max: number, round = false): number => {
    const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input) {
      throw new Error(`Input ${name} is missing.`);
    }

    const parsed = Number(input.value);
    const safeValue = Number.isFinite(parsed) ? parsed : min;
    const normalized = round ? Math.round(clamp(safeValue, min, max)) : clamp(safeValue, min, max);
    input.value = String(normalized);
    return normalized;
  };

  private readSelect = (root: HTMLElement, name: string): string => {
    const select = root.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
    if (!select) {
      throw new Error(`Select ${name} is missing.`);
    }

    return select.value;
  };

  private mustQuery = <T extends HTMLElement>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing required UI element: ${selector}`);
    }

    return element;
  };

  private getMarkup = (defaults: SimulationConfig): string => `
    <main class="app-grid">
      <section class="canvas-panel">
        <h2>Svet in teren</h2>
        <canvas id="world-canvas"></canvas>
      </section>
      <section class="canvas-panel">
        <h2>Grafi simulacije</h2>
        <canvas id="graph-canvas"></canvas>
      </section>
    </main>

    <section class="controls">
      <section class="settings-card">
        <h3>Svet in pogled</h3>
        <label>Sirina sveta
          <input name="worldWidth" type="number" min="500" max="2400" value="${defaults.world.width}" />
        </label>
        <label>Visina sveta
          <input name="worldHeight" type="number" min="360" max="1800" value="${defaults.world.height}" />
        </label>
        <label>Sirina prikaza
          <input name="viewportWidth" type="number" min="320" max="1200" value="${defaults.viewport.width}" />
        </label>
        <label>Visina prikaza
          <input name="viewportHeight" type="number" min="220" max="900" value="${defaults.viewport.height}" />
        </label>
        <label>Velikost terenske celice
          <input name="cellSize" type="number" min="8" max="30" value="${defaults.terrain.cellSize}" />
        </label>
        <label>Razdalja za pitje
          <input name="drinkDistance" type="number" min="6" max="48" value="${defaults.terrain.drinkDistance}" />
        </label>
      </section>

      <section class="settings-card">
        <h3>Teren</h3>
        <label>Nacin terena
          <select name="terrainSource">
            <option value="preset"${defaults.terrain.source === 'preset' ? ' selected' : ''}>Predloga</option>
            <option value="generated"${defaults.terrain.source === 'generated' ? ' selected' : ''}>Perlinov sum</option>
          </select>
        </label>
        <label>Predloga
          <select name="terrainPreset">
            <option value="river"${defaults.terrain.preset === 'river' ? ' selected' : ''}>Reka</option>
            <option value="lake"${defaults.terrain.preset === 'lake' ? ' selected' : ''}>Jezero</option>
            <option value="multiple_lakes"${defaults.terrain.preset === 'multiple_lakes' ? ' selected' : ''}>Vec jezer</option>
            <option value="delta"${defaults.terrain.preset === 'delta' ? ' selected' : ''}>Razvejano korito</option>
          </select>
        </label>
        <label>Seed
          <input name="noiseSeed" type="number" min="1" max="999999" value="${defaults.terrain.generator.seed}" />
        </label>
        <label>Skala suma
          <input name="noiseScale" type="number" min="1" max="20" step="0.1" value="${defaults.terrain.generator.scale}" />
        </label>
        <label>Oktave
          <input name="noiseOctaves" type="number" min="1" max="6" value="${defaults.terrain.generator.octaves}" />
        </label>
        <label>Persistenca
          <input name="noisePersistence" type="number" min="0.1" max="0.95" step="0.05" value="${defaults.terrain.generator.persistence}" />
        </label>
      </section>

      <section class="settings-card">
        <h3>Lisice</h3>
        <label>Zacetno stevilo
          <input name="predatorCount" type="number" min="1" max="120" value="${defaults.predator.initialCount}" />
        </label>
        <label>Hitrost
          <input name="predatorSpeed" type="number" min="0.3" max="6" step="0.1" value="${defaults.predator.baseTraits.speed}" />
        </label>
        <label>Velikost
          <input name="predatorSize" type="number" min="0.4" max="5" step="0.1" value="${defaults.predator.baseTraits.size}" />
        </label>
        <label>Zaznava
          <input name="predatorPerception" type="number" min="0.4" max="7" step="0.1" value="${defaults.predator.baseTraits.perception}" />
        </label>
        <label>Max starost
          <input name="predatorMaxAge" type="number" min="40" max="2500" value="${defaults.predator.baseTraits.maxAge}" />
        </label>
        <label>Lakota
          <input name="predatorHunger" type="number" min="10" max="300" step="1" value="${defaults.predator.baseTraits.hungerCapacity}" />
        </label>
        <label>Zeja
          <input name="predatorThirst" type="number" min="10" max="300" step="1" value="${defaults.predator.baseTraits.thirstCapacity}" />
        </label>
        <label>Rast potrebe po razmnozevanju
          <input name="predatorReproduction" type="number" min="0.1" max="5" step="0.1" value="${defaults.predator.baseTraits.reproductionRate}" />
        </label>
        <label>Variacija
          <input name="predatorVariation" type="number" min="0" max="0.5" step="0.01" value="${defaults.predator.variation}" />
        </label>
      </section>

      <section class="settings-card">
        <h3>Zajci</h3>
        <label>Zacetno stevilo
          <input name="preyCount" type="number" min="2" max="240" value="${defaults.prey.initialCount}" />
        </label>
        <label>Hitrost
          <input name="preySpeed" type="number" min="0.3" max="6" step="0.1" value="${defaults.prey.baseTraits.speed}" />
        </label>
        <label>Velikost
          <input name="preySize" type="number" min="0.4" max="5" step="0.1" value="${defaults.prey.baseTraits.size}" />
        </label>
        <label>Zaznava
          <input name="preyPerception" type="number" min="0.4" max="7" step="0.1" value="${defaults.prey.baseTraits.perception}" />
        </label>
        <label>Max starost
          <input name="preyMaxAge" type="number" min="40" max="2500" value="${defaults.prey.baseTraits.maxAge}" />
        </label>
        <label>Lakota
          <input name="preyHunger" type="number" min="10" max="300" step="1" value="${defaults.prey.baseTraits.hungerCapacity}" />
        </label>
        <label>Zeja
          <input name="preyThirst" type="number" min="10" max="300" step="1" value="${defaults.prey.baseTraits.thirstCapacity}" />
        </label>
        <label>Rast potrebe po razmnozevanju
          <input name="preyReproduction" type="number" min="0.1" max="5" step="0.1" value="${defaults.prey.baseTraits.reproductionRate}" />
        </label>
        <label>Variacija
          <input name="preyVariation" type="number" min="0" max="0.5" step="0.01" value="${defaults.prey.variation}" />
        </label>
      </section>

      <section class="settings-card">
        <h3>Rastline in mutacije</h3>
        <label>Zacetno stevilo rastlin
          <input name="plantCount" type="number" min="1" max="400" value="${defaults.food.initialCount}" />
        </label>
        <label>Dodatna rast na korak
          <input name="plantRespawn" type="number" min="0" max="8" step="0.1" value="${defaults.food.respawnPerTick}" />
        </label>
        <label>Hranilna vrednost
          <input name="plantNutrition" type="number" min="5" max="120" step="1" value="${defaults.food.energyGain}" />
        </label>
        <label>Teren za rastline
          <select name="plantTerrain" multiple>
            <option value="grass"${defaults.food.spawnTerrain.includes('grass') ? ' selected' : ''}>Trava</option>
            <option value="forest"${defaults.food.spawnTerrain.includes('forest') ? ' selected' : ''}>Gozd</option>
            <option value="sand"${defaults.food.spawnTerrain.includes('sand') ? ' selected' : ''}>Pesek</option>
          </select>
        </label>
        <label>Verjetnost mutacije
          <input name="mutationChance" type="number" min="0" max="1" step="0.01" value="${defaults.mutation.chance}" />
        </label>
        <label>Jacina mutacije
          <input name="mutationAmount" type="number" min="0.01" max="0.8" step="0.01" value="${defaults.mutation.amount}" />
        </label>
        <label>Casovni korak
          <input name="tickSeconds" type="number" min="0.01" max="0.2" step="0.01" value="${defaults.timing.tickSeconds}" />
        </label>
        <label>Hitrost simulacije
          <input name="simulationSpeed" type="number" min="0.25" max="6" step="0.25" value="${defaults.timing.simulationSpeed}" />
        </label>
      </section>

      <section class="formula-card">
        <h3>Pravila simulacije</h3>
        <p>Bitje ima tri glavne potrebe: razmnozevanje, zejo in lakoto. Ce je potreba po razmnozevanju dovolj velika, najprej isce partnerja.</p>
        <p>Voda je neprehodna. Bitje lahko pije ob vodi, ne da bi slo v vodo. Ko je bolj lacno, se hitreje poveca tudi potreba po vodi.</p>
        <p>Lisica lovi zajca, zajec pa isce rastline in bezi pred lisicami. Za razmnozevanje sta potrebna samec in samica.</p>
        <p>Hitrost vpliva predvsem na zejo, velikost pa predvsem na lakoto. Vecji partner ima prednost pri izbiri.</p>
        <p>Potomec deduje lastnosti od starsev, nato pa se uporabita variacija in morebitna mutacija. Teren je lahko izbran iz 4 predlog ali generiran s Perlinovim sumom.</p>
      </section>

      <section class="actions">
        <button id="start-reset-btn">Zazeni / Ponastavi</button>
        <button id="center-camera-btn" type="button">Ponastavi pogled</button>
        <p id="status-text">Pripravljen.</p>
        <p id="totals-text">Lisice: 0 | Zajci: 0</p>
        <p id="summary-text">Povzetek simulacije bo prikazan tukaj.</p>
      </section>
    </section>
  `;
}
