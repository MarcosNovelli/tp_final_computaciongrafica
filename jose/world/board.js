/**
 * ============================================================
 * world/board.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define la abstracción "Board" (tablero de tiles).
 * Un Board maneja múltiples tiles organizados en una grilla hexagonal tipo Catan.
 * 
 * Un Board:
 * - Crea y organiza múltiples tiles en una grilla hexagonal (boardRadius)
 * - Asigna un bioma a cada tile (aleatorio uniforme, cambia en cada recarga)
 * - Calcula las posiciones (offsets) de cada tile usando coordenadas hexagonales
 * - Genera todos los tiles con variación individual (cada tile del mismo bioma es diferente)
 * - Proporciona acceso a todas las celdas y objetos de todos los tiles
 * 
 * LAYOUT TIPO CATAN:
 * Los tiles se organizan como hexágonos grandes en una grilla hexagonal.
 * Cada tile tiene coordenadas hexagonales (qTile, rTile) y se posiciona usando
 * la misma lógica que se usa para posicionar hexágonos pequeños dentro de un tile.
 * Los hexágonos están en orientación FLAT-TOP (lados planos horizontales), lo que
 * garantiza que los LADOS de los tiles se toquen directamente, creando un mosaico
 * perfecto sin huecos, como las losetas de Catan.
 * 
 * DEPENDENCIAS:
 * - Requiere que createTile() esté disponible (definida en world/tile.js)
 * - Requiere que hexToPixel3D() esté disponible (definida en main.js)
 * - Requiere que getActiveBiome() y todos los biomas estén disponibles (definidos en main.js)
 * - Requiere que GRID_RADIUS y HEX_RADIUS_WORLD estén disponibles (definidos en main.js)
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

/**
 * Calcula la distancia hexagonal entre dos coordenadas axiales.
 * 
 * @param {number} q1 - Coordenada q del primer hexágono
 * @param {number} r1 - Coordenada r del primer hexágono
 * @param {number} q2 - Coordenada q del segundo hexágono
 * @param {number} r2 - Coordenada r del segundo hexágono
 * @returns {number} Distancia hexagonal
 */
function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

/**
 * Crea un nuevo Board (tablero de tiles).
 * 
 * Un Board organiza múltiples tiles en una grilla hexagonal tipo Catan.
 * Cada tile es un "hexágono grande" (una grilla hexagonal completa) con su propio bioma.
 * 
 * TAMAÑO 5×5:
 * El tablero genera exactamente 25 tiles organizados en una grilla hexagonal.
 * Para un tablero 5×5, usamos un radio hexagonal de 2 desde el centro (0, 0),
 * lo que genera aproximadamente 25 tiles (1 centro + 6 en radio 1 + 18 en radio 2).
 * 
 * @param {number} boardWidth - Número de tiles en el eje X (columnas) - debe ser 5
 * @param {number} boardHeight - Número de tiles en el eje Y (filas) - debe ser 5
 * @param {Object} baseNoiseGenerator - Generador de ruido Simplex base (opcional)
 * @returns {Object} Objeto Board con métodos generate(), getAllCells(), getAllObjectInstances()
 */
