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
    throw new Error(`Error: No se pudo cargar ${objUrl}`);
  }
  const objText = await objResponse.text();
  const objData = parseOBJ(objText);
  
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
  
  // Calcular el centro del modelo combinado (igual que los árboles que se generan en (0,0,0))
  const combinedCenterX = (combinedOriginalMinX + combinedOriginalMaxX) / 2;
  const combinedCenterY = combinedOriginalMinY; // Base en y=0
  const combinedCenterZ = (combinedOriginalMinZ + combinedOriginalMaxZ) / 2;
  
  // Recalcular escala basada en el bounding box combinado
  const combinedWidth = combinedOriginalMaxX - combinedOriginalMinX;
  const combinedHeight = combinedOriginalMaxY - combinedOriginalMinY;
  const combinedDepth = combinedOriginalMaxZ - combinedOriginalMinZ;
  const combinedMaxDimension = Math.max(combinedWidth, combinedHeight, combinedDepth);
  const combinedScale = combinedMaxDimension > 0 ? targetSize / combinedMaxDimension : 1.0;
  
  console.log(`  Bounding box combinado: min [${combinedOriginalMinX.toFixed(2)}, ${combinedOriginalMinY.toFixed(2)}, ${combinedOriginalMinZ.toFixed(2)}], max [${combinedOriginalMaxX.toFixed(2)}, ${combinedOriginalMaxY.toFixed(2)}, ${combinedOriginalMaxZ.toFixed(2)}]`);
  console.log(`  Centro combinado: [${combinedCenterX.toFixed(2)}, ${combinedCenterY.toFixed(2)}, ${combinedCenterZ.toFixed(2)}]`);
  console.log(`  Escala combinada: ${combinedScale.toFixed(3)}`);
  
  // PASO 2: Centrar y escalar cada material usando el centro combinado
  // Usar el centro combinado garantiza que ambos materiales queden perfectamente alineados
  function centerAndScaleCombined(positions) {
    const result = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      // Centrar usando el centro combinado
      const centeredX = positions[i] - combinedCenterX;
      const centeredY = positions[i + 1] - combinedCenterY;
      const centeredZ = positions[i + 2] - combinedCenterZ;
      
      // Escalar
      result[i] = centeredX * combinedScale;
      result[i + 1] = centeredY * combinedScale;
      result[i + 2] = centeredZ * combinedScale;
    }
    return result;
  }
  
  const whitePositions = centerAndScaleCombined(objData.white.positions);
  const blackPositions = centerAndScaleCombined(objData.black.positions);
  
  // PASO 3: Verificar el centrado final combinado usando CENTRO DE MASA (promedio de todos los vértices)
  // Esto es más preciso que usar solo el bounding box, especialmente para modelos asimétricos
  // Los árboles se generan directamente centrados en (0,0,0), así que su centro de masa es exactamente (0,0,0)
  let sumX = 0, sumZ = 0;
  let vertexCount = 0;
  
  // Calcular la suma de todas las posiciones X y Z
  for (let i = 0; i < whitePositions.length; i += 3) {
    sumX += whitePositions[i];
    sumZ += whitePositions[i + 2];
    vertexCount++;
  }
  
  for (let i = 0; i < blackPositions.length; i += 3) {
    sumX += blackPositions[i];
    sumZ += blackPositions[i + 2];
    vertexCount++;
  }
  
  // Centro de masa (promedio de todos los vértices)
  const centerOfMassX = sumX / vertexCount;
  const centerOfMassZ = sumZ / vertexCount;
  
  // También calcular bounding box para referencia
  let combinedMinX = Infinity, combinedMaxX = -Infinity;
  let combinedMinZ = Infinity, combinedMaxZ = -Infinity;
  
  for (let i = 0; i < whitePositions.length; i += 3) {
    combinedMinX = Math.min(combinedMinX, whitePositions[i]);
    combinedMaxX = Math.max(combinedMaxX, whitePositions[i]);
    combinedMinZ = Math.min(combinedMinZ, whitePositions[i + 2]);
    combinedMaxZ = Math.max(combinedMaxZ, whitePositions[i + 2]);
  }
  
  for (let i = 0; i < blackPositions.length; i += 3) {
    combinedMinX = Math.min(combinedMinX, blackPositions[i]);
    combinedMaxX = Math.max(combinedMaxX, blackPositions[i]);
    combinedMinZ = Math.min(combinedMinZ, blackPositions[i + 2]);
    combinedMaxZ = Math.max(combinedMaxZ, blackPositions[i + 2]);
  }
  
  const boundingBoxCenterX = (combinedMinX + combinedMaxX) / 2;
  const boundingBoxCenterZ = (combinedMinZ + combinedMaxZ) / 2;
  
  // Usar el centro de masa para el ajuste final (más preciso para modelos asimétricos)
  const finalCombinedCenterX = centerOfMassX;
  const finalCombinedCenterZ = centerOfMassZ;
  
  console.log(`  Centro de masa (${vertexCount} vértices): [${centerOfMassX.toFixed(8)}, ${centerOfMassZ.toFixed(8)}]`);
  console.log(`  Centro bounding box: [${boundingBoxCenterX.toFixed(8)}, ${boundingBoxCenterZ.toFixed(8)}]`);
  
  console.log(`  Bounding box después de centrar/escalar: minX=${combinedMinX.toFixed(4)}, maxX=${combinedMaxX.toFixed(4)}, minZ=${combinedMinZ.toFixed(4)}, maxZ=${combinedMaxZ.toFixed(4)}`);
  console.log(`  Centro calculado después de centrar/escalar: [${finalCombinedCenterX.toFixed(6)}, ${finalCombinedCenterZ.toFixed(6)}]`);
  
  // CRÍTICO: Ajustar SIEMPRE para garantizar centrado perfecto en (0, 0, 0)
  // Igual que los árboles que se generan directamente centrados, las ovejas deben
  // estar perfectamente centradas en x=0, z=0 para que coincidan con el centro del hexágono
  // Aplicamos el ajuste final SIEMPRE, sin condiciones, para garantizar precisión absoluta
  console.log(`  ⚠️ Aplicando ajuste final: restando [${finalCombinedCenterX.toFixed(8)}, ${finalCombinedCenterZ.toFixed(8)}]`);
  for (let i = 0; i < whitePositions.length; i += 3) {
    whitePositions[i] -= finalCombinedCenterX;
    whitePositions[i + 2] -= finalCombinedCenterZ;
  }
  for (let i = 0; i < blackPositions.length; i += 3) {
    blackPositions[i] -= finalCombinedCenterX;
    blackPositions[i + 2] -= finalCombinedCenterZ;
  }
  
  // VERIFICACIÓN FINAL: Asegurar que después del ajuste, el modelo esté realmente en (0, 0, 0)
  // Recalcular el bounding box para verificar
  let verifyMinX = Infinity, verifyMaxX = -Infinity;
  let verifyMinZ = Infinity, verifyMaxZ = -Infinity;
  
  for (let i = 0; i < whitePositions.length; i += 3) {
    verifyMinX = Math.min(verifyMinX, whitePositions[i]);
    verifyMaxX = Math.max(verifyMaxX, whitePositions[i]);
    verifyMinZ = Math.min(verifyMinZ, whitePositions[i + 2]);
    verifyMaxZ = Math.max(verifyMaxZ, whitePositions[i + 2]);
  }
  
  for (let i = 0; i < blackPositions.length; i += 3) {
    verifyMinX = Math.min(verifyMinX, blackPositions[i]);
    verifyMaxX = Math.max(verifyMaxX, blackPositions[i]);
    verifyMinZ = Math.min(verifyMinZ, blackPositions[i + 2]);
    verifyMaxZ = Math.max(verifyMaxZ, blackPositions[i + 2]);
  }
  
  const verifyCenterX = (verifyMinX + verifyMaxX) / 2;
  const verifyCenterZ = (verifyMinZ + verifyMaxZ) / 2;
  
  console.log(`  Verificación final - Centro después del ajuste: [${verifyCenterX.toFixed(8)}, ${verifyCenterZ.toFixed(8)}]`);
  console.log(`  Verificación final - Rango X: [${verifyMinX.toFixed(4)}, ${verifyMaxX.toFixed(4)}], Rango Z: [${verifyMinZ.toFixed(4)}, ${verifyMaxZ.toFixed(4)}]`);
  
  // Si después del ajuste todavía no está perfectamente centrado, ajustar una vez más
  if (Math.abs(verifyCenterX) > 0.0000001 || Math.abs(verifyCenterZ) > 0.0000001) {
    console.log(`  ⚠️ Segunda corrección necesaria: restando [${verifyCenterX.toFixed(8)}, ${verifyCenterZ.toFixed(8)}]`);
    for (let i = 0; i < whitePositions.length; i += 3) {
      whitePositions[i] -= verifyCenterX;
      whitePositions[i + 2] -= verifyCenterZ;
    }
    for (let i = 0; i < blackPositions.length; i += 3) {
      blackPositions[i] -= verifyCenterX;
      blackPositions[i + 2] -= verifyCenterZ;
    }
    
    // Verificar una tercera vez
    verifyMinX = Infinity; verifyMaxX = -Infinity;
    verifyMinZ = Infinity; verifyMaxZ = -Infinity;
    for (let i = 0; i < whitePositions.length; i += 3) {
      verifyMinX = Math.min(verifyMinX, whitePositions[i]);
      verifyMaxX = Math.max(verifyMaxX, whitePositions[i]);
      verifyMinZ = Math.min(verifyMinZ, whitePositions[i + 2]);
      verifyMaxZ = Math.max(verifyMaxZ, whitePositions[i + 2]);
    }
    for (let i = 0; i < blackPositions.length; i += 3) {
      verifyMinX = Math.min(verifyMinX, blackPositions[i]);
      verifyMaxX = Math.max(verifyMaxX, blackPositions[i]);
      verifyMinZ = Math.min(verifyMinZ, blackPositions[i + 2]);
      verifyMaxZ = Math.max(verifyMaxZ, blackPositions[i + 2]);
    }
    const finalVerifyCenterX = (verifyMinX + verifyMaxX) / 2;
    const finalVerifyCenterZ = (verifyMinZ + verifyMaxZ) / 2;
    console.log(`  ✓ Segunda corrección aplicada. Centro final: [${finalVerifyCenterX.toFixed(8)}, ${finalVerifyCenterZ.toFixed(8)}]`);
  } else {
    console.log(`  ✓ Modelo perfectamente centrado en [0.000000, 0.000000]`);
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
}

