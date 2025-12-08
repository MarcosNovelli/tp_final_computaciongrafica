/**
 * ============================================================
 * objects/wheat.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones para generar la geometría de plantas de trigo low-poly
 * programáticamente (sin usar modelos externos).
 * 
 * ESTRUCTURA DEL TRIGO:
 * - Múltiples palitos/rectángulos verticales (tallos de trigo)
 * - Cada palito tiene una altura aleatoria diferente
 * - Los palitos se distribuyen dentro del área de un hexágono
 * - Estilo low-poly: prismas rectangulares simples
 * 
 * El trigo está centrado en el origen (x=0, z=0) con la base en y=0
 * y crece hacia arriba (eje Y positivo).
 */

/**
 * Genera una malla de plantas de trigo (conjunto de palitos/rectángulos) para un hexágono.
 * 
 * Cada palito es un prisma rectangular delgado con:
 * - Base cuadrada pequeña (ej: 0.02 x 0.02)
 * - Altura variable (ej: entre 0.3 y 0.7)
 * - Distribución aleatoria dentro del área del hexágono
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {number} hexRadius - Radio del hexágono (para distribuir los palitos dentro del área)
 * @param {number} stalkCount - Número de palitos de trigo a generar
 * @returns {Object} Objeto con { vao, indexCount } para renderizar
 */
