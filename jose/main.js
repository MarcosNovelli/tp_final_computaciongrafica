/**
 * ============================================================
 * main.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo es el punto de entrada principal de la aplicación.
 * Su responsabilidad es:
 * - Definir los shaders específicos de esta aplicación
 * - Crear los datos de la geometría (triángulo, hexágonos, etc.)
 * - Orquestar la inicialización y el dibujado
 * - Coordinar el flujo principal de la aplicación
 * 
 * NO contiene funciones genéricas de WebGL (esas están en render/gl.js).
 * Solo contiene la lógica específica de esta aplicación.
 * 
 * NOTA: Para usar módulos ES6, necesitarías un servidor o usar import/export.
 * Por simplicidad, el bioma está definido inline aquí. Si usas un bundler,
 * puedes importar desde biomes.js con: import { grassBiome } from './biomes.js';
 */

/**
 * ============================================================
 * CONSTANTES GLOBALES
 * ============================================================
 */

/**
 * Factor de escala para la altura visual de las columnas hexagonales.
 * 
 * SEPARACIÓN ENTRE ALTURA LÓGICA Y ALTURA VISUAL:
 * - Altura lógica (cell.height): valor entero que representa la altura relativa
 *   de una celda (ej: 1, 2, 3). Esta es la altura "semántica" usada en la
 *   lógica del juego/terreno y en los biomas.
 * - Altura visual (visualHeight): altura física real en unidades del mundo 3D.
 *   Se calcula como: visualHeight = cell.height * HEIGHT_UNIT
 * 
 * PROPÓSITO:
 * Este factor permite ajustar la escala visual de las columnas sin modificar
 * los valores lógicos de altura. Por ejemplo:
 * - Si HEIGHT_UNIT = 0.3 y cell.height = 2:
 *   → visualHeight = 2 * 0.3 = 0.6 unidades en el mundo 3D
 * - Si HEIGHT_UNIT = 1.0 (valor anterior):
 *   → visualHeight = 2 * 1.0 = 2.0 unidades (demasiado alto)
 * 
 * VENTAJAS:
 * - Puedes ajustar la apariencia visual sin cambiar la generación de terrenos
 * - Mantiene la coherencia entre altura lógica (usada en biomas, gameplay)
 *   y altura visual (usada solo para renderizado)
 * - Permite experimentar con diferentes escalas visuales fácilmente
 */
const HEIGHT_UNIT = 0.3;

/**
 * Radio de la grilla hexagonal (distancia máxima desde el centro).
 * 
 * Define el tamaño del terreno hexagonal generado. Todas las celdas con
 * distancia hexagonal desde el centro (0, 0) menor o igual a GRID_RADIUS
 * serán generadas.
 * 
 * Ejemplo: GRID_RADIUS = 20 genera un terreno hexagonal de aproximadamente
 * 20 hexágonos de radio desde el centro, formando un hexágono grande.
 */
const GRID_RADIUS = 8;

/**
 * Densidad de árboles en el bioma Grass (porcentaje de celdas que tendrán un árbol).
 * 
 * Valor entre 0.0 y 1.0:
 * - 0.0 = ningún árbol
 * - 1.0 = un árbol en cada celda
 * - 0.08 = aproximadamente 8% de las celdas tendrán un árbol
 */
const TREE_DENSITY = 0.08;

/**
 * Densidad de ovejas en el bioma Grass (porcentaje de celdas que tendrán una oveja).
 * 
 * Valor entre 0.0 y 1.0:
 * - 0.0 = ninguna oveja
 * - 1.0 = una oveja en cada celda
 * - 0.04 = aproximadamente 4% de las celdas tendrán una oveja
 */
const SHEEP_DENSITY = 0.04;

/**
 * Color para la copa de los árboles (verde oscuro estilo low-poly).
 * 
 * Se aplica como uniform u_color al fragment shader.
 * Formato: [R, G, B] con valores de 0.0 a 1.0
 */
const TREE_CROWN_COLOR = [0.1, 0.35, 0.1]; // Verde oscuro para la copa

/**
 * Color para el tronco de los árboles (marrón oscuro como en la imagen de referencia).
 * 
 * Se aplica como uniform u_color al fragment shader.
 * Formato: [R, G, B] con valores de 0.0 a 1.0
 */
const TREE_TRUNK_COLOR = [0.35, 0.2, 0.12]; // Marrón oscuro para el tronco

/**
 * Radio del hexágono en unidades del mundo (distancia del centro a un vértice).
 * 
 * IMPORTANTE: Esta es la ÚNICA constante que define el tamaño físico del hexágono.
 * Debe usarse consistentemente en:
 * - La generación de vértices del prisma hexagonal (createHexagonPrismData)
 * - La conversión de coordenadas axiales a posiciones 3D (hexToPixel3D)
 * 
 * RELACIÓN CON LA FÓRMULA DE TESELADO:
 * Para hexágonos "pointy-top" (con un vértice apuntando hacia arriba), la fórmula
 * estándar para convertir coordenadas axiales (q, r) a posición (x, z) es:
 * 
 *   x = HEX_RADIUS_WORLD * sqrt(3) * (q + r / 2.0)
 *   z = HEX_RADIUS_WORLD * 1.5 * r
 * 
 * Esta fórmula garantiza que los hexágonos se toquen perfectamente en sus bordes
 * sin huecos ni solapamientos, formando un mosaico perfecto.
 * 
 * La distancia entre centros de hexágonos adyacentes es exactamente:
 *   HEX_RADIUS_WORLD * sqrt(3)
 * 
 * IMPORTANTE: Este valor debe ser el MISMO tanto para generar los vértices del
 * hexágono como para calcular las posiciones de los centros en la grilla.
 */
const HEX_RADIUS_WORLD = 0.5;

/**
 * ============================================================
 * MATRICES 3D
 * ============================================================
 * 
 * Funciones para crear matrices 3D necesarias para cámara y proyección.
 */

/**
 * Multiplica dos matrices 4x4.
 * 
 * @param {Float32Array} a - Primera matriz 4x4 (16 elementos)
 * @param {Float32Array} b - Segunda matriz 4x4 (16 elementos)
 * @returns {Float32Array} Resultado de a * b (matriz 4x4)
 */
function multiplyMat4(a, b) {
  const out = new Float32Array(16);
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = 
        a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }
  
  return out;
}

/**
 * Crea una matriz de identidad 4x4.
 * 
 * @returns {Float32Array} Matriz identidad 4x4
 */
function identityMat4() {
  const out = new Float32Array(16);
  out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
  return out;
}

/**
 * Crea una matriz de proyección en perspectiva.
 * 
 * @param {number} fov - Campo de visión en grados (field of view)
 * @param {number} aspect - Aspect ratio (ancho / alto del canvas)
 * @param {number} near - Plano cercano (distancia mínima visible)
 * @param {number} far - Plano lejano (distancia máxima visible)
 * @returns {Float32Array} Matriz de proyección perspectiva 4x4
 */
function perspective(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov * Math.PI / 360.0); // Convertir FOV a radianes y calcular cotangente
  const rangeInv = 1.0 / (near - far);
  
  const out = new Float32Array(16);
  
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (near + far) * rangeInv;
  out[11] = -1;
  out[14] = near * far * rangeInv * 2;
  out[15] = 0;
  
  return out;
}

/**
 * Normaliza un vector 3D.
 * 
 * @param {number[]} v - Vector [x, y, z]
 * @returns {number[]} Vector normalizado [x, y, z]
 */
