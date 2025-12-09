/**
 * ============================================================
 * world/tile.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define la abstracción "Tile" (isla/chunk hexagonal).
 * Un Tile representa una isla hexagonal completa con su terreno, objetos y propiedades.
 * 
 * Un Tile encapsula:
 * - Qué bioma usa
 * - Qué celdas hexagonales lo componen
 * - Qué árboles, ovejas, trigo y agua tiene
 * - Su posición en el mundo (offset global)
 * 
 * OPERACIONES:
 * - generate(): Genera el tile (crea altura, colores, props, objetos)
 * - getCells(): Retorna las celdas del tile
 * - getObjectInstances(): Retorna los objetos (árboles, ovejas, trigo)
 * - getOffset(): Retorna el offset de posición del tile en el mundo
 * 
 * IMPORTANTE: OFFSET GLOBAL DEL TILE
 * El offset se aplica a las celdas ANTES de generar los objetos.
 * Los objetos usan directamente worldX/worldZ de las celdas ya desplazadas,
 * por lo que NO necesitan un offset adicional.
 * 
 * DEPENDENCIAS:
 * - Requiere que createCells(), createTreeInstances(), createSheepInstances(), 
 *   createWheatInstances() estén disponibles (definidas en main.js)
 * - Requiere que GRID_RADIUS y HEX_RADIUS_WORLD estén disponibles (definidas en main.js)
 */

/**
 * Crea un nuevo Tile (isla hexagonal).
 * Un Tile representa una isla completa con su terreno, objetos y posición global.
 */
function createTile(biome, offsetX = 0, offsetZ = 0, noiseGenerator = null) {
  // Estado interno del tile
  let cells = [];
  let treeInstances = [];
  let sheepInstances = [];
  let wheatInstances = [];
  let generated = false;
  
  /**
   * Genera el contenido del tile (celdas, objetos, etc.).
   */
  function generate() {
    if (generated) {
      return;
    }
    
    cells = createCells(biome, noiseGenerator);
    
    // Aplicar offset de posición a todas las celdas
    for (const cell of cells) {
      cell.worldX += offsetX;
      cell.worldZ += offsetZ;
    }
    
    // Generar objetos usando las celdas ya desplazadas
    treeInstances = createTreeInstances(cells, biome);
    sheepInstances = createSheepInstances(cells, biome);
    wheatInstances = createWheatInstances(cells, biome);
    
    generated = true;
  }
  
  /**
   * Retorna las celdas del tile.
   * 
   * @returns {Array} Array de celdas con formato { q, r, worldX, worldZ, height, color, biome, ... }
   */
  function getCells() {
    if (!generated) {
      generate();
    }
    return cells;
  }
  
  function getObjectInstances() {
    if (!generated) {
      generate();
    }
    return {
      treeInstances: treeInstances,
      sheepInstances: sheepInstances,
      wheatInstances: wheatInstances
    };
  }
  
  /**
   * Retorna el offset de posición del tile en el mundo.
   * 
   * @returns {Object} Objeto con { x, z }
   */
  function getOffset() {
    return { x: offsetX, z: offsetZ };
  }
  
  /**
   * Retorna el bioma asignado a este tile.
   * 
   * @returns {Object} Objeto bioma
   */
  function getBiome() {
    return biome;
  }
  
  // Retornar interfaz pública del Tile
  return {
    generate: generate,
    getCells: getCells,
    getObjectInstances: getObjectInstances,
    getOffset: getOffset,
    getBiome: getBiome
  };
}
