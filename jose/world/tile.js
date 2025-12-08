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
 * 
 * Un Tile es una unidad independiente que representa una isla completa:
 * - Tiene su propio bioma asignado
 * - Genera su propio terreno (celdas hexagonales)
 * - Genera sus propios objetos (árboles, ovejas, trigo)
 * - Tiene una posición global (offset) en el mundo
 * 
 * @param {Object} biome - Bioma asignado a este tile (grassBiome, forestBiome, etc.)
 * @param {number} offsetX - Offset en X del tile en el mundo (posición global)
 * @param {number} offsetZ - Offset en Z del tile en el mundo (posición global)
 * @param {Object} noiseGenerator - Generador de ruido Simplex (puede tener offset aplicado)
 * @returns {Object} Objeto Tile con métodos generate(), getCells(), getObjectInstances(), getOffset()
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
   * 
   * FLUJO DE GENERACIÓN:
   * 1. Crea las celdas hexagonales usando createCells() (centradas en (0,0) localmente)
   * 2. Aplica el offset de posición a TODAS las celdas (worldX, worldZ)
   * 3. Genera objetos usando las celdas YA DESPLAZADAS (usan worldX/worldZ directamente)
   * 
   * IMPORTANTE: ALINEACIÓN DE OBJETOS
   * Los objetos se generan DESPUÉS de que las celdas tienen sus worldX/worldZ finales.
   * Las funciones createTreeInstances(), createSheepInstances(), createWheatInstances()
   * usan cell.worldX y cell.worldZ directamente, por lo que los objetos ya están
   * en la posición correcta global y NO necesitan un offset adicional.
   * 
   * Esta función debe llamarse antes de usar getCells() o getObjectInstances()
   */
  function generate() {
    if (generated) {
      console.warn('Tile ya generado, ignorando llamada a generate()');
      return;
    }
    
    // Paso 1: Generar celdas del tile usando la función existente createCells()
    // createCells() genera celdas centradas en (0, 0) en coordenadas locales del tile
    // El noiseGenerator puede tener un offset aplicado (para variación entre tiles)
    cells = createCells(biome, noiseGenerator);
    
    // Paso 2: Aplicar offset de posición a TODAS las celdas
    // Esto mueve todo el tile a su posición global en el mundo
    // IMPORTANTE: Esto se hace ANTES de generar los objetos para que los objetos
    // puedan usar directamente worldX/worldZ de las celdas ya desplazadas
    for (const cell of cells) {
      cell.worldX += offsetX;
      cell.worldZ += offsetZ;
    }
    
    // Paso 3: Generar objetos del tile usando las funciones existentes
    // CRÍTICO: Las celdas ya tienen worldX/worldZ desplazados (paso anterior)
    // Las funciones createTreeInstances(), createSheepInstances(), etc. usan
    // directamente cell.worldX y cell.worldZ, por lo que los objetos ya están
    // en la posición correcta y NO necesitan un offset adicional
    treeInstances = createTreeInstances(cells, biome);
    sheepInstances = createSheepInstances(cells, biome);
    wheatInstances = createWheatInstances(cells, biome);
    
    // NOTA: Ya NO aplicamos offset a las matrices modelo de los objetos porque
    // las celdas ya están desplazadas y los objetos se generan usando esas posiciones
    
    generated = true;
    console.log(`✓ Tile generado: ${biome.name || "Unknown"} en (${offsetX.toFixed(1)}, ${offsetZ.toFixed(1)}) - ${cells.length} celdas`);
  }
  
  /**
   * Retorna las celdas del tile.
   * 
   * @returns {Array} Array de celdas con formato { q, r, worldX, worldZ, height, color, biome, ... }
   */
  function getCells() {
    if (!generated) {
      console.warn('Tile no generado, llamando generate() automáticamente');
      generate();
    }
    return cells;
  }
  
  /**
   * Retorna todas las instancias de objetos del tile.
   * 
   * @returns {Object} Objeto con { treeInstances, sheepInstances, wheatInstances }
   */
  function getObjectInstances() {
    if (!generated) {
      console.warn('Tile no generado, llamando generate() automáticamente');
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