function normalizeVec3(v) {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (length === 0) return [0, 0, 0];
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Producto cruzado entre dos vectores 3D.
 * 
 * @param {number[]} a - Primer vector [x, y, z]
 * @param {number[]} b - Segundo vector [x, y, z]
 * @returns {number[]} Producto cruzado a × b
 */
function crossVec3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

/**
 * Crea una matriz de vista usando lookAt (mirar hacia un punto).
 * 
 * @param {number[]} eye - Posición de la cámara [x, y, z]
 * @param {number[]} center - Punto hacia donde mira la cámara [x, y, z]
 * @param {number[]} up - Vector "arriba" de la cámara [x, y, z] (normalmente [0, 1, 0])
 * @returns {Float32Array} Matriz de vista 4x4
 */
function lookAt(eye, center, up) {
  // Vector forward (dirección hacia el centro)
  const f = normalizeVec3([
    center[0] - eye[0],
    center[1] - eye[1],
    center[2] - eye[2]
  ]);
  
  // Vector right (perpendicular a forward y up)
  const s = normalizeVec3(crossVec3(f, up));
  
  // Vector up corregido (perpendicular a forward y right)
  const u = crossVec3(s, f);
  
  // Crear matriz de vista (view matrix)
  const out = new Float32Array(16);
  
  out[0] = s[0];
  out[1] = u[0];
  out[2] = -f[0];
  out[3] = 0;
  
  out[4] = s[1];
  out[5] = u[1];
  out[6] = -f[1];
  out[7] = 0;
  
  out[8] = s[2];
  out[9] = u[2];
  out[10] = -f[2];
  out[11] = 0;
  
  out[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
  out[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
  out[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
  out[15] = 1;
  
  return out;
}

/**
 * ============================================================
 * SHADERS DE LA APLICACIÓN
 * ============================================================
 * 
 * Estos shaders son específicos para esta aplicación.
 * Ahora trabajan en 3D con cámara y proyección en perspectiva.
 */

/**
 * VERTEX SHADER 3D
 * 
 * Este shader se ejecuta una vez por cada vértice.
 * Recibe:
 * - a_position: posición 3D del vértice (vec3)
 * - u_model: matriz modelo para posicionar el hexágono (mat4)
 * - u_view: matriz de vista (cámara) (mat4)
 * - u_projection: matriz de proyección perspectiva (mat4)
 * 
 * Transforma la posición del vértice del espacio local → mundo → cámara → clip
 */
const vertexShaderSource = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform mat4 u_model;
  uniform mat4 u_view;
  uniform mat4 u_projection;
  uniform mat4 u_normalMatrix;
  
  varying vec3 v_normal;
  varying vec3 v_position;
  
  void main() {
    // Transforma la posición del vértice
    vec4 worldPosition = u_model * vec4(a_position, 1.0);
    v_position = worldPosition.xyz; // Posición en espacio del mundo
    
    // Transforma la normal usando la matriz normal (inversa transpuesta del model)
    // Extraemos la parte 3x3 de u_normalMatrix multiplicando por mat3
    v_normal = mat3(u_normalMatrix) * a_normal;
    
    // Transformación completa: local → mundo → cámara → clip
    // Orden de multiplicación: projection * view * model * position
    gl_Position = u_projection * u_view * worldPosition;
  }
`;

/**
 * FRAGMENT SHADER
 * 
 * Este shader se ejecuta una vez por cada píxel dentro del hexágono.
 * Define el color de cada píxel usando el color pasado como uniform.
 * 
 * gl_FragColor es un vec4 (R, G, B, Alpha) con valores de 0.0 a 1.0.
 */
const fragmentShaderSource = `
  precision mediump float;
  
  uniform vec3 u_color;  // Color RGB del hexágono (pasado desde la aplicación)
  
  varying vec3 v_normal;    // Normal transformada (interpolada entre vértices)
  varying vec3 v_position;  // Posición en espacio del mundo (interpolada)
  
  void main() {
    // Normaliza la normal interpolada
    vec3 N = normalize(v_normal);
    
    // Dirección de la luz direccional (tipo sol)
    // Vector apuntando hacia la luz, normalizado
    vec3 L = normalize(vec3(0.6, 1.0, 0.4));
    
    // Cálculo de iluminación Lambertiana
    // Producto punto entre normal y dirección de la luz
    // max(..., 0.0) asegura que no haya iluminación negativa
    float lambert = max(dot(N, L), 0.0);
    
    // Color base del hexágono
    vec3 base = u_color;
    
    // Mezcla de color base con iluminación
    // 35% color ambiente (oscuro) + 65% iluminación Lambertiana
    // Esto crea sombras suaves manteniendo visibilidad en áreas oscuras
    vec3 finalColor = base * (0.35 + lambert * 0.65);
    
    // Output final del fragment shader
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/**
 * ============================================================
 * DATOS DE LA GEOMETRÍA
 * ============================================================
 */

/**
 * Calcula la normal de un triángulo usando producto cruzado.
 * 
 * RESPONSABILIDAD:
 * - Calcular el vector normal de un triángulo definido por 3 vértices
 * - La normal apunta hacia afuera del triángulo según la regla de la mano derecha
 * 
 * CÁLCULO:
 * - Calcula dos vectores del triángulo: v1->v2 y v1->v3
 * - Producto cruzado de estos vectores da la normal
 * - Normaliza el resultado para obtener un vector unitario
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
 * Crea los datos de un prisma hexagonal 3D (columna hexagonal) con normales.
 * 
 * RESPONSABILIDAD:
 * - Generar la geometría completa de un prisma hexagonal con tapas y caras laterales
 * - Calcular posiciones de todos los vértices necesarios para dibujar el prisma
 * - Calcular normales por cara (flat shading) para estilo low-poly
 * - Retornar objetos con posiciones y normales listos para WebGL
 * 
 * IMPORTANTE - RADIO DEL HEXÁGONO:
 * - El parámetro `radius` DEBE ser exactamente igual a HEX_RADIUS_WORLD
 * - Esta es la MISMA constante usada en hexToPixel3D para calcular las posiciones
 * - Garantiza que el tamaño físico del hexágono coincida exactamente con el espaciado
 *   de la grilla, creando un mosaico perfecto sin huecos ni solapamientos
 * 
 * NORMALES:
 * - Se calculan por cara (flat shading), no por vértice (smooth)
 * - Cada triángulo tiene su propia normal calculada con producto cruzado
 * - Los 3 vértices de cada triángulo comparten la misma normal
 * - Esto crea el efecto "low-poly" característico con facetas visibles
 * 
 * ESTRUCTURA DEL PRISMA:
 * El prisma hexagonal consta de:
 * 1. Tapa inferior: hexágono en y = 0 (plano XZ) - normal apunta hacia abajo
 * 2. Tapa superior: hexágono en y = height - normal apunta hacia arriba
 * 3. 6 caras laterales: cada cara es un rectángulo formado por 2 triángulos
 * 
 * TRIÁNGULOS GENERADOS:
 * - Tapa inferior: 6 triángulos
 * - Tapa superior: 6 triángulos
 * - Caras laterales: 6 caras × 2 triángulos = 12 triángulos
 * - Total: 24 triángulos (72 vértices, 72 normales)
 * 
 * @param {number} radius - Radio del hexágono (por defecto usa HEX_RADIUS_WORLD)
 *                          DEBE ser igual a HEX_RADIUS_WORLD para tesselado perfecto
 * @param {number} height - Altura del prisma (de y = 0 a y = height)
 * @returns {{positions: Float32Array, normals: Float32Array}} Objeto con posiciones y normales
 */
function createHexagonPrismData(radius = HEX_RADIUS_WORLD, height = 1.0) {
  const positions = [];
  const normals = [];
  const numVertices = 6;
  const angleStep = (2 * Math.PI) / numVertices;
  
  // OFFSET DE ORIENTACIÓN PARA HEXÁGONOS "POINTY-TOP":
  // Para hexágonos pointy-top, un vértice debe estar apuntando hacia arriba (+Z).
  // 
  // La fórmula de teselado estándar (x = size * sqrt(3) * (q + r/2), z = size * 1.5 * r)
  // asume que los hexágonos están orientados con un vértice apuntando hacia arriba.
  //
  // Si generamos vértices empezando con angle = 0:
  //   vértice 0: (radius, 0) - apunta hacia la derecha (+X)
  //   vértice 1: (radius*cos(60°), radius*sin(60°)) - apunta diagonal arriba-derecha
  //
  // Para hexágonos pointy-top, necesitamos que un vértice esté en la parte superior.
  // El offset estándar es π/6 (30 grados), lo que rotará el hexágono para que
  // un vértice quede perfectamente arriba, alineado con la orientación esperada
  // por la fórmula de teselado.
  //
  // Con offset = π/6:
  //   vértice 0: angle = π/6 → (radius*cos(30°), radius*sin(30°))
  //   Esto coloca el primer vértice aproximadamente arriba-derecha
  //   Y el vértice en -π/6 (o 11π/6) estará arriba-izquierda
  //   El vértice en la parte superior estará entre estos dos
  //
  // IMPORTANTE: Este offset asegura que la geometría del hexágono coincida con
  // la orientación asumida por la fórmula de teselado, permitiendo que los hexágonos
  // encajen perfectamente sin rotaciones adicionales.
  const angleOffset = Math.PI / 6; // 30 grados - offset estándar para pointy-top
  
  // Calcular los 6 vértices del hexágono (para ambas tapas)
  const bottomVertices = [];
  const topVertices = [];
  
  for (let i = 0; i < numVertices; i++) {
    // Aplicar el offset para que el primer vértice esté arriba (pointy-top orientation)
    const angle = i * angleStep + angleOffset;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    
    // Vértice de la tapa inferior (y = 0)
    bottomVertices.push([x, 0.0, z]);
    // Vértice de la tapa superior (y = height)
    topVertices.push([x, height, z]);
  }
  
  // ============================================================
  // TAPA INFERIOR (hexágono en y = 0)
  // ============================================================
  const bottomCenter = [0.0, 0.0, 0.0];
  // Normal de la tapa inferior apunta hacia abajo (eje Y negativo)
  const bottomNormal = [0, -1, 0];
  
  // 6 triángulos desde el centro hacia los vértices
  for (let i = 0; i < numVertices; i++) {
    const v1 = bottomCenter;
    const v2 = bottomVertices[i];
    const v3 = bottomVertices[(i + 1) % numVertices];
    
    // Triángulo: centro, vértice i, vértice i+1
    positions.push(v1[0], v1[1], v1[2]);
    positions.push(v2[0], v2[1], v2[2]);
    positions.push(v3[0], v3[1], v3[2]);
    
    // Todos los vértices del triángulo tienen la misma normal (flat shading)
    normals.push(bottomNormal[0], bottomNormal[1], bottomNormal[2]);
    normals.push(bottomNormal[0], bottomNormal[1], bottomNormal[2]);
    normals.push(bottomNormal[0], bottomNormal[1], bottomNormal[2]);
  }
  
  // ============================================================
  // TAPA SUPERIOR (hexágono en y = height)
  // ============================================================
  const topCenter = [0.0, height, 0.0];
  // Normal de la tapa superior apunta hacia arriba (eje Y positivo)
  const topNormal = [0, 1, 0];
  
  // 6 triángulos desde el centro hacia los vértices
  // Orden inverso para que las normales apunten hacia arriba
  for (let i = 0; i < numVertices; i++) {
    const v1 = topCenter;
    const v2 = topVertices[(i + 1) % numVertices];
    const v3 = topVertices[i];
    
    // Triángulo: centro, vértice i+1, vértice i (orden inverso)
    positions.push(v1[0], v1[1], v1[2]);
    positions.push(v2[0], v2[1], v2[2]);
    positions.push(v3[0], v3[1], v3[2]);
    
    // Todos los vértices del triángulo tienen la misma normal (flat shading)
    normals.push(topNormal[0], topNormal[1], topNormal[2]);
    normals.push(topNormal[0], topNormal[1], topNormal[2]);
    normals.push(topNormal[0], topNormal[1], topNormal[2]);
  }
  
  // ============================================================
  // CARAS LATERALES (6 caras, cada una con 2 triángulos)
  // ============================================================
  for (let i = 0; i < numVertices; i++) {
    const nextI = (i + 1) % numVertices;
    
    // Vértices de la cara lateral i
    const bottom1 = bottomVertices[i];      // Vértice inferior i
    const bottom2 = bottomVertices[nextI];  // Vértice inferior i+1
    const top1 = topVertices[i];            // Vértice superior i
    const top2 = topVertices[nextI];        // Vértice superior i+1
    
    // Primer triángulo: bottom1, bottom2, top1
    positions.push(bottom1[0], bottom1[1], bottom1[2]);
    positions.push(bottom2[0], bottom2[1], bottom2[2]);
    positions.push(top1[0], top1[1], top1[2]);
    
    // Calcular normal del primer triángulo usando producto cruzado
    const normal1 = calculateTriangleNormal(bottom1, bottom2, top1);
    normals.push(normal1[0], normal1[1], normal1[2]);
    normals.push(normal1[0], normal1[1], normal1[2]);
    normals.push(normal1[0], normal1[1], normal1[2]);
    
    // Segundo triángulo: top1, bottom2, top2
    positions.push(top1[0], top1[1], top1[2]);
    positions.push(bottom2[0], bottom2[1], bottom2[2]);
    positions.push(top2[0], top2[1], top2[2]);
    
    // Calcular normal del segundo triángulo usando producto cruzado
    const normal2 = calculateTriangleNormal(top1, bottom2, top2);
    normals.push(normal2[0], normal2[1], normal2[2]);
    normals.push(normal2[0], normal2[1], normal2[2]);
    normals.push(normal2[0], normal2[1], normal2[2]);
  }
  
  console.log(`✓ Prisma hexagonal generado con normales: radio=${radius}, altura=${height}`);
  console.log(`  - 2 tapas (12 triángulos) + 6 caras laterales (12 triángulos) = 24 triángulos totales`);
  console.log(`  - Normales calculadas por cara (flat shading) para estilo low-poly`);
  
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals)
  };
}

/**
 * ============================================================
 * DISTANCIAS HEXAGONALES
 * ============================================================
 */

/**
 * Calcula la distancia hexagonal entre dos celdas en coordenadas axiales.
 * 
 * RESPONSABILIDAD:
 * - Calcular la distancia en "pasos hexagonales" entre dos celdas
 * - Retornar un número entero que representa cuántos hexágonos hay entre ellas
 * 
 * DISTANCIA HEXAGONAL:
 * En una grilla hexagonal, la distancia entre dos celdas no es la distancia
 * euclidiana, sino el número mínimo de pasos hexagonales necesarios para
 * ir de una celda a otra (movimientos a celdas adyacentes).
 * 
 * FÓRMULA:
 * En coordenadas axiales (q, r), la distancia hexagonal entre (q1, r1) y (q2, r2)
 * se calcula convirtiendo a coordenadas cúbicas y usando la fórmula:
 * 
 * distancia = (|dq| + |dq + dr| + |dr|) / 2
 * 
 * donde:
 * - dq = q1 - q2
 * - dr = r1 - r2
 * 
 * Ejemplo:
 * - Distancia entre (0, 0) y (1, 0) = 1 paso (adyacentes)
 * - Distancia entre (0, 0) y (2, 0) = 2 pasos
 * - Distancia entre (0, 0) y (1, 1) = 1 paso (adyacentes diagonales)
 * 
 * @param {number} q1 - Coordenada q de la primera celda
 * @param {number} r1 - Coordenada r de la primera celda
 * @param {number} q2 - Coordenada q de la segunda celda
 * @param {number} r2 - Coordenada r de la segunda celda
 * @returns {number} Distancia hexagonal (número entero de pasos)
 */
function hexDistance(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  
  // Fórmula de distancia hexagonal en coordenadas axiales
  // Convertimos a coordenadas cúbicas implícitamente y calculamos la distancia
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/**
 * ============================================================
 * GENERACIÓN DE ALTURAS CON RUIDO
 * ============================================================
 */

/**
 * Genera una altura suave para una celda usando ruido 2D (Simplex Noise).
 * 
 * RESPONSABILIDAD:
 * - Evaluar ruido 2D en las coordenadas hexagonales (q, r)
 * - Mapear el valor de ruido al rango de alturas del bioma
 * - Retornar una altura entera suave y continua
 * 
 * CÓMO FUNCIONA EL RUIDO PARA SUAVIZAR EL TERRENO:
 * 
 * 1. Evaluación del ruido:
 *    - El ruido se evalúa en coordenadas escaladas: (q * scale, r * scale)
 *    - 'scale' controla la frecuencia del ruido (valores menores = terreno más suave)
 *    - Simplex Noise devuelve un valor entre aproximadamente -1 y 1
 * 
 * 2. Normalización:
 *    - El valor de ruido se mapea del rango [-1, 1] a [0, 1]
 *    - Fórmula: normalizedNoise = (noise + 1) / 2
 * 
 * 3. Mapeo al rango del bioma:
 *    - Se mapea de [0, 1] a [minHeight, maxHeight]
 *    - Fórmula: height = minHeight + normalizedNoise * (maxHeight - minHeight)
 *    - Se redondea para obtener un valor entero
 * 
 * 4. Suavidad:
 *    - Hexágonos adyacentes tendrán valores de ruido similares
 *    - Esto crea transiciones suaves en lugar de cambios bruscos
 *    - El ruido es determinístico: misma (q, r) siempre da misma altura
 * 
 * Ejemplo con scale = 0.2, minHeight=1, maxHeight=3:
 * - Celda (0, 0): ruido(0*0.2, 0*0.2) = ruido(0, 0) → altura ≈ 2
 * - Celda (1, 0): ruido(1*0.2, 0*0.2) = ruido(0.2, 0) → altura ≈ 2.1 → redondeado a 2
 * - Celda (2, 0): ruido(2*0.2, 0*0.2) = ruido(0.4, 0) → altura ≈ 2.3 → redondeado a 2
 * Resultado: transición suave en lugar de valores completamente aleatorios
 * 
 * @param {number} q - Coordenada hexagonal q (horizontal)
 * @param {number} r - Coordenada hexagonal r (diagonal)
 * @param {Object} biome - Objeto bioma con { minHeight, maxHeight }
 * @param {SimplexNoise} noiseGenerator - Generador de ruido Simplex (instancia de SimplexNoise)
 * @param {number} noiseScale - Escala del ruido (frecuencia). Valores menores = terreno más suave (por defecto: 0.2)
 * @returns {number} Altura entera entre minHeight y maxHeight
 */
function generateHeight(q, r, biome, noiseGenerator, noiseScale = 0.2) {
  // Extrae los límites de altura del bioma
  const { minHeight, maxHeight } = biome;
  
  // Validación: asegurar que noiseGenerator existe y tiene el método noise2D
  if (!noiseGenerator || typeof noiseGenerator.noise2D !== 'function') {
    console.warn('Generador de ruido no válido, usando altura aleatoria');
    return Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
  }
  
  try {
    // PASO 1: Evaluar ruido 2D en las coordenadas escaladas
    // Las coordenadas se multiplican por noiseScale para controlar la frecuencia
    // noiseScale más pequeño = terreno más suave (menos variación)
    // noiseScale más grande = terreno más rugoso (más variación)
    const noiseX = q * noiseScale;
    const noiseY = r * noiseScale;
    
    // Simplex Noise devuelve un valor entre aproximadamente -1 y 1
    const noiseValue = noiseGenerator.noise2D(noiseX, noiseY);
    
    // Validación: asegurar que el valor de ruido es válido
    if (typeof noiseValue !== 'number' || isNaN(noiseValue) || !isFinite(noiseValue)) {
      console.warn('Valor de ruido inválido, usando altura aleatoria');
      return Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    }
    
    // PASO 2: Normalizar el ruido de [-1, 1] a [0, 1]
    // Esto convierte el valor de ruido a un rango más manejable
    const normalizedNoise = (noiseValue + 1) / 2;
    
    // PASO 3: Mapear el ruido normalizado al rango de alturas del bioma
    // Fórmula: height = minHeight + (noise normalizado) * rango
    // Esto asegura que la altura esté siempre entre minHeight y maxHeight
    const height = minHeight + normalizedNoise * (maxHeight - minHeight);
    
    // PASO 4: Redondear para obtener un valor entero
    // Usamos Math.round para redondear al entero más cercano
    // Aseguramos que el resultado esté en el rango válido
    const finalHeight = Math.round(height);
    return Math.max(minHeight, Math.min(maxHeight, finalHeight));
    
  } catch (error) {
    console.error('Error en generateHeight:', error);
    // Fallback: altura aleatoria si hay error
    return Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
  }
}

/**
 * ============================================================
 * ESTRUCTURA DE DATOS DE CELDAS
 * ============================================================
 */

/**
 * Genera un número aleatorio en un rango [min, max].
 * 
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} Número aleatorio entre min y max
 */
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Limita un valor al rango [0, 1].
 * 
 * @param {number} v - Valor a limitar
 * @returns {number} Valor limitado entre 0 y 1
 */
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * ============================================================
 * NOTA SOBRE BIOMAS MODULARES
 * ============================================================
 * 
 * Las funciones de cálculo de color y configuraciones de biomas
 * se encuentran en archivos modulares dentro del directorio biomes/:
 * 
 * - biomes/grassBiome.js: Bioma Grass con computeGrassColor()
 * - biomes/snowBiome.js: Bioma Snow (estructura preparada)
 * - biomes/desertBiome.js: Bioma Desert (estructura preparada)
 * 
 * Cada bioma debe tener una propiedad computeColor que es una función
 * que recibe (height, biome) y retorna un array [r, g, b].
 */

/**
 * Genera un color aleatorio basado en un color base y una variación permitida.
 * Función genérica usada para otros biomas (no Grass).
 * 
 * RESPONSABILIDAD:
 * - Tomar un color base RGB
 * - Aplicar una variación aleatoria controlada a cada componente
 * - Asegurar que los valores resultantes estén en el rango [0.0, 1.0]
 * 
 * @param {number[]} baseColor - Color base [R, G, B] (valores 0.0 a 1.0)
 * @param {number} colorVariance - Variación máxima permitida (±) en cada componente
 * @returns {number[]} Color con variación [R, G, B]
 */
function generateColor(baseColor, colorVariance) {
  const r = Math.max(0.0, Math.min(1.0, baseColor[0] + (Math.random() * 2 - 1) * colorVariance));
  const g = Math.max(0.0, Math.min(1.0, baseColor[1] + (Math.random() * 2 - 1) * colorVariance));
  const b = Math.max(0.0, Math.min(1.0, baseColor[2] + (Math.random() * 2 - 1) * colorVariance));
  
  return [r, g, b];
}

/**
 * Crea la estructura de datos para representar las celdas de la grilla hexagonal.
 * 
 * RESPONSABILIDAD:
 * - Generar un array de celdas, cada una con coordenadas hexagonales (q, r), altura y color
 * - Usar los parámetros del bioma para generar alturas y colores
 * - Retornar la estructura lista para usar en el renderizado
 * 
 * USO DE PARÁMETROS DEL BIOMA:
 * 
 * Alturas (minHeight, maxHeight):
 * - minHeight: define la altura mínima que puede tener una columna
 * - maxHeight: define la altura máxima que puede tener una columna
 * - Se genera una altura suave usando ruido 2D (Simplex Noise)
 * - El ruido crea transiciones suaves entre hexágonos adyacentes
 * - Ejemplo: minHeight=1, maxHeight=3 → alturas entre 1 y 3 con transiciones suaves
 * 
 * Colores (baseColor, colorVariance):
 * - baseColor: color RGB base del bioma (ej: [0.2, 0.7, 0.2] = verde pasto)
 * - colorVariance: controla cuánto puede variar el color de cada hexágono
 * - Cada hexágono obtiene un color único pero dentro del rango del bioma
 * - Esto crea variación visual natural mientras mantiene la identidad del bioma
 * 
 * ESTRUCTURA DE CADA CELDA:
 * {
 *   q: number,          // Coordenada hexagonal q (horizontal)
 *   r: number,          // Coordenada hexagonal r (diagonal)
 *   height: number,     // Altura de la columna (entero entre minHeight y maxHeight)
 *   color: [r, g, b]    // Color RGB del hexágono (con variación aplicada)
 * }
 * 
 * GENERACIÓN BASADA EN RADIO:
 * Genera todas las celdas dentro de un radio hexagonal GRID_RADIUS desde el centro (0, 0).
 * Esto crea un terreno hexagonal completo en lugar de una grilla rectangular.
 * 
 * @param {Object} biome - Objeto bioma con { baseColor, minHeight, maxHeight, colorVariance }
 * @returns {Array} Array de objetos { q, r, height, color }
 */
function createCells(biome) {
  const cells = [];
  
  // Extrae parámetros del bioma
  const { baseColor, minHeight, maxHeight, colorVariance } = biome;
  
  // Inicializa el generador de ruido Simplex
  // Inicializar SimplexNoise para generar alturas suaves del terreno
  // IMPORTANTE: SimplexNoise debe estar disponible globalmente después de cargar el script del CDN
  // La versión 3.0.1 puede exponer la API de diferentes formas dependiendo del build del CDN
  let noise2D = null;
  
  try {
    // Verificar disponibilidad de SimplexNoise en diferentes ubicaciones posibles
    let SimplexNoiseModule = null;
    
    // Opción 1: window.SimplexNoise (más común desde CDN UMD)
    if (typeof window !== 'undefined' && window.SimplexNoise) {
      SimplexNoiseModule = window.SimplexNoise;
    }
    // Opción 2: SimplexNoise global (sin window)
    else if (typeof SimplexNoise !== 'undefined') {
      SimplexNoiseModule = SimplexNoise;
    }
    // Opción 3: window.createNoise2D directamente (si está expuesto)
    else if (typeof window !== 'undefined' && typeof window.createNoise2D === 'function') {
      noise2D = window.createNoise2D();
      console.log('✓ SimplexNoise cargado y funcionando (createNoise2D directo en window)');
    }
    
    // Si encontramos el módulo, crear la función de ruido
    if (SimplexNoiseModule && !noise2D) {
      // API nueva (v3.x): createNoise2D()
      if (typeof SimplexNoiseModule.createNoise2D === 'function') {
        noise2D = SimplexNoiseModule.createNoise2D();
        console.log('✓ SimplexNoise cargado y funcionando (API v3.x: createNoise2D)');
      }
      // API antigua (v2.x): new SimplexNoise()
      else if (typeof SimplexNoiseModule === 'function') {
        const simplex = new SimplexNoiseModule();
        noise2D = simplex.noise2D.bind(simplex);
        console.log('✓ SimplexNoise cargado y funcionando (API v2.x: constructor)');
      }
      else {
        throw new Error('SimplexNoise encontrado pero sin API reconocida (ni createNoise2D ni constructor)');
      }
    }
    
    // Verificar que tenemos una función de ruido válida
    if (!noise2D || typeof noise2D !== 'function') {
      throw new Error('No se pudo crear la función noise2D. SimplexNoise podría no estar cargado correctamente.');
    }
    
    // Probar que la función funciona correctamente con una llamada de prueba
    const testValue = noise2D(0, 0);
    if (typeof testValue !== 'number' || isNaN(testValue) || !isFinite(testValue)) {
      throw new Error('noise2D devolvió un valor inválido: ' + testValue);
    }
    
    console.log(`✓ SimplexNoise verificado: testValue = ${testValue.toFixed(6)} (debe estar entre -1 y 1)`);
    
  } catch (error) {
    console.error('❌ Error crítico al inicializar SimplexNoise:', error);
    console.error('');
    console.error('DIAGNÓSTICO:');
    console.error('  - window existe:', typeof window !== 'undefined');
    console.error('  - window.SimplexNoise existe:', typeof window !== 'undefined' && typeof window.SimplexNoise !== 'undefined');
    console.error('  - SimplexNoise global existe:', typeof SimplexNoise !== 'undefined');
    console.error('');
    console.error('SOLUCIÓN:');
    console.error('  1. Verifica que index.html carga: <script src="https://cdn.jsdelivr.net/npm/simplex-noise@3.0.1/simplex-noise.js"></script>');
    console.error('  2. Verifica que el script se carga ANTES de main.js');
    console.error('  3. Abre la consola del navegador y escribe: window.SimplexNoise');
    console.error('     Debería mostrar un objeto o función, no "undefined"');
    console.error('');
    throw new Error('FALLÓ la inicialización de SimplexNoise. ' + error.message);
  }
  
  // Crear wrapper con la interfaz que espera generateHeight
  // noise2D ya es una función que acepta (x, y) y devuelve un número entre -1 y 1
  const noiseGenerator = {
    noise2D: noise2D
  };
  
  // Escala del ruido: controla qué tan suave o rugoso es el terreno
  // Valores más pequeños (ej: 0.1-0.2) = terreno más suave, cambios graduales
  // Valores más grandes (ej: 0.5-1.0) = terreno más rugoso, cambios más abruptos
  const noiseScale = 0.2;
  
  // Genera todas las celdas dentro del radio hexagonal GRID_RADIUS
  // Iteramos sobre un rango razonable y filtramos por distancia
  // El centro es (0, 0), así que necesitamos cubrir aproximadamente [-GRID_RADIUS, GRID_RADIUS]
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      // Calcula la distancia hexagonal desde el centro (0, 0)
      const distance = hexDistance(0, 0, q, r);
      
      // Solo genera celdas dentro del radio especificado
      if (distance > GRID_RADIUS) {
        continue; // Salta esta celda si está fuera del radio
      }
      // GENERACIÓN DE ALTURA usando ruido 2D:
      // Usa Simplex Noise para generar alturas suaves y continuas
      // Hexágonos adyacentes tendrán alturas similares, creando un terreno natural
      // El ruido se evalúa en (q * noiseScale, r * noiseScale) y se mapea al rango del bioma
      const height = generateHeight(q, r, biome, noiseGenerator, noiseScale);
      
      // GENERACIÓN DE COLOR usando parámetros del bioma:
      // Cada bioma tiene su propia función computeColor específica
      // Si el bioma tiene computeColor, la usa; si no, usa la función genérica
      let color;
      if (biome.computeColor && typeof biome.computeColor === 'function') {
        // Usa la función específica del bioma (ej: computeGrassColor para Grass)
        // Esta función puede incluir lógica personalizada como ajuste por altura
        color = biome.computeColor(height, biome);
      } else {
        // Fallback: usa la función genérica para biomas sin función personalizada
        color = generateColor(baseColor, colorVariance);
      }
      
      // Calcular la posición (x, z) del centro del hexágono en el mundo
      // Esto viene directamente de la función hexToPixel3D (equivalente a axialToWorld)
      // Se almacena en la celda como worldX y worldZ para reutilización
      // IMPORTANTE: hexToPixel3D retorna {x, y, z}, pero y siempre es 0 (plano XZ)
      const pos = hexToPixel3D(q, r, HEX_RADIUS_WORLD);
      
      cells.push({
        q: q,
        r: r,
        worldX: pos.x,  // Posición X del centro del hexágono en el mundo (viene de hexToPixel3D)
        worldZ: pos.z,  // Posición Z del centro del hexágono en el mundo (viene de hexToPixel3D)
        height: height,
        color: color,
        biome: biome  // Guardar referencia al bioma para filtrado
      });
    }
  }
  
  console.log(`✓ ${cells.length} celdas creadas con bioma (radio hexagonal: ${GRID_RADIUS}):`);
  console.log(`  - Alturas: ${minHeight} a ${maxHeight}`);
  console.log(`  - Color base: [${baseColor[0].toFixed(2)}, ${baseColor[1].toFixed(2)}, ${baseColor[2].toFixed(2)}]`);
  console.log(`  - Variación de color: ±${colorVariance}`);
  return cells;
}

/**
 * ============================================================
 * COORDENADAS HEXAGONALES
 * ============================================================
 */

/**
 * Convierte coordenadas hexagonales axiales (q, r) a posición 3D en el mundo.
 * 
 * RESPONSABILIDAD:
 * - Convertir coordenadas hexagonales al sistema de coordenadas 3D
 * - Calcular la posición (x, z) donde debe dibujarse un hexágono en la grilla
 * - Los hexágonos están en el plano XZ (y siempre es 0)
 * - Garantizar que los hexágonos se toquen perfectamente sin huecos ni superposición
 * 
 * COORDENADAS HEXAGONALES (Sistema Axial):
 * El sistema de coordenadas axiales (q, r) es uno de los estándares para representar
 * grillas hexagonales. En este sistema:
 * - q: coordenada horizontal, apunta hacia la derecha (corresponde al eje X)
 * - r: coordenada diagonal, apunta hacia abajo-derecha (corresponde al eje Z)
 * - Cada hexágono tiene 6 vecinos: (q+1, r), (q-1, r), (q, r+1), (q, r-1), 
 *   (q+1, r-1), (q-1, r+1)
 * 
 * TESSELADO PERFECTO:
 * Para que los hexágonos se toquen perfectamente sin huecos ni superposición, es crucial
 * usar la fórmula correcta de conversión. La fórmula estándar para hexágonos "pointy-top"
 * (con un vértice apuntando hacia arriba) garantiza que:
 * - La distancia entre centros de hexágonos adyacentes sea exactamente igual
 * - Los hexágonos compartan bordes perfectamente
 * - No haya espacios entre hexágonos
 * - No haya superposición
 * 
 * FÓRMULA ESTÁNDAR PARA HEXÁGONOS "POINTY-TOP":
 * Para un hexágono orientado con un vértice hacia arriba:
 * - x = size * sqrt(3) * (q + r/2)
 * - z = size * 1.5 * r
 * 
 * Donde:
 * - size: radio del hexágono (distancia del centro a un vértice)
 * - Esta fórmula asegura que hexágonos adyacentes estén exactamente a distancia
 *   size * sqrt(3) entre centros, garantizando un tesselado perfecto
 * 
 * GEOMETRÍA DEL HEXÁGONO:
 * En un hexágono regular "pointy-top":
 * - La distancia entre el centro y un vértice = size (radio)
 * - La distancia entre el centro y un lado = size * sqrt(3) / 2
 * - La distancia horizontal entre centros de hexágonos adyacentes = size * sqrt(3)
 * - La distancia vertical entre filas alternas = size * 1.5
 * 
 * @param {number} q - Coordenada q del hexágono (horizontal, eje X)
 * @param {number} r - Coordenada r del hexágono (diagonal, eje Z)
 * @param {number} size - Radio del hexágono (distancia del centro a un vértice)
 *                        Si no se especifica, se usa un valor por defecto
 * @returns {{x: number, y: number, z: number}} Posición 3D (x, y, z) en espacio del mundo
 */
/**
 * Convierte coordenadas axiales hexagonales (q, r) a posición 3D en el mundo.
 * 
 * RESPONSABILIDAD:
 * - Convertir coordenadas hexagonales (q, r) a posición (x, z) en el plano XZ
 * - Usar la fórmula estándar para hexágonos "pointy-top" que garantiza tesselado perfecto
 * - Retornar posición 3D con y = 0 (siempre en el plano XZ)
 * 
 * FÓRMULA ESTÁNDAR PARA HEXÁGONOS "POINTY-TOP":
 * Para hexágonos orientados con un vértice hacia arriba, la conversión es:
 * 
 *   x = HEX_RADIUS_WORLD * sqrt(3) * (q + r / 2.0)
 *   z = HEX_RADIUS_WORLD * 1.5 * r
 * 
 * IMPORTANTE:
 * - El parámetro `size` DEBE ser exactamente igual a HEX_RADIUS_WORLD
 * - Esta es la MISMA constante usada para generar los vértices del hexágono
 * - Garantiza que la distancia entre centros de hexágonos adyacentes sea
 *   exactamente HEX_RADIUS_WORLD * sqrt(3), igual al tamaño de los hexágonos
 * - Esto crea un mosaico perfecto sin huecos ni solapamientos
 * 
 * TESELADO PERFECTO:
 * La distancia entre centros de hexágonos adyacentes es:
 *   d = HEX_RADIUS_WORLD * sqrt(3)
 * 
 * El lado de un hexágono regular (distancia entre dos vértices adyacentes) también es:
 *   lado = HEX_RADIUS_WORLD * sqrt(3) / sqrt(3) = HEX_RADIUS_WORLD
 * 
 * Pero más importante: la distancia entre centros es igual a la suma de los
 * apotemas (distancia del centro al lado) de dos hexágonos adyacentes, lo que
 * garantiza que se toquen perfectamente.
 * 
 * @param {number} q - Coordenada q del hexágono (horizontal, eje X)
 * @param {number} r - Coordenada r del hexágono (diagonal, eje Z)
 * @param {number} size - Radio del hexágono (por defecto usa HEX_RADIUS_WORLD)
 *                        DEBE ser igual a HEX_RADIUS_WORLD para tesselado perfecto
 * @returns {{x: number, y: number, z: number}} Posición 3D (x, y, z) en espacio del mundo
 */
function hexToPixel3D(q, r, size = HEX_RADIUS_WORLD) {
  const sqrt3 = Math.sqrt(3);
  
  // FÓRMULA ESTÁNDAR PARA HEXÁGONOS "POINTY-TOP"
  // Esta fórmula garantiza un tesselado perfecto donde los hexágonos
  // se tocan exactamente en sus bordes sin huecos ni superposición
  // IMPORTANTE: size debe ser exactamente HEX_RADIUS_WORLD
  const x = size * sqrt3 * (q + r / 2.0);
  const y = 0.0; // Siempre en el plano XZ
  const z = size * 1.5 * r;
  
  return { x, y, z };
}

/**
 * ============================================================
 * FUNCIONES DE DIBUJADO
 * ============================================================
 */

/**
 * Crea una matriz de traslación 4x4.
 * 
 * @param {number} x - Traslación en X
 * @param {number} y - Traslación en Y
 * @param {number} z - Traslación en Z
 * @returns {Float32Array} Matriz de traslación 4x4
 */
function translateMat4(x, y, z) {
  const out = identityMat4();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

/**
 * Crea una matriz de escala 4x4.
 * 
 * @param {number} x - Escala en X
 * @param {number} y - Escala en Y
 * @param {number} z - Escala en Z
 * @returns {Float32Array} Matriz de escala 4x4
 */
function scaleMat4(x, y, z) {
  const out = new Float32Array(16);
  out[0] = x;
  out[5] = y;
  out[10] = z;
  out[15] = 1;
  return out;
}

/**
 * Transpone una matriz 4x4.
 * 
 * RESPONSABILIDAD:
 * - Intercambiar filas por columnas en una matriz 4x4
 * - Necesaria para calcular la matriz normal (inversa transpuesta)
 * 
 * @param {Float32Array} m - Matriz 4x4 a transponer
 * @returns {Float32Array} Matriz transpuesta 4x4
 */
function transposeMat4(m) {
  const out = new Float32Array(16);
  
  // Transponer la matriz: out[i][j] = m[j][i]
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = m[j * 4 + i];
    }
  }
  
  return out;
}

/**
 * Calcula la inversa de una matriz 4x4.
 * 
 * RESPONSABILIDAD:
 * - Calcular la matriz inversa de una matriz 4x4
 * - Necesaria para calcular la matriz normal (inversa transpuesta)
 * 
 * ALGORITMO:
 * - Usa eliminación de Gauss-Jordan para calcular la inversa
 * - Si la matriz no es invertible, retorna la identidad como fallback
 * 
 * @param {Float32Array} m - Matriz 4x4 a invertir
 * @returns {Float32Array} Matriz inversa 4x4
 */
function invertMat4(m) {
  const out = new Float32Array(16);
  const inv = new Float32Array(16);
  
  // Copiar la matriz original
  for (let i = 0; i < 16; i++) {
    inv[i] = m[i];
  }
  
  // Inicializar la matriz de salida como identidad
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = (i === j) ? 1.0 : 0.0;
    }
  }
  
  // Eliminación de Gauss-Jordan
  for (let i = 0; i < 4; i++) {
    // Buscar el pivote (elemento no cero)
    let pivot = i;
    let maxVal = Math.abs(inv[i * 4 + i]);
    
    for (let j = i + 1; j < 4; j++) {
      const val = Math.abs(inv[j * 4 + i]);
      if (val > maxVal) {
        maxVal = val;
        pivot = j;
      }
    }
    
    // Si no hay pivote válido, la matriz no es invertible
    if (maxVal < 0.0001) {
      console.warn('Matriz no invertible, retornando identidad');
      return identityMat4();
    }
    
    // Intercambiar filas si es necesario
    if (pivot !== i) {
      for (let j = 0; j < 4; j++) {
        // Intercambiar filas en inv
        let temp = inv[i * 4 + j];
        inv[i * 4 + j] = inv[pivot * 4 + j];
        inv[pivot * 4 + j] = temp;
        
        // Intercambiar filas en out
        temp = out[i * 4 + j];
        out[i * 4 + j] = out[pivot * 4 + j];
        out[pivot * 4 + j] = temp;
      }
    }
    
    // Normalizar la fila del pivote
    const pivotVal = inv[i * 4 + i];
    for (let j = 0; j < 4; j++) {
      inv[i * 4 + j] /= pivotVal;
      out[i * 4 + j] /= pivotVal;
    }
    
    // Eliminación hacia abajo y hacia arriba
    for (let j = 0; j < 4; j++) {
      if (j !== i) {
        const factor = inv[j * 4 + i];
        for (let k = 0; k < 4; k++) {
          inv[j * 4 + k] -= inv[i * 4 + k] * factor;
          out[j * 4 + k] -= out[i * 4 + k] * factor;
        }
      }
    }
  }
  
  return out;
}

