/**
 * ============================================================
 * loader/simpleObjMtlLoader.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones para cargar y parsear modelos OBJ y materiales MTL.
 * 
 * FORMATOS SOPORTADOS:
 * - OBJ: posiciones (v), normales (vn), caras (f con formato a//na b//nb c//nc)
 * - MTL: primera entrada de material con Kd (color difuso)
 * 
 * NO SOPORTA:
 * - UVs (coordenadas de textura)
 * - Múltiples materiales
 * - Otras propiedades de material (Ks, Ka, etc.)
 */

/**
 * Parsea un archivo MTL simple y extrae el color difuso (Kd) del primer material.
 * 
 * RESPONSABILIDAD:
 * - Leer el contenido del archivo MTL
 * - Buscar la primera entrada de material (línea "newmtl ...")
 * - Extraer el color difuso Kd r g b
 * - Retornar el color como array [r, g, b] en formato float (0.0 a 1.0)
 * 
 * FORMATO MTL:
 * - newmtl MaterialName
 * - Kd r g b (color difuso, valores entre 0.0 y 1.0)
 * 
 * @param {string} mtlText - Contenido del archivo MTL como string
 * @returns {number[]} Color difuso [r, g, b] o [0.9, 0.9, 0.9] por defecto
 */
function parseMTL(mtlText) {
  const lines = mtlText.split('\n');
  let defaultColor = [0.9, 0.9, 0.9]; // Color por defecto si no se encuentra Kd
  
  // Buscar cualquier línea Kd (color difuso) en el archivo
  // Si hay múltiples materiales, tomamos el primero que encontremos
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Ignorar líneas vacías y comentarios
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    // Buscar Kd (color difuso) - puede estar antes o después de newmtl
    if (trimmed.startsWith('Kd')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        // Kd r g b (valores pueden estar en 0.0-1.0 o 0-255)
        let r = parseFloat(parts[1]);
        let g = parseFloat(parts[2]);
        let b = parseFloat(parts[3]);
        
        // Si los valores son mayores que 1, asumir que están en rango 0-255 y normalizar
        if (r > 1.0 || g > 1.0 || b > 1.0) {
          r = r / 255.0;
          g = g / 255.0;
          b = b / 255.0;
        }
        
        // Validar y retornar el color
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          // Asegurar que estén en rango [0, 1]
          r = Math.max(0, Math.min(1, r));
          g = Math.max(0, Math.min(1, g));
          b = Math.max(0, Math.min(1, b));
          return [r, g, b];
        }
      }
    }
  }
  
  // Si no se encontró Kd, retornar color por defecto
  return defaultColor;
}

/**
 * Parsea un archivo OBJ simple y extrae posiciones, normales e índices.
 * 
 * RESPONSABILIDAD:
 * - Leer el contenido del archivo OBJ
 * - Extraer posiciones (líneas "v x y z")
 * - Extraer normales (líneas "vn x y z")
 * - Extraer caras (líneas "f a//na b//nb c//nc")
 * - Convertir índices de OBJ (1-based) a índices de array (0-based)
 * - Retornar arrays listos para crear buffers WebGL
 * 
 * FORMATO OBJ SOPORTADO:
 * - v x y z (vértice)
 * - vn x y z (normal)
 * - f v1//n1 v2//n2 v3//n3 (cara con vértice y normal)
 * 
 * NOTA: Los índices en OBJ son 1-based (empiezan en 1), los convertimos a 0-based.
 * 
 * @param {string} objText - Contenido del archivo OBJ como string
 * @returns {{positions: Float32Array, normals: Float32Array, indices: Uint16Array, bounds: {min: number[], max: number[]}}}
 */
