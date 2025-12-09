/**
 * ============================================================
 * world/objects.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones para crear celdas y objetos del mundo.
 */

/**
 * Obtiene el bioma activo actual basado en la constante ACTIVE_BIOME.
 */
function getActiveBiome() {
  switch (ACTIVE_BIOME) {
    case "Forest":
      return forestBiome;
    case "Rock":
      return rockBiome;
    case "Clay":
      return clayBiome;
    case "Wheat":
      return wheatBiome;
    default:
      return grassBiome;
  }
}

/**
 * Crea la estructura de datos para representar las celdas de la grilla hexagonal.
 */
function createCells(biome, noiseGenerator = null) {
  const cells = [];
  
  const baseColor = biome.baseColor;
  const minHeight = biome.minHeight;
  const maxHeight = biome.maxHeight;
  const colorVariance = biome.colorVariance;
  
  let finalNoiseGenerator = noiseGenerator;
  let noiseOffsetX = 0;
  let noiseOffsetZ = 0;
  
  if (finalNoiseGenerator && finalNoiseGenerator.offsetX !== undefined && !finalNoiseGenerator.noise2D) {
    noiseOffsetX = finalNoiseGenerator.offsetX;
    noiseOffsetZ = finalNoiseGenerator.offsetZ;
    finalNoiseGenerator = null;
  }
  
  if (!finalNoiseGenerator || (finalNoiseGenerator && typeof finalNoiseGenerator.noise2D !== 'function')) {
    let noise2D = null;
    
    try {
      let SimplexNoiseModule = null;
      
      if (typeof window !== 'undefined' && window.SimplexNoise) {
        SimplexNoiseModule = window.SimplexNoise;
      } else if (typeof SimplexNoise !== 'undefined') {
        SimplexNoiseModule = SimplexNoise;
      } else if (typeof window !== 'undefined' && typeof window.createNoise2D === 'function') {
        noise2D = window.createNoise2D();
        console.log('✓ SimplexNoise cargado y funcionando (createNoise2D directo en window)');
      }
      
      if (SimplexNoiseModule && !noise2D) {
        if (typeof SimplexNoiseModule.createNoise2D === 'function') {
          noise2D = SimplexNoiseModule.createNoise2D();
          console.log('✓ SimplexNoise cargado y funcionando (API v3.x: createNoise2D)');
        } else if (typeof SimplexNoiseModule === 'function') {
          const simplex = new SimplexNoiseModule();
          noise2D = simplex.noise2D.bind(simplex);
          console.log('✓ SimplexNoise cargado y funcionando (API v2.x: constructor)');
        } else {
          throw new Error('SimplexNoise encontrado pero sin API reconocida');
        }
      }
      
      if (!noise2D || typeof noise2D !== 'function') {
        throw new Error('No se pudo crear la función noise2D');
      }
      
      const testValue = noise2D(0, 0);
      if (typeof testValue !== 'number' || isNaN(testValue) || !isFinite(testValue)) {
        throw new Error('noise2D devolvió un valor inválido: ' + testValue);
      }
      
      console.log(`✓ SimplexNoise verificado: testValue = ${testValue.toFixed(6)}`);
      
      if (noiseOffsetX !== 0 || noiseOffsetZ !== 0) {
        finalNoiseGenerator = {
          noise2D: function(x, z) {
            return noise2D(x + noiseOffsetX, z + noiseOffsetZ);
          }
        };
      } else {
        finalNoiseGenerator = { noise2D: noise2D };
      }
      
    } catch (error) {
      console.error('❌ Error crítico al inicializar SimplexNoise:', error);
      throw new Error('FALLÓ la inicialización de SimplexNoise. ' + error.message);
    }
  }
  
  const noiseGen = finalNoiseGenerator;
  const noiseScale = 0.2;
  
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      const distance = hexDistance(0, 0, q, r);
      
      if (distance > GRID_RADIUS) {
        continue;
      }
      
      let height;
      let heightNorm = null;
      
      if (biome.computeHeight && typeof biome.computeHeight === 'function') {
        const context = { gridRadius: GRID_RADIUS };
        const result = biome.computeHeight(q, r, noiseGen, context);
        
        if (typeof result === 'object' && result !== null) {
          height = result.height;
          heightNorm = result.heightNorm !== undefined ? result.heightNorm : null;
        } else {
          height = result;
        }
      } else {
        const biomeNoiseScale = biome.heightNoiseScale !== undefined ? biome.heightNoiseScale : noiseScale;
        height = generateHeight(q, r, biome, noiseGen, biomeNoiseScale);
      }
      
      const pos = hexToPixel3D(q, r, HEX_RADIUS_WORLD);
      
      const cell = {
        q: q,
        r: r,
        worldX: pos.x,
        worldZ: pos.z,
        height: height,
        heightNorm: heightNorm,
        biome: biome,
        candidateWater: false,
        isWater: false,
        waterHeight: null,
        noiseGenerator: noiseGen
      };
      
      if (cell.heightNorm === null && biome.computeColor) {
        const heightRange = biome.maxHeight - biome.minHeight || 1.0;
        cell.heightNorm = (height - biome.minHeight) / heightRange;
      }
      
      let color;
      if (biome.computeColor && typeof biome.computeColor === 'function') {
        if (biome.name === "Rock") {
          if (cell.heightNorm === null || cell.heightNorm === undefined) {
            const heightRange = biome.maxHeight - biome.minHeight || 1.0;
            cell.heightNorm = (height - biome.minHeight) / heightRange;
          }
          color = biome.computeColor(cell.heightNorm);
        } else {
          color = biome.computeColor(height, biome, cell);
        }
      } else {
        color = generateColor(baseColor, colorVariance);
      }
      
      if (!color || !Array.isArray(color) || color.length !== 3 || 
          typeof color[0] !== 'number' || typeof color[1] !== 'number' || typeof color[2] !== 'number') {
        console.error(`Error: Color inválido para celda (${q}, ${r}):`, color);
        color = [0.5, 0.5, 0.5];
      }
      
      cell.color = color;
      cells.push(cell);
    }
  }
  
  console.log(`✓ ${cells.length} celdas creadas con bioma (radio hexagonal: ${GRID_RADIUS}):`);
  console.log(`  - Alturas: ${minHeight} a ${maxHeight}`);
  if (baseColor && Array.isArray(baseColor) && baseColor.length >= 3) {
    console.log(`  - Color base: [${baseColor[0].toFixed(2)}, ${baseColor[1].toFixed(2)}, ${baseColor[2].toFixed(2)}]`);
  } else {
    console.log(`  - Color: calculado dinámicamente por computeColor`);
  }
  if (colorVariance !== undefined) {
    console.log(`  - Variación de color: ±${colorVariance}`);
  }
  
  if (biome.name === "Forest" || biome.name === "Clay" || biome.name === "Wheat") {
    const MIN_WATER_CLUSTER = biome.name === "Wheat" ? 4 : 6;
    detectWaterClusters(cells, MIN_WATER_CLUSTER);
    
    for (const cell of cells) {
      if (cell.isWater) {
        if (cell.waterHeight !== null) {
          cell.height = cell.waterHeight;
        }
        cell.color = [0.35, 0.45, 0.75];
      }
    }
  }
  
  return cells;
}

