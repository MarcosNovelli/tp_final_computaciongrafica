/**
 * ============================================================
 * world/board.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define la abstracción "Board" (tablero de tiles).
 * Un Board maneja múltiples tiles con posicionamiento MANUAL.
 * 
 * Un Board:
 * - Crea y organiza múltiples tiles según configuraciones manuales
 * - Cada tile se define por su posición (x, z) del centroide
 * - Puede asignar biomas manualmente o aleatoriamente
 * - Genera todos los tiles con variación individual (cada tile del mismo bioma es diferente)
 * - Proporciona acceso a todas las celdas y objetos de todos los tiles
 * 
 * POSICIONAMIENTO MANUAL:
 * El usuario define explícitamente dónde está cada tile especificando
 * la posición (x, z) de su centro. No hay fórmulas automáticas ni coordenadas hexagonales.
 * 
 * FORMATO DE CONFIGURACIÓN DE TILES:
 * tilesConfig = [
 *   { x: 0, z: 0, biome: "Grass" },  // Tile en el origen con bioma Grass
 *   { x: 50, z: 0 },                  // Tile en (50, 0) con bioma aleatorio
 *   { x: 0, z: 50, biome: "Forest" }  // Tile en (0, 50) con bioma Forest
 * ]
 * 
 * DEPENDENCIAS:
 * - Requiere que createTile() esté disponible (definida en world/tile.js)
 * - Requiere que getAvailableBiomes() esté disponible (definida en este archivo)
 * - Requiere que todos los biomas estén disponibles (definidos en main.js)
 * - Requiere que GRID_RADIUS esté disponible (definido en main.js)
 */

/**
 * Obtiene la lista de biomas disponibles para asignar a tiles del tablero.
 * Esta función se llama después de que todos los biomas estén cargados.
 * 
 * @returns {Array} Array de objetos bioma disponibles
 */
function getAvailableBiomes() {
  const biomes = [];
  // Agregar biomas solo si están definidos (pueden no estar todos disponibles)
  if (typeof grassBiome !== 'undefined') biomes.push(grassBiome);
  if (typeof forestBiome !== 'undefined') biomes.push(forestBiome);
  if (typeof rockBiome !== 'undefined') biomes.push(rockBiome);
  if (typeof clayBiome !== 'undefined') biomes.push(clayBiome);
  if (typeof wheatBiome !== 'undefined') biomes.push(wheatBiome);
  return biomes;
}

// Función hexDistance eliminada - ya no se usa con posicionamiento manual

/**
 * Crea un nuevo Board (tablero de tiles) con posicionamiento manual.
 * 
 * Un Board organiza múltiples tiles según las posiciones que el usuario define manualmente.
 * Cada tile se posiciona por su centroide (x, z) especificado en la configuración.
 * 
 * @param {Array} tilesConfig - Array de configuraciones de tiles. Cada elemento debe tener:
 *   - x: Posición X del centro del tile (requerido)
 *   - z: Posición Z del centro del tile (requerido)
 *   - biome: Nombre del bioma (opcional, si no se especifica se asigna aleatoriamente)
 *   - id: Identificador único del tile (opcional, para referencia)
 *   Ejemplo: [{ x: 0, z: 0, biome: "Grass" }, { x: 50, z: 0 }]
 * @param {Object} baseNoiseGenerator - Generador de ruido Simplex base (opcional)
 * @returns {Object} Objeto Board con métodos generate(), getAllCells(), getAllObjectInstances()
 */