function parseOBJ(objText) {
  const positions = [];
  const normals = [];
  const facesByMaterial = {
    'White': [],  // Lana blanca
    'Black': []   // Cabeza y patas grises
  };
  
  // Array temporal para almacenar posiciones y normales antes de indexar
  const tempPositions = [];
  const tempNormals = [];
  
  // Material actual (por defecto 'White' si no se especifica)
  let currentMaterial = 'White';
  
  const lines = objText.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Ignorar líneas vacías y comentarios
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    const parts = trimmed.split(/\s+/);
    
    // Parsear cambio de material (usemtl MaterialName)
    if (parts[0] === 'usemtl' && parts.length >= 2) {
      const materialName = parts[1];
      // Solo considerar materiales 'White' y 'Black', otros se tratan como 'White'
      if (materialName === 'Black' || materialName === 'White') {
        currentMaterial = materialName;
      } else {
        currentMaterial = 'White'; // Por defecto
      }
      continue;
    }
    
    // Parsear vértice (v x y z)
    if (parts[0] === 'v' && parts.length >= 4) {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        tempPositions.push([x, y, z]);
      }
    }
    
    // Parsear normal (vn x y z)
    if (parts[0] === 'vn' && parts.length >= 4) {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        tempNormals.push([x, y, z]);
      }
    }
    
    // Parsear cara (f v1//n1 v2//n2 v3//n3)
    // Solo soportamos formato con normales: f a//na b//nb c//nc
    if (parts[0] === 'f' && parts.length >= 4) {
      const faceIndices = [];
      
      // Parsear cada vértice de la cara (saltando "f")
      for (let i = 1; i < parts.length; i++) {
        const vertexPart = parts[i];
        // Formato: v//n donde v es índice de vértice y n es índice de normal
        const match = vertexPart.match(/^(\d+)\/\/(\d+)$/);
        
        if (match) {
          const vIndex = parseInt(match[1]) - 1; // Convertir a 0-based
          const nIndex = parseInt(match[2]) - 1; // Convertir a 0-based
          
          if (vIndex >= 0 && vIndex < tempPositions.length &&
              nIndex >= 0 && nIndex < tempNormals.length) {
            faceIndices.push({ v: vIndex, n: nIndex });
          }
        }
      }
      
      // Convertir cara a triángulos (fan triangulation)
      // Si la cara tiene más de 3 vértices, dividirla en triángulos
      if (faceIndices.length >= 3) {
        for (let i = 1; i < faceIndices.length - 1; i++) {
          // Agregar la cara al material actual
          if (!facesByMaterial[currentMaterial]) {
            facesByMaterial[currentMaterial] = [];
          }
          facesByMaterial[currentMaterial].push([
            faceIndices[0],
            faceIndices[i],
            faceIndices[i + 1]
          ]);
        }
      }
    }
  }
  
  // Si no hay caras en Black, crear array vacío
  if (!facesByMaterial['Black']) {
    facesByMaterial['Black'] = [];
  }
  if (!facesByMaterial['White']) {
    facesByMaterial['White'] = [];
  }
  
  // Función auxiliar para procesar caras de un material y crear buffers
  function processMaterialFaces(materialFaces, materialName) {
    const materialPositions = [];
    const materialNormals = [];
    const vertexMap = new Map();
    let currentIndex = 0;
    
    // Primero crear arrays de posiciones y normales únicos
    for (const face of materialFaces) {
      for (const vertex of face) {
        const key = `${vertex.v}_${vertex.n}`;
        
        if (!vertexMap.has(key)) {
          const pos = tempPositions[vertex.v];
          const norm = tempNormals[vertex.n];
          
          materialPositions.push(pos[0], pos[1], pos[2]);
          materialNormals.push(norm[0], norm[1], norm[2]);
          
          vertexMap.set(key, currentIndex);
          currentIndex++;
        }
      }
    }
    
    // Crear array de índices
    const materialIndices = [];
    currentIndex = 0;
    vertexMap.clear();
    
    for (const face of materialFaces) {
      for (const vertex of face) {
        const key = `${vertex.v}_${vertex.n}`;
        
        if (!vertexMap.has(key)) {
          vertexMap.set(key, currentIndex);
          currentIndex++;
        }
        
        materialIndices.push(vertexMap.get(key));
      }
    }
    
    return {
      positions: new Float32Array(materialPositions),
      normals: new Float32Array(materialNormals),
      indices: new Uint16Array(materialIndices)
    };
  }
  
  // Procesar cada material por separado
  const whiteData = processMaterialFaces(facesByMaterial['White'], 'White');
  const blackData = processMaterialFaces(facesByMaterial['Black'], 'Black');
  
  // Calcular bounding box combinado de todas las posiciones originales para escalado
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (let i = 0; i < tempPositions.length; i++) {
    const pos = tempPositions[i];
    minX = Math.min(minX, pos[0]);
    minY = Math.min(minY, pos[1]);
    minZ = Math.min(minZ, pos[2]);
    maxX = Math.max(maxX, pos[0]);
    maxY = Math.max(maxY, pos[1]);
    maxZ = Math.max(maxZ, pos[2]);
  }
  
  return {
    white: whiteData,  // Lana (blanco)
    black: blackData,  // Cabeza y patas (gris oscuro)
    bounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    }
  };
}