/**
 * Crea instancias de árboles distribuidas aleatoriamente sobre las celdas.
 */
function createTreeInstances(cells, targetBiome = null) {
  if (!targetBiome) {
    targetBiome = getActiveBiome();
  }
  
  const treeInstances = [];
  let biomeCellsCount = 0;
  
  const treeDensity = targetBiome.treeDensity !== undefined ? targetBiome.treeDensity : TREE_DENSITY;
  
  for (const cell of cells) {
    if (cell.biome !== targetBiome) {
      continue;
    }
    
    if (cell.biome.name === "Wheat") {
      continue;
    }
    
    if (cell.isWater) {
      continue;
    }
    
    if (cell.biome.name === "Rock") {
      if (cell.heightNorm === null || cell.heightNorm === undefined) {
        const heightRange = cell.biome.maxHeight - cell.biome.minHeight || 1.0;
        cell.heightNorm = (cell.height - cell.biome.minHeight) / heightRange;
      }
      if (cell.heightNorm >= 0.2) {
        continue;
      }
    }
    
    if (cell.biome.name === "Clay") {
      if (cell.heightNorm === null || cell.heightNorm === undefined) {
        const heightRange = cell.biome.maxHeight - cell.biome.minHeight || 1.0;
        cell.heightNorm = (cell.height - cell.biome.minHeight) / heightRange;
      }
      if (cell.heightNorm < 0.8) {
        continue;
      }
    }
    
    biomeCellsCount++;
    
    if (cell.occupied) {
      continue;
    }
    
    if (Math.random() >= treeDensity) {
      continue;
    }
    
    const posX = cell.worldX;
    const posZ = cell.worldZ;
    
    const HEX_BASE_HEIGHT = 0.5;
    const visualHeight = cell.height * HEIGHT_UNIT;
    const actualHexHeight = HEX_BASE_HEIGHT * visualHeight;
    const posY = actualHexHeight;
    
    if (posY <= 0) {
      continue;
    }
    
    const rotationY = 0;
    const scale = 1.0;
    
    const scaleMatrix = scaleMat4(scale, scale, scale);
    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);
    const rotationMatrix = new Float32Array([
      cosR, 0, sinR, 0,
      0, 1, 0, 0,
      -sinR, 0, cosR, 0,
      0, 0, 0, 1
    ]);
    
    const localTransform = multiplyMat4(rotationMatrix, scaleMatrix);
    const translationMatrix = translateMat4(posX, posY, posZ);
    const modelMatrix = multiplyMat4(translationMatrix, localTransform);
    
    treeInstances.push({ modelMatrix: modelMatrix });
  }

  const biomeName = targetBiome.name || "Unknown";
  console.log(`✓ ${treeInstances.length} árboles instanciados sobre ${biomeCellsCount} celdas de ${biomeName} (de ${cells.length} totales, densidad: ${(treeDensity * 100).toFixed(1)}%)`);

  return treeInstances;
}