/**
 * Calcula la matriz normal (inversa transpuesta de la matriz modelo).
 * 
 * RESPONSABILIDAD:
 * - Calcular la matriz necesaria para transformar normales correctamente
 * - Las normales deben transformarse con la inversa transpuesta de la matriz modelo
 * - Esto preserva la ortogonalidad de las normales después de transformaciones con escala no uniforme
 * 
 * POR QUÉ SE NECESITA:
 * - La matriz modelo puede incluir escalas no uniformes (ej: scale(1, 2, 1))
 * - Si transformamos una normal directamente con la matriz modelo, pierde su propiedad de ser perpendicular
 * - La inversa transpuesta corrige esto y preserva la dirección correcta de la normal
 * 
 * CÁLCULO:
 * normalMatrix = transpose(inverse(modelMatrix))
 * 
 * @param {Float32Array} modelMatrix - Matriz modelo 4x4
 * @returns {Float32Array} Matriz normal 4x4 (inversa transpuesta)
 */
function calculateNormalMatrix(modelMatrix) {
  // Calcular la inversa de la matriz modelo
  const inverseModel = invertMat4(modelMatrix);
  
  // Transponer la inversa para obtener la matriz normal
  const normalMatrix = transposeMat4(inverseModel);
  
  return normalMatrix;
}