/**
 * Carga un modelo OBJ con su material MTL y retorna buffers WebGL listos para renderizar.
 * 
 * RESPONSABILIDAD:
 * - Cargar el archivo MTL y parsear el color difuso (Kd)
 * - Cargar el archivo OBJ y parsear posiciones, normales e índices
 * - Calcular escala automática basada en el bounding box
 * - Crear buffers WebGL (VBOs y EBO)
 * - Crear VAO con atributos a_position y a_normal
 * - Retornar el VAO, indexCount y materialColor
 * 
 * ESCALADO AUTOMÁTICO:
 * - Calcula el bounding box del modelo
 * - Escala el modelo para que el ancho máximo sea aproximadamente la mitad de HEX_RADIUS_WORLD
 * - Esto hace que las ovejas tengan un tamaño razonable comparado con los hexágonos
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {string} objUrl - URL del archivo OBJ (ej: "objects/sheep.obj")
 * @param {string} mtlUrl - URL del archivo MTL (ej: "objects/sheep.mtl")
 * @returns {Promise<{vao: WebGLVertexArrayObject, indexCount: number, materialColor: number[]}>}
 */
async function loadObjWithMtl(gl, objUrl, mtlUrl) {
  try {
    // Cargar y parsear MTL para obtener el color
    const mtlResponse = await fetch(mtlUrl);
    if (!mtlResponse.ok) {
      console.warn(`Advertencia: No se pudo cargar ${mtlUrl}, usando color por defecto`);
    }
    const mtlText = await mtlResponse.text();
    const materialColor = parseMTL(mtlText);
    console.log(`✓ Material MTL cargado: color difuso Kd = [${materialColor[0].toFixed(3)}, ${materialColor[1].toFixed(3)}, ${materialColor[2].toFixed(3)}]`);
    if (materialColor[0] === 0.9 && materialColor[1] === 0.9 && materialColor[2] === 0.9) {
      console.warn(`  ⚠️ Usando color por defecto - posiblemente no se encontró Kd en el MTL`);
    }
    
    // Cargar y parsear OBJ (ahora separado por materiales)
    const objResponse = await fetch(objUrl);
    if (!objResponse.ok) {
      throw new Error(`Error: No se pudo cargar ${objUrl} (status: ${objResponse.status})`);
    }
    const objText = await objResponse.text();
    if (!objText || objText.length === 0) {
      throw new Error(`Error: El archivo ${objUrl} está vacío`);
    }
    const objData = parseOBJ(objText);
    if (!objData || !objData.white || !objData.black) {
      throw new Error(`Error: El archivo OBJ no se parseó correctamente`);
    }
  
  const whiteTriCount = objData.white.indices.length / 3;
  const blackTriCount = objData.black.indices.length / 3;
  console.log(`✓ OBJ cargado: White=${whiteTriCount} triángulos, Black=${blackTriCount} triángulos`);
  console.log(`  Bounding box: min [${objData.bounds.min[0].toFixed(2)}, ${objData.bounds.min[1].toFixed(2)}, ${objData.bounds.min[2].toFixed(2)}], max [${objData.bounds.max[0].toFixed(2)}, ${objData.bounds.max[1].toFixed(2)}, ${objData.bounds.max[2].toFixed(2)}]`);
  
  // Calcular el centro del bounding box para centrar el modelo en el origen
  const centerX = (objData.bounds.min[0] + objData.bounds.max[0]) / 2;
  const centerY = objData.bounds.min[1]; // La base del modelo debe estar en y=0
  const centerZ = (objData.bounds.min[2] + objData.bounds.max[2]) / 2;
  
  console.log(`  Centro del modelo: [${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)}]`);
  
  // Calcular escala automática
  const width = objData.bounds.max[0] - objData.bounds.min[0];
  const height = objData.bounds.max[1] - objData.bounds.min[1];
  const depth = objData.bounds.max[2] - objData.bounds.min[2];
  const maxDimension = Math.max(width, height, depth);
  
  const targetSize = 0.5;
  const scale = maxDimension > 0 ? targetSize / maxDimension : 1.0;
  
  console.log(`  Escala automática: ${scale.toFixed(3)} (tamaño objetivo: ${targetSize})`);
  
  // Función auxiliar para centrar y escalar posiciones de un material
  function centerAndScale(positions, normals) {
    const scaledPositions = new Float32Array(positions.length);
    
    for (let i = 0; i < positions.length; i += 3) {
      // Primero centrar (trasladar al origen)
      const centeredX = positions[i] - centerX;
      const centeredY = positions[i + 1] - centerY;
      const centeredZ = positions[i + 2] - centerZ;
      
      // Luego escalar
      scaledPositions[i] = centeredX * scale;
      scaledPositions[i + 1] = centeredY * scale;
      scaledPositions[i + 2] = centeredZ * scale;
    }
    
    // Verificar y corregir el centrado en X y Z con alta precisión
    // Esto es crítico para que cada parte del modelo esté centrada antes de combinar
    let minX = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < scaledPositions.length; i += 3) {
      minX = Math.min(minX, scaledPositions[i]);
      maxX = Math.max(maxX, scaledPositions[i]);
      minZ = Math.min(minZ, scaledPositions[i + 2]);
      maxZ = Math.max(maxZ, scaledPositions[i + 2]);
    }
    
    const finalCenterX = (minX + maxX) / 2;
    const finalCenterZ = (minZ + maxZ) / 2;
    
    // Ajustar SIEMPRE para garantizar centrado perfecto (tolerancia muy pequeña)
    if (Math.abs(finalCenterX) > 0.0001 || Math.abs(finalCenterZ) > 0.0001) {
      for (let i = 0; i < scaledPositions.length; i += 3) {
        scaledPositions[i] -= finalCenterX;
        scaledPositions[i + 2] -= finalCenterZ;
      }
    }
    
    return scaledPositions;
  }
  
  // PASO 1: Primero calcular el bounding box combinado de AMBOS materiales
  // antes de centrar, para asegurar que usamos el centro correcto del modelo completo
  // Esto es crítico porque cada material puede tener diferentes vértices
  let combinedOriginalMinX = Infinity, combinedOriginalMaxX = -Infinity;
  let combinedOriginalMinY = Infinity, combinedOriginalMaxY = -Infinity;
  let combinedOriginalMinZ = Infinity, combinedOriginalMaxZ = -Infinity;
  
  // Calcular bounding box de White
  for (let i = 0; i < objData.white.positions.length; i += 3) {
    combinedOriginalMinX = Math.min(combinedOriginalMinX, objData.white.positions[i]);
    combinedOriginalMaxX = Math.max(combinedOriginalMaxX, objData.white.positions[i]);
    combinedOriginalMinY = Math.min(combinedOriginalMinY, objData.white.positions[i + 1]);
    combinedOriginalMaxY = Math.max(combinedOriginalMaxY, objData.white.positions[i + 1]);
    combinedOriginalMinZ = Math.min(combinedOriginalMinZ, objData.white.positions[i + 2]);
    combinedOriginalMaxZ = Math.max(combinedOriginalMaxZ, objData.white.positions[i + 2]);
  }
  
  // Calcular bounding box de Black y combinar
  for (let i = 0; i < objData.black.positions.length; i += 3) {
    combinedOriginalMinX = Math.min(combinedOriginalMinX, objData.black.positions[i]);
    combinedOriginalMaxX = Math.max(combinedOriginalMaxX, objData.black.positions[i]);
    combinedOriginalMinY = Math.min(combinedOriginalMinY, objData.black.positions[i + 1]);
    combinedOriginalMaxY = Math.max(combinedOriginalMaxY, objData.black.positions[i + 1]);
    combinedOriginalMinZ = Math.min(combinedOriginalMinZ, objData.black.positions[i + 2]);
    combinedOriginalMaxZ = Math.max(combinedOriginalMaxZ, objData.black.positions[i + 2]);
  }
  
  // PASO 1: Calcular el CENTRO DE MASA del modelo ORIGINAL (más preciso que bounding box)
  // El centro de masa es el promedio de todos los vértices, ideal para modelos asimétricos
  let originalSumX = 0, originalSumY = 0, originalSumZ = 0;
  let originalVertexCount = 0;
  
  // Calcular suma de posiciones originales de ambos materiales
  for (let i = 0; i < objData.white.positions.length; i += 3) {
    originalSumX += objData.white.positions[i];
    originalSumY += objData.white.positions[i + 1];
    originalSumZ += objData.white.positions[i + 2];
    originalVertexCount++;
  }
  for (let i = 0; i < objData.black.positions.length; i += 3) {
    originalSumX += objData.black.positions[i];
    originalSumY += objData.black.positions[i + 1];
    originalSumZ += objData.black.positions[i + 2];
    originalVertexCount++;
  }
  
  // Centro de masa del modelo original
  const originalCenterOfMassX = originalSumX / originalVertexCount;
  const originalCenterOfMassY = combinedOriginalMinY; // Base siempre en y=0
  const originalCenterOfMassZ = originalSumZ / originalVertexCount;
  
  // Calcular escala basada en el bounding box combinado
  const combinedWidth = combinedOriginalMaxX - combinedOriginalMinX;
  const combinedHeight = combinedOriginalMaxY - combinedOriginalMinY;
  const combinedDepth = combinedOriginalMaxZ - combinedOriginalMinZ;
  const combinedMaxDimension = Math.max(combinedWidth, combinedHeight, combinedDepth);
  const combinedScale = combinedMaxDimension > 0 ? targetSize / combinedMaxDimension : 1.0;
  
  console.log(`  Bounding box original: min [${combinedOriginalMinX.toFixed(2)}, ${combinedOriginalMinY.toFixed(2)}, ${combinedOriginalMinZ.toFixed(2)}], max [${combinedOriginalMaxX.toFixed(2)}, ${combinedOriginalMaxY.toFixed(2)}, ${combinedOriginalMaxZ.toFixed(2)}]`);
  console.log(`  Centro de masa original: [${originalCenterOfMassX.toFixed(2)}, ${originalCenterOfMassY.toFixed(2)}, ${originalCenterOfMassZ.toFixed(2)}]`);
  console.log(`  Escala: ${combinedScale.toFixed(3)}`);
  
  // PASO 2: Centrar usando centro de masa Y escalar en una sola pasada
  // Esto garantiza que el modelo quede centrado en (0,0,0) con base en y=0
  function centerAndScaleUsingCenterOfMass(positions) {
    const result = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      // Centrar usando el centro de masa (más preciso)
      const centeredX = positions[i] - originalCenterOfMassX;
      const centeredY = positions[i + 1] - originalCenterOfMassY; // Base en y=0
      const centeredZ = positions[i + 2] - originalCenterOfMassZ;
      
      // Escalar
      result[i] = centeredX * combinedScale;
      result[i + 1] = centeredY * combinedScale;
      result[i + 2] = centeredZ * combinedScale;
    }
    return result;
  }
  
  const whitePositions = centerAndScaleUsingCenterOfMass(objData.white.positions);
  const blackPositions = centerAndScaleUsingCenterOfMass(objData.black.positions);
  
  // PASO 3: Verificar y corregir el centrado usando corrección iterativa
  // Usamos corrección iterativa hasta que tanto el centro de masa como el bounding box estén en (0,0)
  // Esto garantiza el centrado perfecto visual y geométrico
  
  let iterations = 0;
  const maxIterations = 5;
  
  // Calcular centro inicial para empezar la corrección
  let initialSumX = 0, initialSumZ = 0, initialCount = 0;
  for (let i = 0; i < whitePositions.length; i += 3) {
    initialSumX += whitePositions[i];
    initialSumZ += whitePositions[i + 2];
    initialCount++;
  }
  for (let i = 0; i < blackPositions.length; i += 3) {
    initialSumX += blackPositions[i];
    initialSumZ += blackPositions[i + 2];
    initialCount++;
  }
  
  if (initialCount === 0) {
    throw new Error('Error: No se encontraron vértices en el modelo OBJ');
  }
  
  let currentCorrectionX = initialSumX / initialCount;
  let currentCorrectionZ = initialSumZ / initialCount;
  
  // Validar que los valores sean números válidos
  if (isNaN(currentCorrectionX) || isNaN(currentCorrectionZ) || 
      !isFinite(currentCorrectionX) || !isFinite(currentCorrectionZ)) {
    throw new Error(`Error: Valores de corrección inválidos (X: ${currentCorrectionX}, Z: ${currentCorrectionZ})`);
  }
  
  while (iterations < maxIterations) {
    // Aplicar corrección actual
    if (Math.abs(currentCorrectionX) > 0.00001 || Math.abs(currentCorrectionZ) > 0.00001) {
      for (let i = 0; i < whitePositions.length; i += 3) {
        whitePositions[i] -= currentCorrectionX;
        whitePositions[i + 2] -= currentCorrectionZ;
      }
      for (let i = 0; i < blackPositions.length; i += 3) {
        blackPositions[i] -= currentCorrectionX;
        blackPositions[i + 2] -= currentCorrectionZ;
      }
    }
    
    // Recalcular centro de masa y bounding box
    let sumX = 0, sumZ = 0, count = 0;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < whitePositions.length; i += 3) {
      sumX += whitePositions[i];
      sumZ += whitePositions[i + 2];
      minX = Math.min(minX, whitePositions[i]);
      maxX = Math.max(maxX, whitePositions[i]);
      minZ = Math.min(minZ, whitePositions[i + 2]);
      maxZ = Math.max(maxZ, whitePositions[i + 2]);
      count++;
    }
    for (let i = 0; i < blackPositions.length; i += 3) {
      sumX += blackPositions[i];
      sumZ += blackPositions[i + 2];
      minX = Math.min(minX, blackPositions[i]);
      maxX = Math.max(maxX, blackPositions[i]);
      minZ = Math.min(minZ, blackPositions[i + 2]);
      maxZ = Math.max(maxZ, blackPositions[i + 2]);
      count++;
    }
    
    const centerOfMassX = sumX / count;
    const centerOfMassZ = sumZ / count;
    const boundingBoxCenterX = (minX + maxX) / 2;
    const boundingBoxCenterZ = (minZ + maxZ) / 2;
    
    // Usar el promedio del centro de masa y el centro del bounding box para la corrección
    // Esto asegura que ambos queden centrados
    currentCorrectionX = (centerOfMassX + boundingBoxCenterX) / 2;
    currentCorrectionZ = (centerOfMassZ + boundingBoxCenterZ) / 2;
    
    iterations++;
    
    // Si ya está centrado (ambos están muy cerca de 0), terminar
    if (Math.abs(centerOfMassX) < 0.00001 && Math.abs(centerOfMassZ) < 0.00001 &&
        Math.abs(boundingBoxCenterX) < 0.00001 && Math.abs(boundingBoxCenterZ) < 0.00001) {
      break;
    }
  }
  
  // Verificación final después de la corrección iterativa
  let verifySumX = 0, verifySumZ = 0, verifyCount = 0;
  let verifyMinX = Infinity, verifyMaxX = -Infinity;
  let verifyMinY = Infinity, verifyMaxY = -Infinity;
  let verifyMinZ = Infinity, verifyMaxZ = -Infinity;
  
  for (let i = 0; i < whitePositions.length; i += 3) {
    verifySumX += whitePositions[i];
    verifySumZ += whitePositions[i + 2];
    verifyMinX = Math.min(verifyMinX, whitePositions[i]);
    verifyMaxX = Math.max(verifyMaxX, whitePositions[i]);
    verifyMinY = Math.min(verifyMinY, whitePositions[i + 1]);
    verifyMaxY = Math.max(verifyMaxY, whitePositions[i + 1]);
    verifyMinZ = Math.min(verifyMinZ, whitePositions[i + 2]);
    verifyMaxZ = Math.max(verifyMaxZ, whitePositions[i + 2]);
    verifyCount++;
  }
  for (let i = 0; i < blackPositions.length; i += 3) {
    verifySumX += blackPositions[i];
    verifySumZ += blackPositions[i + 2];
    verifyMinX = Math.min(verifyMinX, blackPositions[i]);
    verifyMaxX = Math.max(verifyMaxX, blackPositions[i]);
    verifyMinY = Math.min(verifyMinY, blackPositions[i + 1]);
    verifyMaxY = Math.max(verifyMaxY, blackPositions[i + 1]);
    verifyMinZ = Math.min(verifyMinZ, blackPositions[i + 2]);
    verifyMaxZ = Math.max(verifyMaxZ, blackPositions[i + 2]);
    verifyCount++;
  }
  
  let verifyCenterOfMassX = verifySumX / verifyCount;
  let verifyCenterOfMassZ = verifySumZ / verifyCount;
  let verifyBoundingBoxCenterX = (verifyMinX + verifyMaxX) / 2;
  let verifyBoundingBoxCenterZ = (verifyMinZ + verifyMaxZ) / 2;
  
  // CORRECCIÓN FINAL: Usar el centro de masa para el centrado visual
  // El centro de masa es más representativo del "centro visual" del modelo, especialmente para modelos asimétricos
  // Primero corregimos usando el centro de masa, luego verificamos el bounding box
  let finalCorrectionX = verifyCenterOfMassX;
  let finalCorrectionZ = verifyCenterOfMassZ;
  
  if (Math.abs(finalCorrectionX) > 0.00001 || Math.abs(finalCorrectionZ) > 0.00001) {
    console.log(`  ⚠️ Aplicando corrección final usando centro de masa: restando [${finalCorrectionX.toFixed(8)}, ${finalCorrectionZ.toFixed(8)}]`);
    for (let i = 0; i < whitePositions.length; i += 3) {
      whitePositions[i] -= finalCorrectionX;
      whitePositions[i + 2] -= finalCorrectionZ;
    }
    for (let i = 0; i < blackPositions.length; i += 3) {
      blackPositions[i] -= finalCorrectionX;
      blackPositions[i + 2] -= finalCorrectionZ;
    }
    
    // Recalcular después de la corrección final
    verifyMinX = Infinity; verifyMaxX = -Infinity;
    verifyMinZ = Infinity; verifyMaxZ = -Infinity;
    verifySumX = 0; verifySumZ = 0;
    for (let i = 0; i < whitePositions.length; i += 3) {
      verifySumX += whitePositions[i];
      verifySumZ += whitePositions[i + 2];
      verifyMinX = Math.min(verifyMinX, whitePositions[i]);
      verifyMaxX = Math.max(verifyMaxX, whitePositions[i]);
      verifyMinZ = Math.min(verifyMinZ, whitePositions[i + 2]);
      verifyMaxZ = Math.max(verifyMaxZ, whitePositions[i + 2]);
    }
    for (let i = 0; i < blackPositions.length; i += 3) {
      verifySumX += blackPositions[i];
      verifySumZ += blackPositions[i + 2];
      verifyMinX = Math.min(verifyMinX, blackPositions[i]);
      verifyMaxX = Math.max(verifyMaxX, blackPositions[i]);
      verifyMinZ = Math.min(verifyMinZ, blackPositions[i + 2]);
      verifyMaxZ = Math.max(verifyMaxZ, blackPositions[i + 2]);
    }
    verifyCenterOfMassX = verifySumX / verifyCount;
    verifyCenterOfMassZ = verifySumZ / verifyCount;
    verifyBoundingBoxCenterX = (verifyMinX + verifyMaxX) / 2;
    verifyBoundingBoxCenterZ = (verifyMinZ + verifyMaxZ) / 2;
  }
  
  // CORRECCIÓN SECUNDARIA: Si el bounding box todavía tiene un offset significativo después de centrar por masa,
  // aplicar una corrección sutil (solo 30% del offset) para mejorar el centrado visual sin afectar mucho el centro de masa
  if (Math.abs(verifyBoundingBoxCenterX) > 0.001 || Math.abs(verifyBoundingBoxCenterZ) > 0.001) {
    const secondaryCorrectionX = verifyBoundingBoxCenterX * 0.3; // Solo 30% del offset
    const secondaryCorrectionZ = verifyBoundingBoxCenterZ * 0.3;
    console.log(`  ⚠️ Aplicando corrección secundaria sutil del bounding box: restando [${secondaryCorrectionX.toFixed(8)}, ${secondaryCorrectionZ.toFixed(8)}]`);
    for (let i = 0; i < whitePositions.length; i += 3) {
      whitePositions[i] -= secondaryCorrectionX;
      whitePositions[i + 2] -= secondaryCorrectionZ;
    }
    for (let i = 0; i < blackPositions.length; i += 3) {
      blackPositions[i] -= secondaryCorrectionX;
      blackPositions[i + 2] -= secondaryCorrectionZ;
    }
    
    // Recalcular una última vez
    verifyMinX = Infinity; verifyMaxX = -Infinity;
    verifyMinZ = Infinity; verifyMaxZ = -Infinity;
    verifySumX = 0; verifySumZ = 0;
    for (let i = 0; i < whitePositions.length; i += 3) {
      verifySumX += whitePositions[i];
      verifySumZ += whitePositions[i + 2];
      verifyMinX = Math.min(verifyMinX, whitePositions[i]);
      verifyMaxX = Math.max(verifyMaxX, whitePositions[i]);
      verifyMinZ = Math.min(verifyMinZ, whitePositions[i + 2]);
      verifyMaxZ = Math.max(verifyMaxZ, whitePositions[i + 2]);
    }
    for (let i = 0; i < blackPositions.length; i += 3) {
      verifySumX += blackPositions[i];
      verifySumZ += blackPositions[i + 2];
      verifyMinX = Math.min(verifyMinX, blackPositions[i]);
      verifyMaxX = Math.max(verifyMaxX, blackPositions[i]);
      verifyMinZ = Math.min(verifyMinZ, blackPositions[i + 2]);
      verifyMaxZ = Math.max(verifyMaxZ, blackPositions[i + 2]);
    }
    verifyCenterOfMassX = verifySumX / verifyCount;
    verifyCenterOfMassZ = verifySumZ / verifyCount;
    verifyBoundingBoxCenterX = (verifyMinX + verifyMaxX) / 2;
    verifyBoundingBoxCenterZ = (verifyMinZ + verifyMaxZ) / 2;
  }
  
  console.log(`  ✓ Centrado iterativo completado (${iterations} iteraciones):`);
  console.log(`    - Centro de masa final: [${verifyCenterOfMassX.toFixed(8)}, ${verifyCenterOfMassZ.toFixed(8)}]`);
  console.log(`    - Centro bounding box final: [${verifyBoundingBoxCenterX.toFixed(8)}, ${verifyBoundingBoxCenterZ.toFixed(8)}]`);
  console.log(`    - Bounding box: X[${verifyMinX.toFixed(4)}, ${verifyMaxX.toFixed(4)}], Y[${verifyMinY.toFixed(4)}, ${verifyMaxY.toFixed(4)}], Z[${verifyMinZ.toFixed(4)}, ${verifyMaxZ.toFixed(4)}]`);
  
  // Verificar que la base esté en y=0
  if (Math.abs(verifyMinY) > 0.01) {
    console.warn(`  ⚠️ ADVERTENCIA: La base del modelo no está en y=0. minY=${verifyMinY.toFixed(4)}`);
  } else {
    console.log(`  ✓ Base del modelo en y=${verifyMinY.toFixed(4)}`);
  }
  
  // Verificación final de centrado
  // Verificar que tanto el bounding box como el centro de masa estén centrados
  const isBoundingBoxCentered = Math.abs(verifyBoundingBoxCenterX) < 0.00001 && Math.abs(verifyBoundingBoxCenterZ) < 0.00001;
  const isCenterOfMassCentered = Math.abs(verifyCenterOfMassX) < 0.00001 && Math.abs(verifyCenterOfMassZ) < 0.00001;
  
  if (isBoundingBoxCentered && isCenterOfMassCentered) {
    console.log(`  ✓ Modelo perfectamente centrado (base en y=${verifyMinY.toFixed(4)}, centro visual en x=0, z=0)`);
  } else {
    console.warn(`  ⚠️ ADVERTENCIA: El modelo aún no está perfectamente centrado.`);
    console.warn(`    - Centro bounding box: [${verifyBoundingBoxCenterX.toFixed(8)}, ${verifyBoundingBoxCenterZ.toFixed(8)}]`);
    console.warn(`    - Centro de masa: [${verifyCenterOfMassX.toFixed(8)}, ${verifyCenterOfMassZ.toFixed(8)}]`);
  }
  
  // Crear buffers WebGL para cada material
  const whitePositionBuffer = createBuffer(gl, whitePositions);
  const whiteNormalBuffer = createBuffer(gl, objData.white.normals);
  const whiteIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, whiteIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, objData.white.indices, gl.STATIC_DRAW);
  
  const blackPositionBuffer = createBuffer(gl, blackPositions);
  const blackNormalBuffer = createBuffer(gl, objData.black.normals);
  const blackIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, blackIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, objData.black.indices, gl.STATIC_DRAW);
  
    console.log(`  ✓ Buffers WebGL creados para ambos materiales`);
    
    // Validar que todos los buffers se crearon correctamente
    if (!whitePositionBuffer || !whiteNormalBuffer || !whiteIndexBuffer ||
        !blackPositionBuffer || !blackNormalBuffer || !blackIndexBuffer) {
      throw new Error('Error: No se pudieron crear todos los buffers WebGL');
    }
    
    // Retornar objeto con los buffers de ambos materiales
    return {
      white: {
        positionBuffer: whitePositionBuffer,
        normalBuffer: whiteNormalBuffer,
        indexBuffer: whiteIndexBuffer,
        indexCount: objData.white.indices.length
      },
      black: {
        positionBuffer: blackPositionBuffer,
        normalBuffer: blackNormalBuffer,
        indexBuffer: blackIndexBuffer,
        indexCount: objData.black.indices.length
      },
      materialColor: materialColor // Color del MTL (por compatibilidad)
    };
  } catch (error) {
    console.error(`❌ ERROR en loadObjWithMtl: ${error.message}`);
    console.error('  Stack trace:', error.stack);
    throw error; // Re-lanzar el error para que main.js lo capture
  }
}

