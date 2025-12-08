/**
 * ============================================================
 * objects/tree.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones para generar la geometría de un árbol low-poly
 * programáticamente (sin usar modelos externos).
 * 
 * ESTRUCTURA DEL ÁRBOL:
 * - Tronco: prisma hexagonal alto y fino (altura ~0.5, radio ~0.06)
 * - Copa: 3 conos/pirámides apilados (altura total ~0.8, radio base ~0.25)
 * 
 * El árbol está centrado en el origen (x=0, z=0) con la base del tronco en y=0
 * y crece hacia arriba (eje Y positivo).
 */

/**
 * Calcula la normal de un triángulo usando producto cruzado.
 * 
 * @param {number[]} v1 - Primer vértice [x, y, z]
 * @param {number[]} v2 - Segundo vértice [x, y, z]
 * @param {number[]} v3 - Tercer vértice [x, y, z]
 * @returns {number[]} Vector normal normalizado [x, y, z]
 */
function calculateTriangleNormal(v1, v2, v3) {
  // Vectores del triángulo
  const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
  const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

  // Producto cruzado: edge1 × edge2
  const nx = edge1[1] * edge2[2] - edge1[2] * edge2[1];
  const ny = edge1[2] * edge2[0] - edge1[0] * edge2[2];
  const nz = edge1[0] * edge2[1] - edge1[1] * edge2[0];

  // Normalizar el vector
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length === 0) return [0, 1, 0]; // Fallback si el triángulo es degenerado

  return [nx / length, ny / length, nz / length];
}

/**
 * Genera un cono/pirámide de base circular aproximada (polígono de n lados).
 * 
 * @param {number} baseRadius - Radio de la base del cono
 * @param {number} topRadius - Radio de la parte superior del cono (0 para punta, >0 para frustum)
 * @param {number} height - Altura del cono
 * @param {number} yBase - Altura Y de la base del cono
 * @param {number} sides - Número de lados del polígono de la base (más lados = más circular)
 * @param {number[]} positions - Array donde se agregarán las posiciones
 * @param {number[]} normals - Array donde se agregarán las normales
 * @param {number[]} indices - Array donde se agregarán los índices
 * @param {number} indexOffset - Offset inicial para los índices
 * @returns {number} Siguiente offset de índice para usar
 */