/**
 * Dibuja un prisma hexagonal en una posición específica con una altura y color determinados e iluminación.
 * 
 * RESPONSABILIDAD:
 * - Crear la matriz modelo combinando traslación y escala según la altura
 * - Calcular la matriz normal (inversa transpuesta) para transformar normales correctamente
 * - Configurar los uniforms de matrices (model, view, projection, normalMatrix)
 * - Configurar el uniform de color del hexágono
 * - Configurar los atributos de posición 3D y normales
 * - Dibujar el prisma hexagonal usando gl.TRIANGLES
 * 
 * ILUMINACIÓN:
 * - Calcula la matriz normal (inversa transpuesta de la matriz modelo)
 * - Esta matriz se usa en el vertex shader para transformar las normales
 * - El fragment shader calcula iluminación Lambertiana usando las normales transformadas
 * 
 * MATRIZ MODELO Y ALTURA:
 * La matriz modelo se construye combinando dos transformaciones:
 * 1. Escala en Y: scaleY = visualHeight (altura visual calculada desde altura lógica)
 * 2. Traslación: (x, 0, z) para posicionar el prisma en la grilla
 * 
 * SEPARACIÓN ALTURA LÓGICA vs VISUAL:
 * - cell.height: altura lógica (entero, ej: 1, 2, 3) - representa altura relativa
 * - visualHeight: altura visual = cell.height * HEIGHT_UNIT
 * - Esta separación permite ajustar la escala visual sin cambiar la lógica de terrenos
 * 
 * IMPORTANTE: Orden de transformaciones
 * - El prisma base tiene altura 1.0 con base en y=0 y tapa en y=1.0
 * - Primero aplicamos ESCALA en Y por visualHeight
 * - Después de escalar: base en y=0, tapa en y=visualHeight
 * - Luego aplicamos TRASLACIÓN en X y Z (Y=0) para posicionarlo
 * - Orden de multiplicación: model = translation * scale
 * - Esto significa: primero escalamos, luego trasladamos
 * 
 * Ejemplo para height = 2 y HEIGHT_UNIT = 0.3:
 * - visualHeight = 2 * 0.3 = 0.6 unidades
 * - El prisma se escala a 0.6x su altura original (de 1.0 a 0.6)
 * - La base del prisma escalado está en y = 0
 * - La traslación lo posiciona en (x, 0, z), manteniendo la base en el plano XZ
 * 
 * COLOR:
 * - El color se pasa como uniform vec3 u_color al fragment shader
 * - Cada hexágono puede tener su propio color (generado según el bioma)
 * - El color se aplica a todos los píxeles del hexágono uniformemente
 * 
 * BUFFERS UTILIZADOS:
 * - positionBuffer: contiene todas las posiciones de los vértices del prisma
 *   - 24 triángulos × 3 vértices = 72 vértices totales
 *   - Cada vértice tiene 3 componentes (x, y, z)
 *   - Total: 72 × 3 = 216 valores flotantes
 * - normalBuffer: contiene todas las normales de los vértices del prisma
 *   - 72 normales (una por vértice)
 *   - Cada normal tiene 3 componentes (nx, ny, nz)
 *   - Total: 72 × 3 = 216 valores flotantes
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {WebGLProgram} program - Programa de shaders compilado
 * @param {WebGLBuffer} positionBuffer - Buffer con las posiciones de los vértices del prisma hexagonal
 * @param {WebGLBuffer} normalBuffer - Buffer con las normales de los vértices del prisma hexagonal
 * @param {number} x - Posición X del prisma en espacio del mundo
 * @param {number} y - Posición Y del prisma en espacio del mundo (normalmente 0 para que la base esté en el plano XZ)
 * @param {number} z - Posición Z del prisma en espacio del mundo
 * @param {number} height - Altura lógica de la celda (entero, ej: 1, 2, 3)
 *                          Se convierte a altura visual usando HEIGHT_UNIT
 * @param {number[]} color - Color RGB del hexágono [r, g, b] (valores 0.0 a 1.0)
 * @param {Float32Array} viewMatrix - Matriz de vista (cámara)
 * @param {Float32Array} projectionMatrix - Matriz de proyección
 */
function drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, y, z, height, color, viewMatrix, projectionMatrix) {
  // CONVERSIÓN DE ALTURA LÓGICA A ALTURA VISUAL:
  // - height: altura lógica de la celda (ej: 1, 2, 3) - NO modificar esta lógica
  // - visualHeight: altura visual real en unidades del mundo 3D
  // - HEIGHT_UNIT: factor de escala que convierte altura lógica → visual
  const visualHeight = height * HEIGHT_UNIT;
  
  // PASO 1: Crear matriz de escala en Y según la altura visual
  // El prisma base tiene altura 1.0 en sus datos de geometría
  // Lo escalamos en Y por visualHeight para obtener la altura visual deseada
  // Escala en X y Z = 1.0 (no cambian), escala en Y = visualHeight
  const scaleMatrix = scaleMat4(1.0, visualHeight, 1.0);
  
  // PASO 2: Crear matriz de traslación para posicionar el prisma
  // La base del prisma escalado debe quedar en el plano XZ (y = 0)
  // El prisma base tiene base en y=0 y tapa en y=1.0
  // Al escalar, la base sigue en y=0 y la tapa en y=visualHeight
  // La traslación en Y es 0 para mantener la base en el plano XZ
  // La traslación en X y Z posiciona el hexágono en su lugar en la grilla
  const translationMatrix = translateMat4(x, 0, z);
  
  // PASO 3: Combinar las transformaciones: translation * scale
  // Orden: primero escalamos, luego trasladamos
  // Esto significa que el prisma escalado se coloca en la posición correcta
  const modelMatrix = multiplyMat4(translationMatrix, scaleMatrix);
  
  // PASO 4: Calcular la matriz normal (inversa transpuesta de la matriz modelo)
  // Esta matriz se usa para transformar las normales correctamente
  // Es necesaria cuando hay escalas no uniformes (como nuestro scale en Y)
  const normalMatrix = calculateNormalMatrix(modelMatrix);
  
  // Obtiene las ubicaciones de los uniforms en el shader
  const modelLocation = gl.getUniformLocation(program, 'u_model');
  const viewLocation = gl.getUniformLocation(program, 'u_view');
  const projectionLocation = gl.getUniformLocation(program, 'u_projection');
  const normalMatrixLocation = gl.getUniformLocation(program, 'u_normalMatrix');
  const colorLocation = gl.getUniformLocation(program, 'u_color');
  
  // Configura las matrices en el shader
  gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
  gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
  gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
  
  // Configura el color del hexágono
  gl.uniform3f(colorLocation, color[0], color[1], color[2]);
  
  // Configura el atributo a_position para leer del buffer de posiciones
  // size=3 porque cada vértice tiene 3 componentes (x, y, z)
  setupAttribute(gl, program, 'a_position', positionBuffer, 3);
  
  // Configura el atributo a_normal para leer del buffer de normales
  // size=3 porque cada normal tiene 3 componentes (nx, ny, nz)
  setupAttribute(gl, program, 'a_normal', normalBuffer, 3);
  
  // Dibuja el prisma usando TRIANGLES
  // El buffer contiene 24 triángulos = 72 vértices
  // Cada triángulo tiene 3 vértices, por lo que dibujamos 72 vértices
  gl.drawArrays(gl.TRIANGLES, 0, 72);
}