/**
 * Crea instancias de trigo distribuidas aleatoriamente sobre las celdas.
 */
function createWheatInstances(cells, targetBiome = null) {
  if (!targetBiome) {
    targetBiome = getActiveBiome();
  }
  
  const wheatInstances = [];
  let biomeCellsCount = 0;
  
  const wheatDensity = targetBiome.wheatDensity !== undefined ? targetBiome.wheatDensity : 0.85;
  
  for (const cell of cells) {
    if (cell.biome !== targetBiome || cell.biome.name !== "Wheat") {
      continue;
    }
    
    if (cell.isWater) {
      continue;
    }
    
    biomeCellsCount++;
    
    if (Math.random() >= wheatDensity) {
      continue;
    }
    
    cell.occupied = true;
    
    const HEX_BASE_HEIGHT = 0.5;
    const posX = cell.worldX;
    const posZ = cell.worldZ;
    const visualHeight = cell.height * HEIGHT_UNIT;
    const actualHexHeight = HEX_BASE_HEIGHT * visualHeight;
    const posY = actualHexHeight;
    
    if (posY <= 0) {
      continue;
    }
    
    const rotationY = 0;
    const scale = 1.0;
    
    const scaleMatrix = scaleMat4(scale, scale, scale);
    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);
    const rotationMatrix = new Float32Array([
      cosR, 0, sinR, 0,
      0, 1, 0, 0,
      -sinR, 0, cosR, 0,
      0, 0, 0, 1
    ]);
    const localTransform = multiplyMat4(rotationMatrix, scaleMatrix);
    const translationMatrix = translateMat4(posX, posY, posZ);
    const modelMatrix = multiplyMat4(translationMatrix, localTransform);
    
    wheatInstances.push({ modelMatrix: modelMatrix });
  }
  
  const biomeName = targetBiome.name || "Unknown";
  console.log(`✓ ${wheatInstances.length} plantas de trigo instanciadas sobre ${biomeCellsCount} celdas de ${biomeName} (densidad: ${(wheatDensity * 100).toFixed(1)}%)`);
  
  return wheatInstances;
}

