/**
 * ============================================================
 * utils/hex.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones para trabajar con coordenadas hexagonales.
 */

/**
 * Calcula la distancia hexagonal entre dos celdas en coordenadas axiales.
 */
function hexDistance(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/**
 * Convierte coordenadas axiales hexagonales (q, r) a posición 3D en el mundo.
 */
function hexToPixel3D(q, r, size = HEX_RADIUS_WORLD) {
  const sqrt3 = Math.sqrt(3);
  const x = size * 1.5 * q;
  const y = 0.0;
  const z = size * sqrt3 * (r + q / 2.0);
  return { x, y, z };
}

/**
 * Obtiene los 6 vecinos de una celda hexagonal en coordenadas axiales.
 */
function getHexNeighbors(q, r) {
  return [
    { q: q + 1, r: r },
    { q: q - 1, r: r },
    { q: q, r: r + 1 },
    { q: q, r: r - 1 },
    { q: q + 1, r: r - 1 },
    { q: q - 1, r: r + 1 }
  ];
}

/**
 * Encuentra un cluster conectado de celdas candidatas a agua usando BFS.
 */
function findWaterCluster(startCell, cellMap, visited) {
  const cluster = [];
  const queue = [startCell];
  const startKey = `${startCell.q},${startCell.r}`;
  visited.add(startKey);
  
  while (queue.length > 0) {
    const cell = queue.shift();
    cluster.push(cell);
    
    const neighbors = getHexNeighbors(cell.q, cell.r);
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.q},${neighbor.r}`;
      
      if (!visited.has(neighborKey)) {
        const neighborCell = cellMap.get(neighborKey);
        if (neighborCell && neighborCell.candidateWater) {
          visited.add(neighborKey);
          queue.push(neighborCell);
        }
      }
    }
  }
  
  return cluster;
}

/**
 * Detecta clusters de agua en las celdas y marca solo los clusters grandes como agua.
 */
function detectWaterClusters(cells, minClusterSize = 6) {
  const cellMap = new Map();
  for (const cell of cells) {
    const key = `${cell.q},${cell.r}`;
    cellMap.set(key, cell);
  }
  
  const visited = new Set();
  let clusterCount = 0;
  let totalWaterCells = 0;
  
  for (const cell of cells) {
    if (cell.candidateWater && !visited.has(`${cell.q},${cell.r}`)) {
      const cluster = findWaterCluster(cell, cellMap, visited);
      
      if (cluster.length >= minClusterSize) {
        clusterCount++;
        totalWaterCells += cluster.length;
        
        for (const clusterCell of cluster) {
          clusterCell.isWater = true;
          clusterCell.waterHeight = clusterCell.biome.minHeight - 0.1;
          clusterCell.color = [0.35, 0.45, 0.75];
        }
      } else {
        for (const clusterCell of cluster) {
          clusterCell.isWater = false;
          clusterCell.candidateWater = false;
        }
      }
    }
  }
  
  console.log(`✓ Detección de clusters de agua: ${clusterCount} clusters, ${totalWaterCells} celdas de agua (tamaño mínimo: ${minClusterSize})`);
  
  return clusterCount;
}

/**
 * Genera una altura suave para una celda usando ruido 2D (Simplex Noise).
 */
function generateHeight(q, r, biome, noiseGenerator, noiseScale = 0.2) {
  const { minHeight, maxHeight } = biome;
  
  if (!noiseGenerator || typeof noiseGenerator.noise2D !== 'function') {
    console.warn('Generador de ruido no válido, usando altura aleatoria');
    return Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
  }
  
  try {
    const noiseX = q * noiseScale;
    const noiseY = r * noiseScale;
    const noiseValue = noiseGenerator.noise2D(noiseX, noiseY);
    
    if (typeof noiseValue !== 'number' || isNaN(noiseValue) || !isFinite(noiseValue)) {
      console.warn('Valor de ruido inválido, usando altura aleatoria');
      return Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    }
    
    const normalizedNoise = (noiseValue + 1) / 2;
    const height = minHeight + normalizedNoise * (maxHeight - minHeight);
    const finalHeight = Math.round(height);
    return Math.max(minHeight, Math.min(maxHeight, finalHeight));
    
  } catch (error) {
    console.error('Error en generateHeight:', error);
    return Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
  }
}

/**
 * Genera un color aleatorio basado en un color base y una variación permitida.
 */
function generateColor(baseColor, colorVariance) {
  const r = Math.max(0.0, Math.min(1.0, baseColor[0] + (Math.random() * 2 - 1) * colorVariance));
  const g = Math.max(0.0, Math.min(1.0, baseColor[1] + (Math.random() * 2 - 1) * colorVariance));
  const b = Math.max(0.0, Math.min(1.0, baseColor[2] + (Math.random() * 2 - 1) * colorVariance));
  return [r, g, b];
}