/**
 * Dibuja una grilla de prismas hexagonales en 3D con alturas variables por celda e iluminación Lambertiana.
 * 
 * RESPONSABILIDAD:
 * - Limpiar el canvas
 * - Activar el programa de shaders
 * - Configurar la cámara (matriz de vista)
 * - Configurar la proyección perspectiva
 * - Iterar sobre las celdas de la grilla
 * - Dibujar cada prisma en su posición con su altura correspondiente usando matrices
 * - La iluminación se calcula en el fragment shader usando normales transformadas
 * 
 * ILUMINACIÓN:
 * - Se utiliza iluminación Lambertiana simple con una luz direccional
 * - Las normales se transforman usando la matriz normal (inversa transpuesta del modelo)
 * - Cada prisma recibe sombras suaves según su orientación respecto a la luz
 * 
 * ESTRUCTURA DE CELDAS:
 * Utiliza el array de celdas generado por createCells(), donde cada celda tiene:
 * - q, r: coordenadas hexagonales
 * - height: altura de la columna (entero entre minHeight y maxHeight)
 * - color: color RGB base del hexágono
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {WebGLProgram} program - Programa de shaders compilado
 * @param {WebGLBuffer} positionBuffer - Buffer con las posiciones de los vértices del prisma hexagonal
 * @param {WebGLBuffer} normalBuffer - Buffer con las normales de los vértices del prisma hexagonal
 * @param {HTMLCanvasElement} canvas - Canvas para calcular aspect ratio
 * @param {Array} cells - Array de celdas con formato { q, r, height, color }
 * @param {number} hexRadius - Radio del hexágono (debe ser HEX_RADIUS_WORLD para tesselado perfecto)
 */
function drawHexGrid(gl, program, positionBuffer, normalBuffer, canvas, cells, hexRadius, viewMatrix, projectionMatrix) {
  // Limpia el canvas con color de fondo oscuro
  clearCanvas(gl, 0.1, 0.1, 0.15, 1.0);
  
  // Activa el programa de shaders (solo una vez para todos los prismas)
  gl.useProgram(program);
  
  // Si no se proporcionan las matrices, calcularlas automáticamente
  let finalViewMatrix = viewMatrix;
  let finalProjectionMatrix = projectionMatrix;
  
  if (!finalViewMatrix || !finalProjectionMatrix) {
    // Calcula el tamaño del terreno para ajustar la cámara
    const terrainSize = GRID_RADIUS * hexRadius * Math.sqrt(3) * 2;
    const cameraDistance = terrainSize * 1.2;
    
    const eye = [cameraDistance * 0.7, cameraDistance * 0.8, cameraDistance * 0.7];
    const center = [0, 0, 0];
    const up = [0, 1, 0];
    
    finalViewMatrix = lookAt(eye, center, up);
    
    const aspect = canvas.width / canvas.height;
    finalProjectionMatrix = perspective(60, aspect, 0.1, 100.0);
  }
  
  // Itera sobre cada celda de la grilla
  for (const cell of cells) {
    // Usar directamente las posiciones almacenadas en la celda
    // cell.worldX y cell.worldZ son el centro exacto del hexágono en el mundo
    // Estos valores fueron calculados en createCells() usando hexToPixel3D()
    const x = cell.worldX;
    const z = cell.worldZ;
    
    // Dibuja el prisma en esa posición con la altura y color correspondientes
    // Nota: y=0 porque la base del hexágono siempre está en el plano XZ
    drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, 0, z, cell.height, cell.color, finalViewMatrix, finalProjectionMatrix);
  }
  
  console.log(`✓ Grilla 3D dibujada: ${cells.length} prismas con alturas variables`);
}

/**
 * Dibuja un mesh genérico (árbol u otro objeto) usando índices (ELEMENT_ARRAY_BUFFER).
 * 
 * RESPONSABILIDAD:
 * - Configurar los atributos del mesh (posiciones y normales)
 * - Calcular y enviar la matriz normal (inversa transpuesta)
 * - Configurar los uniforms (model, view, projection, normalMatrix, color)
 * - Dibujar el mesh usando gl.drawElements con índices
 * 
 * Esta función se usa para renderizar objetos que usan índices (como árboles generados programáticamente),
 * a diferencia de los hexágonos que usan gl.drawArrays.
 * 
 * ILUMINACIÓN:
 * - Reutiliza los mismos shaders de iluminación Lambertiana que el terreno
 * - Calcula la matriz normal para transformar las normales correctamente
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {WebGLProgram} program - Programa de shaders compilado
 * @param {WebGLBuffer} positionBuffer - Buffer con las posiciones de los vértices
 * @param {WebGLBuffer} normalBuffer - Buffer con las normales de los vértices
 * @param {WebGLBuffer} indexBuffer - Buffer con los índices de los vértices
 * @param {number} indexCount - Número de índices a dibujar
 * @param {Float32Array} modelMatrix - Matriz modelo del objeto
 * @param {Float32Array} viewMatrix - Matriz de vista (cámara)
 * @param {Float32Array} projectionMatrix - Matriz de proyección
 * @param {number[]} color - Color RGB del objeto [r, g, b] (valores 0.0 a 1.0)
 * @param {number} [indexOffset] - Offset en bytes dentro del buffer de índices (opcional)
 */
function drawMesh(gl, program, positionBuffer, normalBuffer, indexBuffer, indexCount, modelMatrix, viewMatrix, projectionMatrix, color, indexOffset = 0) {
  // Calcular la matriz normal (inversa transpuesta de la matriz modelo)
  const normalMatrix = calculateNormalMatrix(modelMatrix);
  
  // Obtiene las ubicaciones de los uniforms en el shader
  const modelLocation = gl.getUniformLocation(program, 'u_model');
  const viewLocation = gl.getUniformLocation(program, 'u_view');
  const projectionLocation = gl.getUniformLocation(program, 'u_projection');
  const normalMatrixLocation = gl.getUniformLocation(program, 'u_normalMatrix');
  const colorLocation = gl.getUniformLocation(program, 'u_color');
  
  // Configura las matrices en el shader
  gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
  gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
  gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
  
  // Configura el color del objeto
  gl.uniform3f(colorLocation, color[0], color[1], color[2]);
  
  // Configura el atributo a_position para leer del buffer de posiciones
  setupAttribute(gl, program, 'a_position', positionBuffer, 3);
  
  // Configura el atributo a_normal para leer del buffer de normales
  setupAttribute(gl, program, 'a_normal', normalBuffer, 3);
  
  // Activa el buffer de índices (ELEMENT_ARRAY_BUFFER)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  
  // Dibuja el mesh usando índices (gl.drawElements)
  // indexOffset está en bytes, Uint16Array = 2 bytes por índice
  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, indexOffset);
}

/**
 * Dibuja un árbol completo (tronco + copa) con colores diferentes.
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {WebGLProgram} program - Programa de shaders compilado
 * @param {Object} treeMesh - Mesh del árbol con trunkIndexCount y crownIndexCount
 * @param {Float32Array} modelMatrix - Matriz modelo del árbol
 * @param {Float32Array} viewMatrix - Matriz de vista
 * @param {Float32Array} projectionMatrix - Matriz de proyección
 */
function drawTree(gl, program, treeMesh, modelMatrix, viewMatrix, projectionMatrix) {
  // Dibujar el tronco (marrón)
  drawMesh(
    gl, program,
    treeMesh.positionBuffer,
    treeMesh.normalBuffer,
    treeMesh.indexBuffer,
    treeMesh.trunkIndexCount,
    modelMatrix,
    viewMatrix,
    projectionMatrix,
    TREE_TRUNK_COLOR,
    0 // Offset: empieza desde el inicio
  );
  
  // Dibujar la copa (verde)
  drawMesh(
    gl, program,
    treeMesh.positionBuffer,
    treeMesh.normalBuffer,
    treeMesh.indexBuffer,
    treeMesh.crownIndexCount,
    modelMatrix,
    viewMatrix,
    projectionMatrix,
    TREE_CROWN_COLOR,
    treeMesh.crownIndexOffset * 2 // Offset en bytes (Uint16Array = 2 bytes por índice)
  );
}

/**
 * Crea instancias de árboles distribuidas aleatoriamente sobre las celdas del bioma Grass.
 * 
 * RESPONSABILIDAD:
 * - Filtrar solo las celdas que pertenecen al bioma Grass
 * - Para cada celda de Grass, decidir aleatoriamente si debe tener un árbol según TREE_DENSITY
 * - Usar directamente los datos almacenados en la celda (x, z, height)
 * - Generar una matriz modelo para cada árbol con rotación y escala aleatorias
 * - Retornar un array de instancias con sus matrices modelo
 * 
 * FILTRADO POR BIOMA:
 * - IMPORTANTE: Solo genera árboles en celdas que pertenecen al bioma Grass
 * - Cada celda tiene una propiedad `biome` que identifica a qué bioma pertenece
 * - Esto evita generar árboles fuera del bioma o en biomas incorrectos
 * 
 * POSICIONAMIENTO:
 * - IMPORTANTE: Cada árbol está perfectamente centrado en un hexágono
 * - La posición (x, z) se usa directamente desde cell.x y cell.z (ya calculadas en createCells)
 * - La altura en Y se calcula como la altura visual del hexágono (top del hex)
 * - El árbol tiene su base del tronco en y=0 (en su sistema local)
 * - Se traslada a y = visualHeight para que la base quede sobre la tapa del hexágono
 * 
 * VARIACIÓN:
 * - Rotación aleatoria alrededor del eje Y (0 a 2π)
 * - Escala aleatoria entre 0.9 y 1.1 para dar variedad
 * 
 * @param {Array} cells - Array de celdas con formato { q, r, worldX, worldZ, height, color, biome }
 * @param {Object} targetBiome - Bioma objetivo para generar árboles (por defecto grassBiome)
 * @returns {Array<{modelMatrix: Float32Array}>} Array de instancias de árboles
 */