function createBoard(tilesConfig = [], baseNoiseGenerator = null) {
  const tiles = [];
  let generated = false;
  
  /**
   * Obtiene un bioma por su nombre.
   * 
   * @param {string} biomeName - Nombre del bioma (ej: "Grass", "Forest", "Rock")
   * @returns {Object} Objeto bioma o null si no se encuentra
   */
  function getBiomeByName(biomeName) {
    if (!biomeName) return null;
    
    const biomeMap = {
      'Grass': typeof grassBiome !== 'undefined' ? grassBiome : null,
      'Forest': typeof forestBiome !== 'undefined' ? forestBiome : null,
      'Rock': typeof rockBiome !== 'undefined' ? rockBiome : null,
      'Clay': typeof clayBiome !== 'undefined' ? clayBiome : null,
      'Wheat': typeof wheatBiome !== 'undefined' ? wheatBiome : null,
      'Desert': typeof desertBiome !== 'undefined' ? desertBiome : null
    };
    
    return biomeMap[biomeName] || null;
  }
  
  /**
   * Crea un generador de ruido con offset específico para un tile basado en su posición.
   * 
   * VARIACIÓN ENTRE TILES DEL MISMO BIOMA:
   * Cada tile necesita su propio generador de ruido con un offset diferente
   * para que tiles del mismo bioma tengan relieves y distribuciones diferentes.
   * 
   * El offset se deriva de la posición (x, z) del tile.
   * Esto hace que cada posición tenga un patrón de ruido único pero determinístico.
   * 
   * @param {number} x - Posición X del centro del tile
   * @param {number} z - Posición Z del centro del tile
   * @param {Object} baseGenerator - Generador base (si es null, se crea uno nuevo)
   * @returns {Object} Generador de ruido con wrapper que aplica offset
   */
  function createTileNoiseGenerator(x, z, baseGenerator) {
    // Offset grande para variación significativa entre tiles
    // Multiplicamos por un factor grande (1000) para asegurar que cada tile tenga un patrón único
    // Usamos la posición (x, z) como base para el offset
    const noiseOffsetX = x * 1000.0;
    const noiseOffsetZ = z * 1000.0;
    
    // Si no hay generador base, crear uno nuevo (el tile lo hará internamente)
    if (!baseGenerator) {
      return {
        noise2D: null, // Será creado por createCells
        offsetX: noiseOffsetX,
        offsetZ: noiseOffsetZ
      };
    }
    
    // Crear wrapper que aplica el offset a las coordenadas antes de evaluar el ruido
    return {
      noise2D: function(noiseX, noiseZ) {
        // Aplicar offset a las coordenadas para que cada tile tenga un patrón único
        return baseGenerator.noise2D(noiseX + noiseOffsetX, noiseZ + noiseOffsetZ);
      },
      offsetX: noiseOffsetX,
      offsetZ: noiseOffsetZ
    };
  }
  
  /**
   * Crea una lista balanceada de biomas para asignar a tiles.
   * 
   * Esta función crea una lista donde cada bioma aparece aproximadamente
   * la misma cantidad de veces, garantizando que la diferencia máxima
   * entre cualquier par de biomas sea como máximo 1.
   * 
   * @param {number} numTiles - Número total de tiles que necesitan biomas
   * @param {Array} availableBiomes - Array de biomas disponibles
   * @returns {Array} Lista de biomas balanceada y mezclada aleatoriamente
   */
  function createBalancedBiomeList(numTiles, availableBiomes) {
    if (availableBiomes.length === 0) {
      return [];
    }
    
    // Calcular cuántas veces debe aparecer cada bioma
    const biomesPerType = Math.floor(numTiles / availableBiomes.length);
    const remainder = numTiles % availableBiomes.length;
    
    // Crear lista balanceada
    const balancedList = [];
    
    // Agregar biomesPerType copias de cada bioma
    for (const biome of availableBiomes) {
      for (let i = 0; i < biomesPerType; i++) {
        balancedList.push(biome);
      }
    }
    
    // Agregar los biomas restantes (hasta remainder) para que el total sea exactamente numTiles
    // Esto asegura que la diferencia máxima sea 1
    for (let i = 0; i < remainder; i++) {
      balancedList.push(availableBiomes[i]);
    }
    
    // Mezclar aleatoriamente la lista para que no estén todos agrupados
    // Algoritmo Fisher-Yates shuffle
    for (let i = balancedList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [balancedList[i], balancedList[j]] = [balancedList[j], balancedList[i]];
    }
    
    return balancedList;
  }
  
  /**
   * Genera todos los tiles del tablero según la configuración manual proporcionada.
   * 
   * Esta función:
   * 1. Cuenta cuántos tiles necesitan bioma aleatorio (sin especificar)
   * 2. Crea una lista balanceada de biomas para esos tiles
   * 3. Itera sobre cada configuración de tile en tilesConfig
   * 4. Asigna un bioma (manual o de la lista balanceada)
   * 5. Crea un generador de ruido único para cada tile (basado en su posición)
   * 6. Genera el contenido de cada tile en la posición especificada
   */
  function generate() {
    if (generated) {
      console.warn('Board ya generado, ignorando llamada a generate()');
      return;
    }
    
    if (!tilesConfig || tilesConfig.length === 0) {
      console.warn('No hay configuración de tiles, creando tablero vacío');
      generated = true;
      return;
    }
    
    console.log(`✓ Creando tablero con ${tilesConfig.length} tiles (posicionamiento manual)`);
    
    // Paso 1: Contar cuántos tiles necesitan bioma aleatorio (sin especificar)
    let tilesNeedingBiome = 0;
    for (const config of tilesConfig) {
      if (!config.biome || config.biome === '') {
        tilesNeedingBiome++;
      }
    }
    
    // Paso 2: Crear lista balanceada de biomas para los tiles que no tienen bioma especificado
    const availableBiomes = getAvailableBiomes();
    let balancedBiomeList = [];
    let biomeListIndex = 0;
    
    if (tilesNeedingBiome > 0 && availableBiomes.length > 0) {
      balancedBiomeList = createBalancedBiomeList(tilesNeedingBiome, availableBiomes);
      console.log(`✓ Lista balanceada de biomas creada: ${tilesNeedingBiome} tiles, ${availableBiomes.length} biomas disponibles`);
      console.log(`  Cada bioma aparecerá ${Math.floor(tilesNeedingBiome / availableBiomes.length)}-${Math.ceil(tilesNeedingBiome / availableBiomes.length)} veces`);
    }
    
    // Paso 3: Iterar sobre cada configuración de tile
    for (let i = 0; i < tilesConfig.length; i++) {
      const config = tilesConfig[i];
      
      // Validar que tenga posición (x, z)
      if (typeof config.x !== 'number' || typeof config.z !== 'number') {
        console.warn(`Tile ${i}: posición inválida (x: ${config.x}, z: ${config.z}), saltando`);
        continue;
      }
      
      const tileX = config.x;
      const tileZ = config.z;
      const tileId = config.id || `tile_${i}`;
      
      // Asignar bioma: usar el especificado o de la lista balanceada
      let biome;
      if (config.biome && config.biome !== '') {
        biome = getBiomeByName(config.biome);
        if (!biome) {
          console.warn(`Tile ${tileId}: bioma "${config.biome}" no encontrado, usando de lista balanceada`);
          // Si el bioma especificado no existe, usar de la lista balanceada
          if (biomeListIndex < balancedBiomeList.length) {
            biome = balancedBiomeList[biomeListIndex++];
          } else {
            // Fallback: bioma aleatorio si la lista se agotó
            biome = availableBiomes.length > 0 ? 
              availableBiomes[Math.floor(Math.random() * availableBiomes.length)] : 
              (typeof grassBiome !== 'undefined' ? grassBiome : null);
          }
        }
      } else {
        // Usar bioma de la lista balanceada
        if (biomeListIndex < balancedBiomeList.length) {
          biome = balancedBiomeList[biomeListIndex++];
        } else {
          // Fallback: bioma aleatorio si la lista se agotó (no debería pasar)
          biome = availableBiomes.length > 0 ? 
            availableBiomes[Math.floor(Math.random() * availableBiomes.length)] : 
            (typeof grassBiome !== 'undefined' ? grassBiome : null);
        }
      }
      
      if (!biome) {
        console.warn(`Tile ${tileId}: no se pudo asignar bioma, saltando`);
        continue;
      }
      
      // Crear generador de ruido único para este tile (basado en su posición)
      const tileNoiseGenerator = createTileNoiseGenerator(tileX, tileZ, baseNoiseGenerator);
      
      // Crear el tile en la posición especificada
      const tile = createTile(biome, tileX, tileZ, tileNoiseGenerator);
      
      // Generar el contenido del tile
      tile.generate();
      
      // Guardar el tile
      tiles.push({
        tile: tile,
        id: tileId,
        x: tileX,
        z: tileZ,
        biome: biome
      });
      
      console.log(`  ✓ Tile ${tileId}: ${biome.name || 'Unknown'} en (${tileX.toFixed(1)}, ${tileZ.toFixed(1)})`);
    }
    
    // Mostrar estadísticas de distribución de biomas
    const biomeCounts = {};
    for (const tileData of tiles) {
      const biomeName = tileData.biome ? tileData.biome.name : 'Unknown';
      biomeCounts[biomeName] = (biomeCounts[biomeName] || 0) + 1;
    }
    
    console.log('✓ Distribución de biomas:');
    for (const [biomeName, count] of Object.entries(biomeCounts)) {
      console.log(`  - ${biomeName}: ${count} tiles`);
    }
    
    // Verificar que la diferencia máxima sea ≤ 1
    const counts = Object.values(biomeCounts);
    if (counts.length > 0) {
      const minCount = Math.min(...counts);
      const maxCount = Math.max(...counts);
      const maxDifference = maxCount - minCount;
      if (maxDifference <= 1) {
        console.log(`✓ Balance correcto: diferencia máxima = ${maxDifference} (≤ 1)`);
      } else {
        console.warn(`⚠ Balance desbalanceado: diferencia máxima = ${maxDifference} (> 1)`);
      }
    }
    
    generated = true;
    console.log(`✓ Tablero generado: ${tiles.length} tiles creados`);
  }
  
  /**
   * Retorna todas las celdas de todos los tiles del tablero.
   * 
   * @returns {Array} Array combinado de todas las celdas de todos los tiles
   */
  function getAllCells() {
    if (!generated) {
      console.warn('Board no generado, llamando generate() automáticamente');
      generate();
    }
    
    const allCells = [];
    for (const tileData of tiles) {
      const cells = tileData.tile.getCells();
      allCells.push(...cells);
    }
    return allCells;
  }
  
  /**
   * Retorna todas las instancias de objetos de todos los tiles del tablero.
   * 
   * @returns {Object} Objeto con { treeInstances, sheepInstances, wheatInstances } combinados
   */
  function getAllObjectInstances() {
    if (!generated) {
      console.warn('Board no generado, llamando generate() automáticamente');
      generate();
    }
    
    const allTreeInstances = [];
    const allSheepInstances = [];
    const allWheatInstances = [];
    
    for (const tileData of tiles) {
      const objects = tileData.tile.getObjectInstances();
      allTreeInstances.push(...objects.treeInstances);
      allSheepInstances.push(...objects.sheepInstances);
      allWheatInstances.push(...objects.wheatInstances);
    }
    
    return {
      treeInstances: allTreeInstances,
      sheepInstances: allSheepInstances,
      wheatInstances: allWheatInstances
    };
  }
  
  /**
   * Retorna información sobre los tiles del tablero.
   * 
   * @returns {Array} Array de objetos con información de cada tile
   */
  function getTilesInfo() {
    if (!generated) {
      console.warn('Board no generado, llamando generate() automáticamente');
      generate();
    }
    return tiles.map(t => ({
      id: t.id,
      x: t.x,
      z: t.z,
      biome: t.biome ? t.biome.name : 'Unknown',
      offset: t.tile.getOffset()
    }));
  }
  
  /**
   * Retorna el tamaño del tablero en unidades de mundo.
   * Calcula un bounding box que contiene todos los tiles.
   * Útil para calcular la posición inicial de la cámara.
   * 
   * @returns {Object} Objeto con { width, height } en unidades de mundo
   */
  function getBoardSize() {
    if (!generated || tiles.length === 0) {
      // Si no hay tiles generados, retornar tamaño por defecto
      return { width: 100, height: 100 };
    }
    
    // Calcular bounding box de todos los tiles
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (const tileData of tiles) {
      const offset = tileData.tile.getOffset();
      // Aproximar el radio de un tile (distancia del centro al borde)
      // Cada tile tiene GRID_RADIUS hexágonos desde el centro
      const sqrt3 = Math.sqrt(3);
      const tileRadius = HEX_RADIUS_WORLD * sqrt3 * GRID_RADIUS + HEX_RADIUS_WORLD;
      
      minX = Math.min(minX, offset.x - tileRadius);
      maxX = Math.max(maxX, offset.x + tileRadius);
      minZ = Math.min(minZ, offset.z - tileRadius);
      maxZ = Math.max(maxZ, offset.z + tileRadius);
    }
    
    const width = maxX - minX;
    const height = maxZ - minZ;
    
    return { width, height };
  }
  
  // Retornar interfaz pública del Board
  return {
    generate: generate,
    getAllCells: getAllCells,
    getAllObjectInstances: getAllObjectInstances,
    getTilesInfo: getTilesInfo,
    getBoardSize: getBoardSize
  };
}