function generateCone(baseRadius, topRadius, height, yBase, sides, positions, normals, indices, indexOffset) {
  const angleStep = (2 * Math.PI) / sides;
  let currentIndex = indexOffset;

  // Generar vértices de la base (y = yBase)
  const baseVertices = [];
  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep;
    const x = baseRadius * Math.cos(angle);
    const z = baseRadius * Math.sin(angle);
    baseVertices.push([x, yBase, z]);
  }

  // Generar vértices de la tapa (y = yBase + height)
  const topVertices = [];
  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep;
    const x = topRadius * Math.cos(angle);
    const z = topRadius * Math.sin(angle);
    topVertices.push([x, yBase + height, z]);
  }

  // Generar centro de la base (solo si baseRadius > 0)
  const baseCenter = [0, yBase, 0];
  const baseCenterIndex = currentIndex++;
  positions.push(baseCenter[0], baseCenter[1], baseCenter[2]);
  normals.push(0, -1, 0); // Normal apunta hacia abajo

  // Generar centro de la tapa (solo si topRadius > 0)
  const topCenter = [0, yBase + height, 0];
  const topCenterIndex = currentIndex++;
  positions.push(topCenter[0], topCenter[1], topCenter[2]);
  normals.push(0, 1, 0); // Normal apunta hacia arriba

  // Agregar vértices de la base y la tapa
  const baseStartIndex = currentIndex;
  for (let i = 0; i < sides; i++) {
    positions.push(baseVertices[i][0], baseVertices[i][1], baseVertices[i][2]);
    normals.push(0, -1, 0); // Normal de la base apunta hacia abajo
    currentIndex++;
  }

  const topStartIndex = currentIndex;
  for (let i = 0; i < sides; i++) {
    positions.push(topVertices[i][0], topVertices[i][1], topVertices[i][2]);
    normals.push(0, 1, 0); // Normal de la tapa apunta hacia arriba (temporal, se actualizará)
    currentIndex++;
  }

  // Tapa inferior (triángulos desde el centro hacia los vértices)
  for (let i = 0; i < sides; i++) {
    const v1 = baseStartIndex + i;
    const v2 = baseCenterIndex;
    const v3 = baseStartIndex + ((i + 1) % sides);
    indices.push(v1, v2, v3);
  }

  // Tapa superior (triángulos desde el centro hacia los vértices)
  if (topRadius > 0) {
    for (let i = 0; i < sides; i++) {
      const v1 = topCenterIndex;
      const v2 = topStartIndex + i;
      const v3 = topStartIndex + ((i + 1) % sides);
      indices.push(v1, v2, v3);
    }
  }

  // Caras laterales (triángulos entre base y tapa)
  for (let i = 0; i < sides; i++) {
    const nextI = (i + 1) % sides;
    const b1 = baseStartIndex + i;
    const b2 = baseStartIndex + nextI;
    const t1 = topStartIndex + i;
    const t2 = topStartIndex + nextI;

    // Primer triángulo: b1, b2, t1
    indices.push(b1, b2, t1);

    // Segundo triángulo: t1, b2, t2
    indices.push(t1, b2, t2);
  }

  // Actualizar normales de las caras laterales (flat shading por cara)
  // Esto debe hacerse después de que todos los vértices estén en el array
  for (let i = 0; i < sides; i++) {
    const nextI = (i + 1) % sides;
    const b1Idx = baseStartIndex + i;
    const b2Idx = baseStartIndex + nextI;
    const t1Idx = topStartIndex + i;
    const t2Idx = topStartIndex + nextI;

    // Usar los vértices que ya tenemos en memoria (baseVertices y topVertices)
    const v1 = baseVertices[i];
    const v2 = baseVertices[nextI];
    const v3 = topVertices[i];
    const v4 = topVertices[nextI];

    // Calcular normales para los dos triángulos de la cara
    const normal1 = calculateTriangleNormal(v1, v2, v3);
    const normal2 = calculateTriangleNormal(v3, v2, v4);

    // Para flat shading, cada triángulo tiene su propia normal constante
    // Pero los vértices compartidos necesitan una normal única
    // Usamos el promedio normalizado de las dos normales para vértices compartidos
    const sharedNormalX = (normal1[0] + normal2[0]) / 2;
    const sharedNormalY = (normal1[1] + normal2[1]) / 2;
    const sharedNormalZ = (normal1[2] + normal2[2]) / 2;
    const sharedNormalLen = Math.sqrt(sharedNormalX * sharedNormalX + sharedNormalY * sharedNormalY + sharedNormalZ * sharedNormalZ);
    const sharedNormal = sharedNormalLen > 0.001 ? [sharedNormalX / sharedNormalLen, sharedNormalY / sharedNormalLen, sharedNormalZ / sharedNormalLen] : normal1;

    // Actualizar normales (cada vértice tiene 3 componentes: x, y, z)
    normals[b1Idx * 3] = normal1[0];
    normals[b1Idx * 3 + 1] = normal1[1];
    normals[b1Idx * 3 + 2] = normal1[2];

    // b2 y t1 son compartidos entre los dos triángulos, usamos el promedio
    normals[b2Idx * 3] = sharedNormal[0];
    normals[b2Idx * 3 + 1] = sharedNormal[1];
    normals[b2Idx * 3 + 2] = sharedNormal[2];

    normals[t1Idx * 3] = sharedNormal[0];
    normals[t1Idx * 3 + 1] = sharedNormal[1];
    normals[t1Idx * 3 + 2] = sharedNormal[2];

    normals[t2Idx * 3] = normal2[0];
    normals[t2Idx * 3 + 1] = normal2[1];
    normals[t2Idx * 3 + 2] = normal2[2];
  }

  return currentIndex;
}

/**
 * Genera un prisma hexagonal (para el tronco).
 * 
 * @param {number} radius - Radio del hexágono
 * @param {number} height - Altura del prisma
 * @param {number} yBase - Altura Y de la base del prisma
 * @param {number[]} positions - Array donde se agregarán las posiciones
 * @param {number[]} normals - Array donde se agregarán las normales
 * @param {number[]} indices - Array donde se agregarán los índices
 * @param {number} indexOffset - Offset inicial para los índices
 * @returns {number} Siguiente offset de índice para usar
 */