function createTreeInstances(cells, targetBiome = grassBiome) {
  const treeInstances = [];
  let grassCellsCount = 0;
  
  // Recorrer todas las celdas del terreno
  for (const cell of cells) {
    // FILTRAR: Solo generar árboles en celdas del bioma objetivo (por defecto Grass)
    // Esto evita generar árboles fuera del bioma o en biomas incorrectos
    if (cell.biome !== targetBiome) {
      continue; // Saltar celdas que no pertenecen al bioma objetivo
    }
    
    grassCellsCount++;
    
    // EVITAR CONFLICTOS: Saltar celdas que ya tienen una oveja
    // Esto asegura que árboles y ovejas no compartan el mismo hexágono
    if (cell.occupied) {
      continue; // Esta celda ya tiene una oveja, no poner árbol
    }
    
    // Decidir aleatoriamente si esta celda debe tener un árbol
    if (Math.random() >= TREE_DENSITY) {
      continue; // No poner árbol en esta celda
    }
    
    // ============================================================
    // POSICIÓN DEL ÁRBOL: Usar directamente worldX y worldZ de la celda
    // ============================================================
    // cell.worldX y cell.worldZ son el centro exacto del hexágono en el mundo
    // Estos valores fueron calculados en createCells() usando hexToPixel3D()
    // Son exactamente las mismas coordenadas que se usan para dibujar el hexágono
    // NO recalcular aquí para evitar discrepancias
    // La geometría del árbol está centrada en el origen (x=0, z=0) en su sistema local
    // Así que simplemente trasladamos el árbol a estas coordenadas
    const posX = cell.worldX;  // Exactamente el centro del hexágono
    const posZ = cell.worldZ;  // Exactamente el centro del hexágono
    
    // ============================================================
    // JITTER OPCIONAL: Desactivado por ahora para centrado perfecto
    // ============================================================
    // Si quieres activar jitter más adelante, usar máximo 10-15% del radio
    // const JITTER_RADIUS = HEX_RADIUS_WORLD * 0.1; // máximo 10% del radio
    // const jitterAngle = Math.random() * Math.PI * 2.0;
    // const jitterDistance = Math.random() * JITTER_RADIUS;
    // const offsetX = Math.cos(jitterAngle) * jitterDistance;
    // const offsetZ = Math.sin(jitterAngle) * jitterDistance;
    // posX = posX + offsetX;
    // posZ = posZ + offsetZ;
    
    // ============================================================
    // ALTURA DEL ÁRBOL: Exactamente sobre la tapa del hexágono
    // ============================================================
    // IMPORTANTE: El hexágono se crea con baseHeight = 0.5 y se escala por visualHeight
    // La altura final del hexágono es: baseHeight * visualHeight = baseHeight * (height * HEIGHT_UNIT)
    // Esta es la altura de la tapa del hexágono (donde debe apoyarse el árbol)
    // El árbol tiene su base del tronco en y=0 en su sistema local (createTreeMesh)
    // Por lo tanto, posY debe ser la altura final del hexágono
    // IMPORTANTE: HEX_BASE_HEIGHT debe coincidir con baseHeight en main() (línea 1888)
    const HEX_BASE_HEIGHT = 0.5;
    const visualHeight = cell.height * HEIGHT_UNIT; // Altura visual calculada
    const actualHexHeight = HEX_BASE_HEIGHT * visualHeight; // Altura real del hexágono = baseHeight * visualHeight
    const posY = actualHexHeight; // Árbol sobre la tapa del hexágono
    
    // Validar que la altura sea válida (no negativa ni cero)
    if (posY <= 0) {
      console.warn(`Advertencia: Celda (${cell.q}, ${cell.r}) tiene altura ${cell.height}, visualHeight=${visualHeight}. Saltando árbol.`);
      continue;
    }
    
    // ============================================================
    // TRANSFORMACIONES: Rotación y escala aleatorias
    // ============================================================
    // TEMPORAL: Desactivar rotación y escala para debuggear centrado
    // Descomentar después de verificar que el centrado funciona
    const rotationY = 0; // Math.random() * Math.PI * 2;
    const scale = 1.0; // randomInRange(0.9, 1.1);
    
    // Versión con rotación/escala (descomentar cuando el centrado funcione):
    // const rotationY = Math.random() * Math.PI * 2;
    // const scale = randomInRange(0.9, 1.1);
    
    // ============================================================
    // CONSTRUCCIÓN DE LA MATRIZ MODELO (igual que el hexágono)
    // ============================================================
    // IMPORTANTE: Construimos EXACTAMENTE igual que drawHexagonAt()
    // El hexágono hace: translation * scale
    // El árbol hace: translation * rotation * scale
    // 
    // PATRÓN DEL HEXÁGONO (línea 1296):
    //   1. scaleMatrix = scaleMat4(...)
    //   2. translationMatrix = translateMat4(x, 0, z)
    //   3. modelMatrix = multiplyMat4(translationMatrix, scaleMatrix)
    //      Resultado: translation * scale
    //
    // PATRÓN PARA EL ÁRBOL (mismo orden):
    //   1. scaleMatrix = scaleMat4(...)
    //   2. rotationMatrix = ...
    //   3. localTransform = rotation * scale
    //   4. translationMatrix = translateMat4(posX, posY, posZ)
    //   5. modelMatrix = multiplyMat4(translationMatrix, localTransform)
    //      Resultado: translation * rotation * scale
    
    // PASO 1: Crear matriz de escala (igual que el hexágono)
    const scaleMatrix = scaleMat4(scale, scale, scale);
    
    // PASO 2: Crear matriz de rotación alrededor del eje Y
    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);
    const rotationMatrix = new Float32Array([
      cosR, 0, sinR, 0,
      0, 1, 0, 0,
      -sinR, 0, cosR, 0,
      0, 0, 0, 1
    ]);
    
    // PASO 3: Combinar rotación y escala (rotation * scale)
    // Esto aplica primero la escala, luego la rotación, ambas alrededor del origen
    const localTransform = multiplyMat4(rotationMatrix, scaleMatrix);
    
    // PASO 4: Crear matriz de traslación (igual que el hexágono)
    // Esta traslación mueve el centro del árbol (origen local) a la posición final
    const translationMatrix = translateMat4(posX, posY, posZ);
    
    // PASO 5: Combinar traslación con transformaciones locales (igual que el hexágono)
    // translation * (rotation * scale) = translation * rotation * scale
    const modelMatrix = multiplyMat4(translationMatrix, localTransform);
    
    // RESULTADO: El árbol está perfectamente centrado en (posX, posY, posZ)
    // porque seguimos exactamente el mismo patrón que el hexágono
    
    treeInstances.push({
      modelMatrix: modelMatrix
    });
  }
  
  console.log(`✓ ${treeInstances.length} árboles instanciados sobre ${grassCellsCount} celdas de Grass (de ${cells.length} totales, densidad: ${(TREE_DENSITY * 100).toFixed(1)}%)`);
  
  return treeInstances;
}

/**
 * Crea instancias de ovejas distribuidas aleatoriamente sobre las celdas del bioma Grass.
 * 
 * @param {Array} cells - Array de celdas con formato { q, r, worldX, worldZ, height, color, biome }
 * @param {Object} targetBiome - Bioma objetivo para generar ovejas (por defecto grassBiome)
 * @returns {Array<{modelMatrix: Float32Array}>} Array de instancias de ovejas
 */
function createSheepInstances(cells, targetBiome = grassBiome) {
  const sheepInstances = [];
  let validCells = 0;
  let skippedBorder = 0;
  let skippedNoHeight = 0;
  
  // MARGEN DE SEGURIDAD: Excluir celdas muy cerca del borde para evitar ovejas fuera del terreno
  // El modelo de oveja puede extenderse un poco fuera del hexágono, así que dejamos un margen
  const SAFE_MARGIN = 1; // Excluir celdas a menos de 1 unidad del borde
  
  for (const cell of cells) {
    // Solo generar ovejas en celdas del bioma objetivo
    if (cell.biome !== targetBiome) {
      continue;
    }
    
    validCells++;
    
    // Validar que la celda esté DENTRO del radio con margen de seguridad
    // Esto evita que las ovejas aparezcan fuera del terreno
    const distance = hexDistance(0, 0, cell.q, cell.r);
    if (distance >= (GRID_RADIUS - SAFE_MARGIN)) {
      skippedBorder++;
      continue; // Saltar celdas cerca del borde
    }
    
    // Validar que la altura sea válida
    if (!cell.height || cell.height <= 0) {
      skippedNoHeight++;
      continue;
    }
    
    // Validar que worldX y worldZ existan y sean números válidos
    if (typeof cell.worldX !== 'number' || typeof cell.worldZ !== 'number' ||
        isNaN(cell.worldX) || isNaN(cell.worldZ) ||
        !isFinite(cell.worldX) || !isFinite(cell.worldZ)) {
      console.warn(`  ⚠️ Celda (${cell.q}, ${cell.r}) tiene coordenadas inválidas, saltando`);
      continue;
    }
    
    // Decidir aleatoriamente si esta celda debe tener una oveja
    if (Math.random() >= SHEEP_DENSITY) {
      continue;
    }
    
    // MARCADO DE CELDA OCUPADA: Marcar esta celda como ocupada por una oveja
    // Esto evita que los árboles se generen en el mismo hexágono
    cell.occupied = true;
    
    // Posición: usar EXACTAMENTE los mismos datos que usan los hexágonos y árboles
    // Los hexágonos usan: x = cell.worldX, z = cell.worldZ, y = 0 (base)
    // Los árboles usan: posX = cell.worldX, posZ = cell.worldZ, posY = actualHexHeight
    // La oveja debe usar EXACTAMENTE lo mismo
    // IMPORTANTE: El hexágono se crea con baseHeight = 0.5 y se escala por visualHeight
    // La altura final del hexágono es: baseHeight * visualHeight = baseHeight * (height * HEIGHT_UNIT)
    // Esta es la altura de la tapa del hexágono (donde debe apoyarse la oveja)
    // La oveja tiene su base en y=0 en su sistema local (después del centrado)
    // Por lo tanto, posY debe ser la altura final del hexágono
    // IMPORTANTE: HEX_BASE_HEIGHT debe coincidir con baseHeight en main() (línea 1888)
    const HEX_BASE_HEIGHT = 0.5;
    const posX = cell.worldX;  // Mismo que hexágono y árbol
    const posZ = cell.worldZ;  // Mismo que hexágono y árbol
    const visualHeight = cell.height * HEIGHT_UNIT;  // Altura visual calculada
    const actualHexHeight = HEX_BASE_HEIGHT * visualHeight;  // Altura real del hexágono = baseHeight * visualHeight
    const posY = actualHexHeight;  // Oveja sobre la tapa del hexágono (igual que árbol)
    
    // Log detallado para debuggear (solo las primeras 5 ovejas)
    if (sheepInstances.length < 5) {
      console.log(`  Oveja ${sheepInstances.length + 1}:`);
      console.log(`    - Celda: (${cell.q}, ${cell.r}), distancia=${distance.toFixed(2)}`);
      console.log(`    - Posición hexágono: (${posX.toFixed(6)}, 0, ${posZ.toFixed(6)})`);
      console.log(`    - Posición oveja: (${posX.toFixed(6)}, ${posY.toFixed(6)}, ${posZ.toFixed(6)})`);
    }
    
    // Escala - reducir un poco para asegurar que quepa dentro del hexágono
    const scale = 1.2;
    
    // Construir matriz modelo: EXACTAMENTE igual que los árboles
    // IMPORTANTE: Usar exactamente el mismo patrón que los árboles para garantizar el mismo centrado
    // Los árboles usan: translation * (rotation * scale)
    // Cuando rotationY = 0, esto se reduce a: translation * (identity * scale) = translation * scale
    // Pero usamos el mismo patrón para evitar diferencias de precisión numérica
    
    // PASO 1: Crear matriz de escala (igual que los árboles)
    const scaleMatrix = scaleMat4(scale, scale, scale);
    
    // PASO 2: Crear matriz de rotación (rotationY = 0 para ovejas)
    const rotationY = 0;
    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);
    const rotationMatrix = new Float32Array([
      cosR, 0, sinR, 0,
      0, 1, 0, 0,
      -sinR, 0, cosR, 0,
      0, 0, 0, 1
    ]);
    
    // PASO 3: Combinar rotación y escala (rotation * scale)
    const localTransform = multiplyMat4(rotationMatrix, scaleMatrix);
    
    // PASO 4: Crear matriz de traslación (igual que los árboles)
    const translationMatrix = translateMat4(posX, posY, posZ);
    
    // PASO 5: Combinar traslación con transformaciones locales (EXACTAMENTE igual que los árboles)
    // translation * (rotation * scale) = translation * scale (cuando rotationY = 0)
    const modelMatrix = multiplyMat4(translationMatrix, localTransform);
    
    sheepInstances.push({
      modelMatrix: modelMatrix
    });
  }
  
  console.log(`✓ ${sheepInstances.length} ovejas instanciadas sobre ${validCells} celdas válidas de Grass`);
  if (skippedBorder > 0) console.log(`  (saltadas ${skippedBorder} celdas cerca del borde por seguridad)`);
  if (skippedNoHeight > 0) console.log(`  (saltadas ${skippedNoHeight} celdas sin altura válida)`);
  
  return sheepInstances;
}