function createWheatMesh(gl, hexRadius = 0.5, stalkCount = 60) {
  const positions = [];
  const normals = [];
  const indices = [];
  
  // Cada palito es un prisma rectangular pequeño
  // Dimensiones de un palito individual (más pequeños y uniformes, como en la imagen)
  const stalkWidth = 0.025;  // Ancho del palito (X) - más delgado para densidad
  const stalkDepth = 0.025;  // Profundidad del palito (Z) - más delgado para densidad
  const stalkHeightMin = 0.35; // Altura mínima del palito (más uniforme)
  const stalkHeightMax = 0.42; // Altura máxima del palito (muy poca variación para aspecto uniforme)
  
  let indexOffset = 0;
  
  // Generar múltiples palitos distribuidos dentro del hexágono
  for (let i = 0; i < stalkCount; i++) {
    // Posición aleatoria dentro del hexágono (usando coordenadas polares)
    // Distribución más uniforme para mejor cobertura densa del hexágono
    const maxRadius = hexRadius * 0.92; // 92% del radio para cubrir casi todo el hexágono
    const angle = Math.random() * Math.PI * 2.0;
    // Usar distribución raíz cuadrada para mejor distribución uniforme (más palitos cerca del centro)
    const radius = Math.sqrt(Math.random()) * maxRadius;
    
    const centerX = radius * Math.cos(angle);
    const centerZ = radius * Math.sin(angle);
    
    // Altura aleatoria para este palito
    const stalkHeight = stalkHeightMin + Math.random() * (stalkHeightMax - stalkHeightMin);
    
    // Generar los 8 vértices del prisma rectangular (centrado en X y Z, base en Y=0)
    const halfWidth = stalkWidth * 0.5;
    const halfDepth = stalkDepth * 0.5;
    
    const vertices = [
      // Base del prisma (y = 0)
      [centerX - halfWidth, 0.0, centerZ - halfDepth], // 0: esquina inferior-izquierda-atrás
      [centerX + halfWidth, 0.0, centerZ - halfDepth], // 1: esquina inferior-derecha-atrás
      [centerX + halfWidth, 0.0, centerZ + halfDepth], // 2: esquina inferior-derecha-delante
      [centerX - halfWidth, 0.0, centerZ + halfDepth], // 3: esquina inferior-izquierda-delante
      // Tapa del prisma (y = stalkHeight)
      [centerX - halfWidth, stalkHeight, centerZ - halfDepth], // 4: esquina superior-izquierda-atrás
      [centerX + halfWidth, stalkHeight, centerZ - halfDepth], // 5: esquina superior-derecha-atrás
      [centerX + halfWidth, stalkHeight, centerZ + halfDepth], // 6: esquina superior-derecha-delante
      [centerX - halfWidth, stalkHeight, centerZ + halfDepth], // 7: esquina superior-izquierda-delante
    ];
    
    // Agregar vértices al array de posiciones
    const baseIndex = indexOffset;
    for (const vertex of vertices) {
      positions.push(vertex[0], vertex[1], vertex[2]);
    }
    
    // Generar normales para cada cara (flat shading)
    // Cara inferior (base): normal hacia abajo
    for (let i = 0; i < 4; i++) {
      normals.push(0, -1, 0);
    }
    
    // Cara superior (tapa): normal hacia arriba
    for (let i = 0; i < 4; i++) {
      normals.push(0, 1, 0);
    }
    
    // Cara frontal (Z positivo): normal hacia adelante
    normals.push(0, 0, 1);
    normals.push(0, 0, 1);
    normals.push(0, 0, 1);
    normals.push(0, 0, 1);
    
    // Cara trasera (Z negativo): normal hacia atrás
    normals.push(0, 0, -1);
    normals.push(0, 0, -1);
    normals.push(0, 0, -1);
    normals.push(0, 0, -1);
    
    // Cara derecha (X positivo): normal hacia la derecha
    normals.push(1, 0, 0);
    normals.push(1, 0, 0);
    normals.push(1, 0, 0);
    normals.push(1, 0, 0);
    
    // Cara izquierda (X negativo): normal hacia la izquierda
    normals.push(-1, 0, 0);
    normals.push(-1, 0, 0);
    normals.push(-1, 0, 0);
    normals.push(-1, 0, 0);
    
    // Generar índices para las 6 caras del prisma (12 triángulos)
    // Cara inferior (base): 0, 1, 2 y 0, 2, 3
    indices.push(
      baseIndex + 0, baseIndex + 1, baseIndex + 2,
      baseIndex + 0, baseIndex + 2, baseIndex + 3
    );
    
    // Cara superior (tapa): 4, 6, 5 y 4, 7, 6
    indices.push(
      baseIndex + 4, baseIndex + 6, baseIndex + 5,
      baseIndex + 4, baseIndex + 7, baseIndex + 6
    );
    
    // Cara frontal (Z positivo): 3, 2, 6 y 3, 6, 7
    indices.push(
      baseIndex + 3, baseIndex + 2, baseIndex + 6,
      baseIndex + 3, baseIndex + 6, baseIndex + 7
    );
    
    // Cara trasera (Z negativo): 1, 0, 4 y 1, 4, 5
    indices.push(
      baseIndex + 1, baseIndex + 0, baseIndex + 4,
      baseIndex + 1, baseIndex + 4, baseIndex + 5
    );
    
    // Cara derecha (X positivo): 2, 1, 5 y 2, 5, 6
    indices.push(
      baseIndex + 2, baseIndex + 1, baseIndex + 5,
      baseIndex + 2, baseIndex + 5, baseIndex + 6
    );
    
    // Cara izquierda (X negativo): 0, 3, 7 y 0, 7, 4
    indices.push(
      baseIndex + 0, baseIndex + 3, baseIndex + 7,
      baseIndex + 0, baseIndex + 7, baseIndex + 4
    );
    
    // Actualizar offset para el siguiente palito
    indexOffset += 8;
  }
  
  // Crear buffers WebGL (sin VAO, compatible con WebGL 1.0)
  // Usar createBuffer de gl.js como tree.js
  const positionBuffer = createBuffer(gl, new Float32Array(positions));
  const normalBuffer = createBuffer(gl, new Float32Array(normals));
  
  // Buffer de índices
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  
  // Retornar buffers individuales (como treeMesh) para compatibilidad con drawMesh
  return {
    positionBuffer: positionBuffer,
    normalBuffer: normalBuffer,
    indexBuffer: indexBuffer,
    indexCount: indices.length
  };
}