function generateHexagonPrism(radius, height, yBase, positions, normals, indices, indexOffset) {
  const sides = 6;
  const angleStep = (2 * Math.PI) / sides;
  let currentIndex = indexOffset;

  // Generar vértices de la base y la tapa
  const baseVertices = [];
  const topVertices = [];

  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    baseVertices.push([x, yBase, z]);
    topVertices.push([x, yBase + height, z]);
  }

  // Centro de la base
  const baseCenter = [0, yBase, 0];
  const baseCenterIndex = currentIndex++;
  positions.push(baseCenter[0], baseCenter[1], baseCenter[2]);
  normals.push(0, -1, 0);

  // Centro de la tapa
  const topCenter = [0, yBase + height, 0];
  const topCenterIndex = currentIndex++;
  positions.push(topCenter[0], topCenter[1], topCenter[2]);
  normals.push(0, 1, 0);

  // Vértices de la base
  const baseStartIndex = currentIndex;
  for (let i = 0; i < sides; i++) {
    positions.push(baseVertices[i][0], baseVertices[i][1], baseVertices[i][2]);
    normals.push(0, -1, 0);
    currentIndex++;
  }

  // Vértices de la tapa
  const topStartIndex = currentIndex;
  for (let i = 0; i < sides; i++) {
    positions.push(topVertices[i][0], topVertices[i][1], topVertices[i][2]);
    normals.push(0, 1, 0);
    currentIndex++;
  }

  // Tapa inferior
  for (let i = 0; i < sides; i++) {
    const v1 = baseStartIndex + i;
    const v2 = baseCenterIndex;
    const v3 = baseStartIndex + ((i + 1) % sides);
    indices.push(v1, v2, v3);
  }

  // Tapa superior
  for (let i = 0; i < sides; i++) {
    const v1 = topCenterIndex;
    const v2 = topStartIndex + ((i + 1) % sides);
    const v3 = topStartIndex + i;
    indices.push(v1, v2, v3);
  }

  // Caras laterales
  for (let i = 0; i < sides; i++) {
    const nextI = (i + 1) % sides;
    const b1 = baseStartIndex + i;
    const b2 = baseStartIndex + nextI;
    const t1 = topStartIndex + i;
    const t2 = topStartIndex + nextI;

    indices.push(b1, b2, t1);
    indices.push(t1, b2, t2);

    // Calcular y actualizar normales (flat shading)
    const v1 = baseVertices[i];
    const v2 = baseVertices[nextI];
    const v3 = topVertices[i];
    const normal1 = calculateTriangleNormal(v1, v2, v3);
    const normal2 = calculateTriangleNormal(v3, v2, topVertices[nextI]);

    normals[b1 * 3] = normal1[0];
    normals[b1 * 3 + 1] = normal1[1];
    normals[b1 * 3 + 2] = normal1[2];

    normals[b2 * 3] = normal1[0];
    normals[b2 * 3 + 1] = normal1[1];
    normals[b2 * 3 + 2] = normal1[2];

    normals[t1 * 3] = normal1[0];
    normals[t1 * 3 + 1] = normal1[1];
    normals[t1 * 3 + 2] = normal1[2];

    normals[t1 * 3] = normal2[0];
    normals[t1 * 3 + 1] = normal2[1];
    normals[t1 * 3 + 2] = normal2[2];

    normals[b2 * 3] = normal2[0];
    normals[b2 * 3 + 1] = normal2[1];
    normals[b2 * 3 + 2] = normal2[2];

    normals[t2 * 3] = normal2[0];
    normals[t2 * 3 + 1] = normal2[1];
    normals[t2 * 3 + 2] = normal2[2];
  }

  return currentIndex;
  return currentIndex;
}

/**
 * Genera un disco de sombra en la base del árbol.
 * 
 * @param {number} radius - Radio del disco de sombra
 * @param {number} yPos - Altura Y del disco (ligeramente sobre el suelo para evitar z-fighting)
 * @param {number[]} positions - Array posiciones
 * @param {number[]} normals - Array normales
 * @param {number[]} indices - Array índices
 * @param {number} indexOffset - Offset índice
 * @returns {number} Nuevo offset
 */
function generateShadowDisk(radius, yPos, positions, normals, indices, indexOffset) {
  const sides = 8; // Octágono es suficiente para una sombra borrosa
  const angleStep = (2 * Math.PI) / sides;
  let currentIndex = indexOffset;

  // Centro
  const centerIndex = currentIndex++;
  positions.push(0, yPos, 0);
  normals.push(0, 1, 0);

  // Borde
  const startIndex = currentIndex;
  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep;
    positions.push(radius * Math.cos(angle), yPos, radius * Math.sin(angle));
    normals.push(0, 1, 0);
    currentIndex++;
  }

  // Triangulos
  for (let i = 0; i < sides; i++) {
    indices.push(centerIndex, startIndex + i, startIndex + ((i + 1) % sides));
  }

  return currentIndex;
}