/**
 * ============================================================
 * FUNCIÓN PRINCIPAL
 * ============================================================
 */

/**
 * Función principal que inicializa la aplicación y dibuja una grilla de prismas hexagonales.
 * 
 * RESPONSABILIDAD:
 * - Inicializar WebGL (usando funciones de render/gl.js)
 * - Crear el programa de shaders
 * - Crear los datos de la geometría (prisma hexagonal base)
 * - Crear el buffer con los datos (reutilizable para todos los prismas)
 * - Dibujar una grilla 3x3 de prismas hexagonales usando coordenadas hexagonales
 * 
 * Flujo de ejecución:
 * 1. Inicializa WebGL y habilita depth testing
 * 2. Crea el programa de shaders
 * 3. Crea los datos del prisma hexagonal base (centrado en origen)
 * 4. Crea el buffer y carga los datos
 * 5. Dibuja la grilla de prismas (cada uno en su posición usando matrices)
 */
async function main() {
  console.log('Iniciando aplicación WebGL...');
  
  // Paso 1: Inicializar WebGL (función de render/gl.js)
  const webgl = initWebGL('glCanvas');
  if (!webgl) {
    return;
  }
  const { gl } = webgl;
  
  // Habilita el depth testing para renderizado 3D correcto
  // Esto permite que los objetos más cercanos se dibujen sobre los más lejanos
  gl.enable(gl.DEPTH_TEST);
  
  // Limpia también el buffer de profundidad
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Paso 2: Crear programa de shaders (función de render/gl.js)
  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    console.error('Error: No se pudo crear el programa de shaders');
    return;
  }
  
  // Paso 3: Usar el bioma de pasto (grass biome)
  // El bioma se carga desde biomes/grassBiome.js
  // grassBiome está definido en ese archivo y expuesto globalmente
  
  // Paso 4: Crear estructura de celdas usando los parámetros del bioma
  // Cada celda tiene { q, r, height, color }
  // - height: generado entre minHeight y maxHeight del bioma usando ruido
  // - color: generado desde baseColor con variación colorVariance
  // Genera un terreno hexagonal completo con radio GRID_RADIUS
  const cells = createCells(grassBiome);
  
  // Paso 5: Crear datos del prisma hexagonal base (altura = 1.0) con normales
  // IMPORTANTE: Usamos HEX_RADIUS_WORLD como única fuente de verdad para el tamaño del hexágono
  // Este mismo valor se usa en hexToPixel3D para calcular las posiciones de los centros
  // Esto garantiza que el tamaño físico del hexágono coincida exactamente con el espaciado
  // de la grilla, creando un mosaico perfecto sin huecos ni solapamientos
  const baseHeight = 0.5; // Altura base del prisma (se escala según cell.height)
  const prismData = createHexagonPrismData(HEX_RADIUS_WORLD, baseHeight);
  
  // Paso 6: Crear buffers separados para posiciones y normales
  // Cada buffer guarda: 24 triángulos × 3 vértices × 3 componentes = 216 floats totales
  // Estos buffers se reutilizan para todos los prismas de la grilla
  // Las alturas diferentes se logran escalando la matriz modelo en Y
  // Las normales se transforman usando la matriz normal (inversa transpuesta)
  const positionBuffer = createBuffer(gl, prismData.positions);
  const normalBuffer = createBuffer(gl, prismData.normals);
  
  // Paso 7: Crear mesh del árbol programáticamente
  // El árbol se genera en código (sin modelos externos)
  // Está compuesto por un tronco hexagonal y una copa de 3 conos apilados
  const treeMesh = createTreeMesh(gl);
  
  // Paso 8: Cargar modelo OBJ de oveja con su material MTL
  // El modelo se carga desde objects/sheep.obj y objects/sheep.mtl
  // loadObjWithMtl parsea el OBJ separado por materiales (White=lana, Black=cabeza/patas)
  // Retorna buffers WebGL separados para cada material
  let sheepMesh = null;
  
  try {
    console.log('Cargando modelo de oveja...');
    const sheepData = await loadObjWithMtl(gl, "objects/Sheep.obj", "objects/Sheep.mtl");
    if (!sheepData || !sheepData.white || !sheepData.black) {
      throw new Error('El modelo de oveja no se cargó correctamente (estructura de datos inválida)');
    }
    sheepMesh = {
      white: sheepData.white,  // Lana (blanco)
      black: sheepData.black   // Cabeza y patas (gris oscuro)
    };
    console.log(`✓ Modelo de oveja cargado: White=${sheepData.white.indexCount / 3} triángulos, Black=${sheepData.black.indexCount / 3} triángulos`);
  } catch (error) {
    console.error(`❌ ERROR al cargar el modelo de oveja: ${error.message}`);
    console.error('  Stack trace:', error.stack);
    console.warn('  Continuando sin ovejas...');
    sheepMesh = null;
  }
  
  // Paso 9: Crear instancias de árboles distribuidas sobre el terreno
  // Solo las celdas del bioma Grass pueden tener árboles
  // La densidad está controlada por TREE_DENSITY (8% por defecto)
  // Las posiciones (x, z) se usan directamente de las celdas (ya calculadas)
  const treeInstances = createTreeInstances(cells, grassBiome);
  
  // Paso 10: Crear instancias de ovejas distribuidas sobre el terreno
  // Solo las celdas del bioma Grass pueden tener ovejas
  // La densidad está controlada por SHEEP_DENSITY (4% por defecto)
  // Las posiciones (x, z) se usan directamente de las celdas (ya calculadas)
  // Cada oveja está perfectamente centrada en un hexágono usando cell.worldX y cell.worldZ
  const sheepInstances = createSheepInstances(cells, grassBiome);
  
  // Paso 11: Preparar matrices de vista y proyección (compartidas para terreno, árboles y ovejas)
  // Estas matrices se calculan una vez y se usan para todos los objetos
  const terrainSize = GRID_RADIUS * HEX_RADIUS_WORLD * Math.sqrt(3) * 2;
  const cameraDistance = terrainSize * 1.2;
  const eye = [cameraDistance * 0.7, cameraDistance * 0.8, cameraDistance * 0.7];
  const center = [0, 0, 0];
  const up = [0, 1, 0];
  const aspect = webgl.canvas.width / webgl.canvas.height;
  const viewMatrix = lookAt(eye, center, up);
  const projectionMatrix = perspective(60, aspect, 0.1, 100.0);
  
  // Paso 12: Dibujar el terreno primero (hexágonos)
  // El terreno se dibuja antes que los objetos para que queden encima visualmente
  drawHexGrid(gl, program, positionBuffer, normalBuffer, webgl.canvas, cells, HEX_RADIUS_WORLD, viewMatrix, projectionMatrix);
  
  // Paso 13: Dibujar todos los árboles encima del terreno
  // Cada árbol se renderiza usando su matriz modelo individual (con rotación y escala aleatorias)
  // Todos los árboles comparten el mismo mesh (treeMesh) pero tienen diferentes transformaciones
  // Los árboles se dibujan con colores diferentes para tronco (marrón) y copa (verde)
  if (treeInstances.length > 0) {
    for (const tree of treeInstances) {
      // drawTree dibuja tanto el tronco como la copa con sus colores respectivos
      drawTree(gl, program, treeMesh, tree.modelMatrix, viewMatrix, projectionMatrix);
    }
    console.log(`✓ ${treeInstances.length} árboles renderizados (tronco marrón + copa verde)`);
  }
  
  // Paso 14: Dibujar todas las ovejas encima del terreno
  // Cada oveja se renderiza usando su matriz modelo individual (con rotación y escala aleatorias)
  // Todas las ovejas comparten el mismo mesh (sheepMesh) pero tienen diferentes transformaciones
  // Las ovejas se dibujan con colores diferentes: lana blanca y cabeza/patas gris oscuro
  // Solo dibuja si el modelo se cargó correctamente
  if (sheepMesh && sheepInstances.length > 0) {
    const whiteColor = [0.95, 0.95, 0.95]; // Blanco para la lana
    const blackColor = [0.2, 0.2, 0.2];    // Gris oscuro para cabeza y patas
    
    for (const sheep of sheepInstances) {
      // Dibujar la lana (parte White) en blanco
      drawMesh(
        gl, program,
        sheepMesh.white.positionBuffer,
        sheepMesh.white.normalBuffer,
        sheepMesh.white.indexBuffer,
        sheepMesh.white.indexCount,
        sheep.modelMatrix,
        viewMatrix,
        projectionMatrix,
        whiteColor
      );
      
      // Dibujar la cabeza y patas (parte Black) en gris oscuro
      drawMesh(
        gl, program,
        sheepMesh.black.positionBuffer,
        sheepMesh.black.normalBuffer,
        sheepMesh.black.indexBuffer,
        sheepMesh.black.indexCount,
        sheep.modelMatrix,
        viewMatrix,
        projectionMatrix,
        blackColor
      );
    }
    console.log(`✓ ${sheepInstances.length} ovejas renderizadas (lana blanca + cabeza/patas gris oscuro)`);
  }
  
  console.log('✓ ¡Aplicación iniciada correctamente!');
}

// Ejecuta la función principal cuando la página y todos los scripts están cargados
// Espera a que window.onload para asegurar que todos los scripts (incluyendo SimplexNoise y biomas) estén cargados
// El script de SimplexNoise se carga ANTES de main.js, por lo que estará disponible cuando main() se ejecute
if (document.readyState === 'loading') {
  window.addEventListener('load', main);
} else {
  // Si ya está cargado, ejecutar después de un pequeño delay para asegurar que los scripts de biomas estén listos
  // Esto es necesario porque los scripts se cargan síncronamente pero main() necesita que grassBiome esté definido
  setTimeout(main, 0);
}