/**
 * Crea instancias de ovejas distribuidas aleatoriamente sobre las celdas.
 */
function createSheepInstances(cells, targetBiome = null) {
  if (!targetBiome) {
    targetBiome = getActiveBiome();
  }
  
  const sheepInstances = [];
  let validCells = 0;
  let skippedBorder = 0;
  let skippedNoHeight = 0;
  
  const sheepDensity = targetBiome.sheepDensity !== undefined ? targetBiome.sheepDensity : SHEEP_DENSITY;
  
  const SAFE_MARGIN = 1;
  
  for (const cell of cells) {
    if (cell.biome !== targetBiome) {
      continue;
    }
    
    if (cell.isWater) {
      continue;
    }
    
    if (cell.occupied) {
      continue;
    }
    
    validCells++;
    
    const distance = hexDistance(0, 0, cell.q, cell.r);
    if (distance >= (GRID_RADIUS - SAFE_MARGIN)) {
      skippedBorder++;
      continue;
    }
    
    if (!cell.height || cell.height <= 0) {
      skippedNoHeight++;
      continue;
    }
    
    if (typeof cell.worldX !== 'number' || typeof cell.worldZ !== 'number' ||
        isNaN(cell.worldX) || isNaN(cell.worldZ) ||
        !isFinite(cell.worldX) || !isFinite(cell.worldZ)) {
      console.warn(`  ⚠️ Celda (${cell.q}, ${cell.r}) tiene coordenadas inválidas, saltando`);
      continue;
    }
    
    if (Math.random() >= sheepDensity) {
      continue;
    }
    
    cell.occupied = true;
    
    const HEX_BASE_HEIGHT = 0.5;
    const posX = cell.worldX;
    const posZ = cell.worldZ;
    const visualHeight = cell.height * HEIGHT_UNIT;
    const actualHexHeight = HEX_BASE_HEIGHT * visualHeight;
    const posY = actualHexHeight;
    
    if (sheepInstances.length < 5) {
      console.log(`  Oveja ${sheepInstances.length + 1}:`);
      console.log(`    - Celda: (${cell.q}, ${cell.r}), distancia=${distance.toFixed(2)}`);
      console.log(`    - Posición hexágono: (${posX.toFixed(6)}, 0, ${posZ.toFixed(6)})`);
      console.log(`    - Posición oveja: (${posX.toFixed(6)}, ${posY.toFixed(6)}, ${posZ.toFixed(6)})`);
    }
    
    const scale = 1.2;
    
    const scaleMatrix = scaleMat4(scale, scale, scale);
    const rotationY = Math.random() * Math.PI * 2; // orientación aleatoria en Y para cada oveja
    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);
    const rotationMatrix = new Float32Array([
      cosR, 0, sinR, 0,
      0, 1, 0, 0,
      -sinR, 0, cosR, 0,
      0, 0, 0, 1
    ]);
    
    const localTransform = multiplyMat4(rotationMatrix, scaleMatrix);
    const translationMatrix = translateMat4(posX, posY, posZ);
    const modelMatrix = multiplyMat4(translationMatrix, localTransform);
    
    sheepInstances.push({ modelMatrix: modelMatrix });
  }
  
  const biomeName = targetBiome.name || "Unknown";
  console.log(`✓ ${sheepInstances.length} ovejas instanciadas sobre ${validCells} celdas válidas de ${biomeName} (densidad: ${(sheepDensity * 100).toFixed(1)}%)`);
  if (skippedBorder > 0) console.log(`  (saltadas ${skippedBorder} celdas cerca del borde por seguridad)`);
  if (skippedNoHeight > 0) console.log(`  (saltadas ${skippedNoHeight} celdas sin altura válida)`);

  return sheepInstances;
}