/**
 * Crea la malla de un árbol low-poly programáticamente.
 * 
 * RESPONSABILIDAD:
 * - Generar la geometría completa de un árbol (tronco + copa)
 * - Crear los buffers WebGL necesarios (posiciones, normales, índices)
 * - Retornar un objeto con los buffers y metadatos necesarios para renderizar
 * 
 * ESTRUCTURA DEL ÁRBOL:
 * 1. TRONCO:
 *    - Prisma hexagonal alto y fino
 *    - Altura: 0.5 unidades
 *    - Radio: 0.06 unidades
 *    - Base en y = 0, crece hacia arriba
 * 
 * 2. COPA:
 *    - 3 conos/pirámides apilados
 *    - Cono inferior: base radius 0.25, top radius 0.2, altura 0.3
 *    - Cono medio: base radius 0.2, top radius 0.15, altura 0.25
 *    - Cono superior: base radius 0.15, top radius 0, altura 0.25 (punta)
 *    - La copa empieza en y = 0.5 (arriba del tronco)
 * 
 * NORMALES:
 * - Se calculan por cara (flat shading) para mantener el estilo low-poly
 * - Cada triángulo tiene su propia normal calculada con producto cruzado
 * - Los 3 vértices de cada triángulo comparten la misma normal
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @returns {{positionBuffer: WebGLBuffer, normalBuffer: WebGLBuffer, indexBuffer: WebGLBuffer, indexCount: number}}
 */
function createTreeMesh(gl) {
  const positions = [];
  const normals = [];
  const indices = [];

  let indexOffset = 0;

  // ============================================================
  // TRONCO (prisma hexagonal alto y fino)
  // ============================================================
  const trunkRadius = 0.06;
  const trunkHeight = 0.5;
  const trunkYBase = 0.0;

  indexOffset = generateHexagonPrism(trunkRadius, trunkHeight, trunkYBase, positions, normals, indices, indexOffset);

  // ============================================================
  // COPA (3 conos apilados)
  // ============================================================
  const crownYBase = trunkHeight; // Empieza arriba del tronco (y = 0.5)
  const sides = 6; // Número de lados para aproximar un círculo

  // Cono inferior (más grande)
  const cone1BaseRadius = 0.25;
  const cone1TopRadius = 0.2;
  const cone1Height = 0.3;
  indexOffset = generateCone(cone1BaseRadius, cone1TopRadius, cone1Height, crownYBase, sides, positions, normals, indices, indexOffset);

  // Cono medio
  const cone2BaseRadius = 0.2;
  const cone2TopRadius = 0.15;
  const cone2Height = 0.25;
  indexOffset = generateCone(cone2BaseRadius, cone2TopRadius, cone2Height, crownYBase + cone1Height, sides, positions, normals, indices, indexOffset);

  // Cono superior (punta)
  const cone3BaseRadius = 0.15;
  const cone3TopRadius = 0.0; // Punta
  const cone3Height = 0.25;
  indexOffset = generateCone(cone3BaseRadius, cone3TopRadius, cone3Height, crownYBase + cone1Height + cone2Height, sides, positions, normals, indices, indexOffset);

  // ============================================================
  // SOMBRA (disco en la base)
  // ============================================================
  const shadowStartIndices = indices.length;
  indexOffset = generateShadowDisk(0.35, 0.02, positions, normals, indices, indexOffset);
  const shadowIndicesLength = indices.length - shadowStartIndices;

  // Crear buffers WebGL
  const positionBuffer = createBuffer(gl, new Float32Array(positions));
  const normalBuffer = createBuffer(gl, new Float32Array(normals));

  // Buffer de índices
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  // Calcular el número de triángulos del tronco
  // El tronco tiene: 2 tapas (12 triángulos) + 6 caras laterales (12 triángulos) = 24 triángulos
  // Cada triángulo tiene 3 índices, así que: 24 * 3 = 72 índices
  const trunkTriangleCount = 24;
  const trunkIndexCount = trunkTriangleCount * 3;

  console.log(`✓ Malla de árbol generada: ${positions.length / 3} vértices, ${indices.length / 3} triángulos`);
  console.log(`  - Tronco: ${trunkIndexCount / 3} triángulos`);
  console.log(`  - Copa: ${(indices.length - trunkIndexCount) / 3} triángulos`);

  return {
    positionBuffer: positionBuffer,
    normalBuffer: normalBuffer,
    indexBuffer: indexBuffer,
    indexCount: indices.length,
    trunkIndexCount: trunkIndexCount, // Índices del tronco
    crownIndexCount: shadowStartIndices - trunkIndexCount, // Índices de la copa (hasta donde empieza la sombra)
    crownIndexOffset: trunkIndexCount, // Offset copa
    shadowIndexCount: shadowIndicesLength, // Índices sobra
    shadowIndexOffset: shadowStartIndices // Offset sombra
  };
}