function createBoard(boardWidth = 5, boardHeight = 5, baseNoiseGenerator = null) {
  const tiles = [];
  let generated = false;
  const sqrt3 = Math.sqrt(3);
  
  // Medidas reales de un tile en el mundo (se calculan una sola vez y se reutilizan)
  // Ajustadas para que los tiles grandes toquen lado con lado (mismo encaje que las celdas pequeñas).
  // - tileHexSize: radio a vértice del tile grande (suma del radio de todas las celdas en una dirección)
  // - tileSpacing: distancia centro a centro entre tiles adyacentes (face-to-face)
  // - tileApothem: distancia del centro del tile a un lado plano
  const tileHexSize = 2 * (GRID_RADIUS + 0.5) * HEX_RADIUS_WORLD;
  const tileSpacing = tileHexSize * sqrt3;                // spacing plano a plano (flat-top)
  const tileApothem = tileSpacing * 0.5;                  // distancia a un lado
  const tileDiameter = tileSpacing;                       // de lado a lado
  
  /**
   * Calcula el tamaño del hexágono individual para posicionar tiles usando la misma lógica de hexágonos pequeños.
   * 
   * LÓGICA UNIFICADA: REUTILIZAR hexToPixel3D SIN CONSTANTES INVENTADAS
   * 
   * Dentro de cada tile, los hexágonos pequeños se posicionan usando:
   *   hexToPixel3D(q, r, HEX_RADIUS_WORLD)
   * 
   * Donde (q, r) son coordenadas hexagonales desde -GRID_RADIUS hasta GRID_RADIUS.
   * El hexágono más lejano del centro tiene coordenadas aproximadamente (GRID_RADIUS, 0).
   * 
   * La posición del hexágono más lejano es:
   *   pos = hexToPixel3D(GRID_RADIUS, 0, HEX_RADIUS_WORLD)
   *   pos.x = HEX_RADIUS_WORLD * sqrt(3) * GRID_RADIUS
   * 
   * Por lo tanto, el RADIO de un tile (distancia del centro al hexágono más lejano) es:
   *   tileRadius = HEX_RADIUS_WORLD * sqrt(3) * GRID_RADIUS
   * 
   * Y el DIÁMETRO de un tile (de un borde al borde opuesto) es:
   *   tileDiameter = 2 * tileRadius = 2 * HEX_RADIUS_WORLD * sqrt(3) * GRID_RADIUS
   * 
   * POSICIONAMIENTO DE TILES:
   * Para posicionar tiles en una grilla hexagonal, usamos la misma función hexToPixel3D:
   *   hexToPixel3D(qTile, rTile, tileHexSize)
   * 
   * La distancia entre centros de hexágonos adyacentes usando hexToPixel3D es:
   *   distance = tileHexSize * sqrt(3)
   * 
   * Para que dos tiles se toquen perfectamente, esta distancia debe ser igual al diámetro:
   *   tileHexSize * sqrt(3) = 2 * HEX_RADIUS_WORLD * sqrt(3) * GRID_RADIUS
   *   tileHexSize = 2 * HEX_RADIUS_WORLD * GRID_RADIUS
   * 
   * CÁLCULO DEL TAMAÑO EFECTIVO DE UN TILE:
   * - Radio en celdas: GRID_RADIUS hexágonos desde el centro
   * - Radio en unidades del mundo: HEX_RADIUS_WORLD * sqrt(3) * GRID_RADIUS
   * - Diámetro en unidades del mundo: 2 * HEX_RADIUS_WORLD * sqrt(3) * GRID_RADIUS
   * 
   * SEPARACIÓN ENTRE TILES:
   * - Distancia entre centros de tiles adyacentes: tileHexSize * sqrt(3) = 2 * HEX_RADIUS_WORLD * sqrt(3) * GRID_RADIUS
   * - Esta distancia es exactamente igual al diámetro del tile, garantizando que se toquen sin solaparse
   * 
   * @returns {number} Tamaño del hexágono individual en la grilla de tiles (para usar en hexToPixel3D)
   */
  function getTileHexSize() {
    return tileHexSize;
  }
  
  /**
   * Crea un generador de ruido con offset específico para un tile.
   * 
   * VARIACIÓN ENTRE TILES DEL MISMO BIOMA:
   * Cada tile necesita su propio generador de ruido con un offset diferente
   * para que tiles del mismo bioma tengan relieves y distribuciones diferentes.
   * 
   * El offset se deriva de las coordenadas hexagonales (qTile, rTile) del tile.
   * Esto hace que cada posición tenga un patrón de ruido único pero determinístico.
   * 
   * El offset se aplica como un desplazamiento grande en el espacio de ruido,
   * asegurando que cada tile tenga un terreno completamente diferente.
   * 
   * @param {number} qTile - Coordenada hexagonal q del tile
   * @param {number} rTile - Coordenada hexagonal r del tile
   * @param {Object} baseGenerator - Generador base (si es null, se crea uno nuevo)
   * @returns {Object} Generador de ruido con wrapper que aplica offset
   */
  function createTileNoiseGenerator(qTile, rTile, baseGenerator) {
    // Offset grande para variación significativa entre tiles
    // Multiplicamos por un factor grande (1000) para asegurar que cada tile tenga un patrón único
    const noiseOffsetX = qTile * 1000.0;
    const noiseOffsetZ = rTile * 1000.0;
    
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
      noise2D: function(x, z) {
        // Aplicar offset a las coordenadas para que cada tile tenga un patrón único
        return baseGenerator.noise2D(x + noiseOffsetX, z + noiseOffsetZ);
      },
      offsetX: noiseOffsetX,
      offsetZ: noiseOffsetZ
    };
  }
  
  /**
   * Asigna un bioma a un tile de forma aleatoria y uniforme.
   * 
   * ELECCIÓN ALEATORIA UNIFORME DE BIOMAS:
   * Cada tile recibe un bioma elegido aleatoriamente de la lista disponible.
   * La elección es completamente aleatoria (usa Math.random()) y uniforme,
   * lo que significa que cada bioma tiene la misma probabilidad de aparecer.
   * 
   * IMPORTANTE: La elección cambia en cada recarga de la página.
   * No hay patrón fijo ni semilla determinística para la elección de biomas.
   * 
   * @param {number} qTile - Coordenada hexagonal q del tile (no se usa para elección de bioma)
   * @param {number} rTile - Coordenada hexagonal r del tile (no se usa para elección de bioma)
   * @returns {Object} Objeto bioma asignado aleatoriamente
   */
  function assignBiomeToTile(qTile, rTile) {
    const availableBiomes = getAvailableBiomes();
    if (availableBiomes.length === 0) {
      console.warn('No hay biomas disponibles, usando grassBiome por defecto');
      return typeof grassBiome !== 'undefined' ? grassBiome : null;
    }
    
    // ELECCIÓN ALEATORIA UNIFORME:
    // Usar Math.random() para selección completamente aleatoria
    // Cada tile tiene la misma probabilidad de recibir cualquier bioma
    const random = Math.random();
    const biomeIndex = Math.floor(random * availableBiomes.length);
    return availableBiomes[biomeIndex];
  }
  
  /**
   * Calcula el offset de posición global para un tile usando coordenadas hexagonales.
   * 
   * CORRECCIÓN DE ROTACIÓN PARA ENCAJE PERFECTO:
   * 
   * Los hexágonos pequeños dentro de cada tile están en orientación "pointy-top" con un
   * angleOffset de Math.PI/6 (30 grados) para que un vértice apunte hacia arriba.
   * 
   * La función hexToPixel3D usa la fórmula estándar para pointy-top, que asume que
   * los hexágonos están orientados con sus vértices en dirección +Z.
   * 
   * Para que los tiles encajen perfectamente tipo Catan, necesitamos asegurar que:
   * 1. El espaciado entre tiles sea correcto (ya corregido en getTileHexSize)
   * 2. La orientación relativa de los tiles coincida con la orientación de los hexágonos
   * 
   * IMPORTANTE: No rotamos los tiles (eso afectaría todo el contenido), sino que
   * aseguramos que la fórmula de posicionamiento sea consistente con la orientación
   * pointy-top de los hexágonos individuales.
   * 
   * La fórmula hexToPixel3D ya está diseñada para pointy-top, así que debería funcionar
   * correctamente. Sin embargo, para encaje tipo Catan, verificamos que:
   * - Los tiles se posicionan usando la misma lógica que los hexágonos pequeños
   * - El espaciado está basado en el tamaño real del tile (incluyendo el radio de los hexágonos)
   * 
   * REUTILIZACIÓN DIRECTA DE LA LÓGICA DE HEXÁGONOS PEQUEÑOS:
   * 
   * Cada tile se trata como un "hexágono grande" con coordenadas hexagonales (qTile, rTile).
   * Para posicionarlo en el mundo, usamos EXACTAMENTE la misma función hexToPixel3D()
   * que se usa para posicionar hexágonos pequeños dentro de un tile.
   * 
   * La única diferencia es el tamaño: en lugar de HEX_RADIUS_WORLD (tamaño de un hexágono pequeño),
   * usamos tileHexSize (tamaño de un "hexágono individual" en la grilla de tiles).
   * 
   * La fórmula es:
   *   pos = hexToPixel3D(qTile, rTile, tileHexSize)
   * 
   * Donde:
   * - (qTile, rTile): coordenadas hexagonales del tile en el tablero
   * - tileHexSize: tamaño escalado, calculado para que los tiles se toquen perfectamente
   * 
   * CONSISTENCIA: OFFSET ÚNICO PARA TODO EL CONTENIDO
   * 
   * Este offset se aplica de forma unificada:
   * 1. Se calcula aquí: calculateTileOffset(qTile, rTile)
   * 2. Se pasa a createTile(biome, offsetX, offsetZ, ...)
   * 3. En tile.js, se aplica a TODAS las celdas: cell.worldX += offsetX, cell.worldZ += offsetZ
   * 4. Los objetos (árboles, ovejas, trigo) usan directamente cell.worldX/worldZ
   * 
   * NO HAY OFFSETS ADICIONALES:
   * - El terreno usa este offset (a través de cell.worldX/worldZ)
   * - Los objetos usan el mismo offset (a través de cell.worldX/worldZ)
   * - No hay fórmulas separadas ni constantes inventadas
   * 
   * @param {number} qTile - Coordenada hexagonal q del tile en el tablero
   * @param {number} rTile - Coordenada hexagonal r del tile en el tablero
   * @returns {Object} Objeto con { x, z } - offset de posición global del tile
   */
  function calculateTileOffset(qTile, rTile) {
    const pos = hexToPixel3D(qTile, rTile, tileHexSize);
    return { x: pos.x, z: pos.z };
  }
  
  /**
   * Genera todos los tiles del tablero en una grilla hexagonal.
   * 
   * TAMAÑO 5×5:
   * Para generar exactamente 25 tiles en un patrón hexagonal, usamos un radio de 2
   * desde el centro (0, 0). Esto genera:
   * - 1 tile en el centro (q=0, r=0)
   * - 6 tiles en radio 1
   * - 18 tiles en radio 2
   * Total: 25 tiles (aproximadamente 5×5 visualmente)
   * 
   * Esta función:
   * 1. Itera sobre todas las coordenadas hexagonales dentro del radio
   * 2. Asigna un bioma aleatorio a cada tile
   * 3. Crea un generador de ruido único para cada tile (con offset)
   * 4. Calcula el offset de posición usando coordenadas hexagonales
   * 5. Genera el contenido de cada tile
   */
  function generate() {
    if (generated) {
      console.warn('Board ya generado, ignorando llamada a generate()');
      return;
    }
    
    // Crear tablero automático: grilla rectangular axial centrada, tiles tocando lados
    const layout = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    
    for (let qTile = 0; qTile < boardWidth; qTile++) {
      for (let rTile = 0; rTile < boardHeight; rTile++) {
        const pos = calculateTileOffset(qTile, rTile);
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minZ = Math.min(minZ, pos.z);
        maxZ = Math.max(maxZ, pos.z);
        layout.push({ qTile, rTile, x: pos.x, z: pos.z });
      }
    }
    
    // Centrar el layout alrededor del origen
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    for (const entry of layout) {
      entry.x -= centerX;
      entry.z -= centerZ;
    }
    
    console.log(`✓ Creando tablero automático (${boardWidth}×${boardHeight} tiles)`);
    console.log(`  - Tamaño de un hexágono pequeño: ${HEX_RADIUS_WORLD.toFixed(2)}`);
    console.log(`  - Radio del tile (hexSteps): ${GRID_RADIUS}`);
    console.log(`  - Apotema del tile: ${tileApothem.toFixed(2)}`);
    console.log(`  - Diámetro del tile (borde a borde): ${tileDiameter.toFixed(2)}`);
    console.log(`  - Distancia entre centros de tiles adyacentes: ${tileSpacing.toFixed(2)}`);
    
    for (const entry of layout) {
      const { qTile, rTile, x, z } = entry;
      const biome = assignBiomeToTile(qTile, rTile);
      const tileNoiseGenerator = createTileNoiseGenerator(qTile, rTile, baseNoiseGenerator);
      const tile = createTile(biome, x, z, tileNoiseGenerator);
      tile.generate();
      tiles.push({
        tile: tile,
        qTile: qTile,
        rTile: rTile,
        biome: biome
      });
    }
    
    generated = true;
    console.log(`✓ Tablero generado: ${tiles.length} tiles colocados automáticamente (tocando lados)`);
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
      qTile: t.qTile,
      rTile: t.rTile,
      biome: t.biome.name,
      offset: t.tile.getOffset()
    }));
  }
  
  /**
   * Retorna el tamaño del tablero en unidades de mundo.
   * Útil para calcular la posición inicial de la cámara.
   * 
   * @returns {Object} Objeto con { width, height } en unidades de mundo
   */
  function getBoardSize() {
    // Calcular bounds reales a partir del layout generado
    // (si no está generado aún, generar para obtener bounds)
    if (!generated) {
      console.warn('Board no generado, llamando generate() automáticamente para calcular tamaño');
      generate();
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const t of tiles) {
      const offset = t.tile.getOffset();
      minX = Math.min(minX, offset.x);
      maxX = Math.max(maxX, offset.x);
      minZ = Math.min(minZ, offset.z);
      maxZ = Math.max(maxZ, offset.z);
    }
    const halfExtentX = Math.max(Math.abs(minX), Math.abs(maxX)) + tileApothem;
    const halfExtentZ = Math.max(Math.abs(minZ), Math.abs(maxZ)) + tileApothem;
    const boardSize = Math.max(halfExtentX, halfExtentZ) * 2;
    return {
      width: boardSize,
      height: boardSize
    };
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
