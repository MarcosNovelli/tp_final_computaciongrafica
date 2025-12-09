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
 * BIOMA ACTIVO: Selecciona qué bioma se usará para generar todo el terreno.
 * 
 * Valores posibles:
 * - "Grass": Bioma de pasto (verde, alturas moderadas, densidad baja de árboles)
 * - "Forest": Bioma de bosque (marrón, alturas moderadas-altas, densidad alta de árboles)
 * 
 * NOTA: Este valor determina TODO el terreno. Para mezclar biomas (islas de biomas diferentes),
 * necesitarías una lógica más compleja que está fuera del alcance de este paso.
 */
/**
 * MODO DE VISUALIZACIÓN: Selecciona cómo se muestra el mundo.
 * 
 * Valores posibles:
 * - "singleBiome": Modo actual - una sola isla/tile de un bioma
 * - "board": Nuevo modo - tablero con múltiples tiles, cada uno con su bioma
 */
const VIEW_MODE = "board"; // Cambiar entre "singleBiome" y "board"

/**
 * BIOMA ACTIVO: Solo se usa en modo "singleBiome".
 * En modo "board", cada tile tiene su propio bioma asignado.
 * 
 * Valores posibles:
 * - "Grass": Bioma de pasto (verde, alturas moderadas, densidad baja de árboles)
 * - "Forest": Bioma de bosque (marrón, alturas moderadas-altas, densidad alta de árboles)
 * - "Rock": Bioma de montaña (verde/roca/nieve, alturas muy altas)
 * - "Clay": Bioma de arcilla (cobre/roca/pasto, alturas moderadas)
 * - "Wheat": Bioma de trigo (naranja arcillado, terreno plano, trigo denso)
 */
const ACTIVE_BIOME = "Grass"; // Cambiar entre "Grass", "Forest", "Rock", "Clay" y "Wheat"

/**
 * CONFIGURACIÓN DEL TABLERO (solo se usa en modo "board"):
 * - boardWidth: Número de tiles en el eje X (columnas)
 * - boardHeight: Número de tiles en el eje Y (filas)
 */
/**
 * CONFIGURACIÓN DEL TABLERO (solo se usa en modo "board"):
 * - BOARD_WIDTH: Número de tiles en el eje X (columnas)
 * - BOARD_HEIGHT: Número de tiles en el eje Y (filas)
 * 
 * TAMAÑO 5×5:
 * El tablero genera exactamente 25 tiles (5×5) organizados en una grilla hexagonal.
 * Cada tile es un "hexágono grande" que contiene GRID_RADIUS hexágonos pequeños.
 */
const BOARD_WIDTH = 2;  // Número de tiles en X (5 para tablero 5×5)
const BOARD_HEIGHT = 3;  // Número de tiles en Y (5 para tablero 5×5)

/**
 * Obtiene el bioma activo actual basado en la constante ACTIVE_BIOME.
 * 
 * @returns {Object} Objeto bioma (grassBiome, forestBiome, rockBiome, clayBiome o wheatBiome)
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
      return grassBiome; // Por defecto, usa Grass
  }
}

/**
 * Densidad de árboles en el bioma Grass (porcentaje de celdas que tendrán un árbol).
 * 
 * NOTA: Esta constante se usa como fallback. La densidad real viene del bioma activo
 * (biome.treeDensity), pero mantenemos esta constante para compatibilidad.
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
 * NOTA: Esta constante se usa como fallback. La densidad real viene del bioma activo
 * (biome.sheepDensity), pero mantenemos esta constante para compatibilidad.
 * 
 * Valor entre 0.0 y 1.0:
 * - 0.0 = ninguna oveja
 * - 1.0 = una oveja en cada celda
 * - 0.04 = aproximadamente 4% de las celdas tendrán una oveja
 */
const SHEEP_DENSITY = 0.06;

/**
 * Color para la copa de los árboles en el bioma Grass (verde oscuro estilo low-poly).
 * 
 * Se aplica como uniform u_color al fragment shader.
 * Formato: [R, G, B] con valores de 0.0 a 1.0
 */
const TREE_CROWN_COLOR_GRASS = [0.1, 0.35, 0.1]; // Verde oscuro para la copa en Grass

/**
 * Color para la copa de los árboles en el bioma Forest (verde muy oscuro para pinos).
 * 
 * Se aplica como uniform u_color al fragment shader.
 * Formato: [R, G, B] con valores de 0.0 a 1.0
 */
const TREE_CROWN_COLOR_FOREST = [0.05, 0.25, 0.08]; // Verde muy oscuro para pinos en Forest

/**
 * Color para el tronco de los árboles (marrón oscuro como en la imagen de referencia).
 * 
 * Se aplica como uniform u_color al fragment shader.
 * Formato: [R, G, B] con valores de 0.0 a 1.0
 * 
 * NOTA: El color del tronco es el mismo para todos los biomas (es marrón).
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
 * Para hexágonos "flat-top" (con un lado plano horizontal), la fórmula
 * estándar para convertir coordenadas axiales (q, r) a posición (x, z) es:
 * 
 *   x = HEX_RADIUS_WORLD * 1.5 * q
 *   z = HEX_RADIUS_WORLD * sqrt(3) * (r + q / 2.0)
 * 
 * Esta fórmula garantiza que los hexágonos se toquen perfectamente en sus LADOS
 * (no en las puntas) sin huecos ni solapamientos, formando un mosaico perfecto
 * donde cada lado está en contacto directo con otro lado.
 * 
 * Para hexágonos flat-top con radio r (centro a vértice):
 * - Ancho (vértice a vértice) = 2 * r
 * - Altura (borde plano a borde plano) = r * sqrt(3)
 * - Apotema (centro a borde plano) = r * sqrt(3) / 2
 * 
 * La distancia entre centros de hexágonos adyacentes es exactamente:
 * - Horizontal (misma fila): HEX_RADIUS_WORLD * 1.5 = 3/4 del ancho
 * - Vertical (filas adyacentes): HEX_RADIUS_WORLD * sqrt(3) = altura del hexágono
 * - Vertical (filas adyacentes): HEX_RADIUS_WORLD * 1.5
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
  varying vec3 vWorldPosition;  // Posición en espacio del mundo (para cálculo del view direction)
  
  void main() {
    // Transforma la posición del vértice al espacio del mundo
    vec4 worldPosition = u_model * vec4(a_position, 1.0);
    v_position = worldPosition.xyz; // Posición en espacio del mundo (mantenido por compatibilidad)
    vWorldPosition = worldPosition.xyz; // Posición en espacio del mundo para el fragment shader
    
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
  
  uniform vec3 u_color;           // Color RGB del hexágono (pasado desde la aplicación)
  uniform float u_alpha;           // Opacidad (por defecto 1.0)
  uniform float uIsWater;          // Bandera: 1.0 si es agua, 0.0 si es terreno
  uniform float uNoLighting;       // Bandera: 1.0 si no se debe aplicar iluminación (color directo)
  uniform vec3 uCameraPosition;    // Posición de la cámara en espacio del mundo
  
  varying vec3 v_normal;           // Normal transformada (interpolada entre vértices)
  varying vec3 v_position;         // Posición en espacio del mundo (interpolada, mantenido por compatibilidad)
  varying vec3 vWorldPosition;     // Posición en espacio del mundo (para cálculo correcto del view direction)
  
  void main() {
    // Normaliza la normal interpolada
    vec3 N = normalize(v_normal);
    
    // Dirección de la luz direccional (tipo sol)
    // Vector apuntando hacia la luz, normalizado
    vec3 L = normalize(vec3(0.6, 1.0, 0.4));
    
    // Dirección de la vista (viewDir) - CRÍTICO para el cálculo correcto del brillo especular del agua
    // Se calcula desde la posición del fragmento hacia la posición de la cámara
    // vWorldPosition viene del vertex shader y representa la posición del fragmento en espacio del mundo
    // uCameraPosition es la posición real de la cámara en espacio del mundo
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    
    // MATERIAL ESPECIAL PARA AGUA:
    // Realzamos el efecto de agua con reflejo de "cielo" fake y Fresnel
    if (uIsWater > 0.5) {
      vec3 base = u_color;
      float NdotL = max(dot(N, L), 0.0);
      
      // Iluminación difusa suave
      vec3 diffuse = base * (0.5 + NdotL * 0.5);
      
      // Fresnel: más reflectante en ángulos rasantes
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      
      // Color de "cielo" fake para el reflejo (azul muy pálido)
      vec3 skyColor = vec3(0.8, 0.9, 0.95);
      
      // Especular del sol (Phong)
      vec3 R = reflect(-L, N);
      float specAngle = max(dot(R, V), 0.0);
      float spec = pow(specAngle, 60.0) * 0.6; // Brillo nítido y fuerte en el punto solar
      
      // Combinar: Difusa + (Cielo * Fresnel) + Especular Sol
      vec3 waterColor = mix(diffuse, skyColor, fresnel * 0.6) + vec3(spec);
      
      gl_FragColor = vec4(waterColor, u_alpha);
      return;
    }
    
    // ILUMINACIÓN PARA TERRENO (no agua):
    // Usamos iluminación Lambertiana estándar pero SUAVE (Matte finish)
    
    // Color base del hexágono
    vec3 base = u_color;
    
    // Cálculo de iluminación Lambertiana
    float NdotL = max(dot(N, L), 0.0);
    
    // Iluminación "Wrapped Diffuse" para suavidad
    // En lugar de ir a negro intenso en las sombras, envuelve la luz un poco
    float diffuse = NdotL * 0.7 + 0.3; // Suaviza el gradiente de luz
    
    // Ambiente más brillante y azulado para simular cielo
    vec3 ambient = vec3(0.7, 0.75, 0.8) * 0.6;
    
    // Luz directa cálida
    vec3 sunLight = vec3(1.0, 0.95, 0.9) * diffuse * 0.8;
    
    // Mezcla final matte: color base * (ambiente + sol)
    // Sin componente especular para evitar brillo plástico
    vec3 finalColor = base * (ambient + sunLight);
    
    // Output final con alpha
    gl_FragColor = vec4(finalColor, u_alpha);
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
 *   de la grilla, creando un mosaico perfecto donde los LADOS se tocan directamente
 *   (orientación flat-top) sin huecos ni solapamientos
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
  
  // OFFSET DE ORIENTACIÓN PARA HEXÁGONOS "FLAT-TOP":
  // Para hexágonos flat-top, un LADO PLANO debe estar horizontal (arriba/abajo).
  // 
  // La fórmula de teselado para flat-top (x = size * 1.5 * q, z = size * sqrt(3) * (r + q/2))
  // asume que los hexágonos están orientados con un lado plano horizontal.
  //
  // Si generamos vértices empezando con angle = 0:
  //   vértice 0: (radius, 0) - apunta hacia la derecha (+X)
  //   vértice 1: (radius*cos(60°), radius*sin(60°)) - apunta diagonal arriba-derecha
  //
  // Para hexágonos flat-top, necesitamos que un lado plano esté arriba.
  // Con angleOffset = 0, el primer vértice está en (radius, 0) y el siguiente en
  // (radius*cos(60°), radius*sin(60°)), lo que coloca un lado plano horizontal arriba.
  //
  // IMPORTANTE: Con angleOffset = 0, los hexágonos tienen sus lados planos
  // horizontales, permitiendo que los LADOS se toquen directamente (no las puntas),
  // creando el mosaico perfecto que queremos.
  const angleOffset = 0; // Sin rotación - orientación flat-top (lados planos arriba)
  
  // Calcular los 6 vértices del hexágono (para ambas tapas)
  const bottomVertices = [];
  const topVertices = [];

  for (let i = 0; i < numVertices; i++) {
    // Aplicar el offset para orientación flat-top (lados planos horizontales)
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
 * @param {Object} noiseGenerator - Generador de ruido Simplex opcional (si no se proporciona, se crea uno nuevo)
 * @returns {Array} Array de objetos { q, r, height, color }
 */
function createCells(biome, noiseGenerator = null) {
  const cells = [];

  // Extrae parámetros del bioma (algunos pueden ser undefined para biomas especiales como Rock)
  const baseColor = biome.baseColor; // Puede ser undefined para biomas que usan computeColor personalizado
  const minHeight = biome.minHeight;
  const maxHeight = biome.maxHeight;
  const colorVariance = biome.colorVariance;
  
  // Inicializa el generador de ruido Simplex (o usa el proporcionado)
  // Si noiseGenerator ya fue proporcionado, puede ser:
  // 1. Un generador normal con noise2D (función)
  // 2. Un wrapper con offset (de board.js) que tiene noise2D como función wrapper que aplica offset
  // 3. Un objeto con offsetX/offsetZ pero noise2D null (será creado y luego aplicado el offset)
  // 4. null/undefined, en cuyo caso creamos uno nuevo
  let finalNoiseGenerator = noiseGenerator;
  let noiseOffsetX = 0;
  let noiseOffsetZ = 0;
  
  // Si el generador tiene offset pero noise2D es null, guardar el offset para aplicarlo después
  if (finalNoiseGenerator && finalNoiseGenerator.offsetX !== undefined && !finalNoiseGenerator.noise2D) {
    noiseOffsetX = finalNoiseGenerator.offsetX;
    noiseOffsetZ = finalNoiseGenerator.offsetZ;
    finalNoiseGenerator = null; // Crearemos uno nuevo y aplicaremos el offset
  }
  
  // Si no hay generador válido, crear uno nuevo
  if (!finalNoiseGenerator || (finalNoiseGenerator && typeof finalNoiseGenerator.noise2D !== 'function')) {
    // Crear nuevo generador de ruido (lógica existente)
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
      
      // Crear wrapper con la interfaz que espera generateHeight
      // Si tenemos un offset guardado (de board.js), aplicarlo ahora
      if (noiseOffsetX !== 0 || noiseOffsetZ !== 0) {
        // Crear wrapper que aplica el offset a las coordenadas antes de evaluar el ruido
        finalNoiseGenerator = {
          noise2D: function(x, z) {
            return noise2D(x + noiseOffsetX, z + noiseOffsetZ);
          }
        };
      } else {
        // Generador normal sin offset
        finalNoiseGenerator = {
          noise2D: noise2D
        };
      }
      
    } catch (error) {
      console.warn('⚠️ No se pudo inicializar SimplexNoise, usando ruido determinista de respaldo.', error);
      // Fallback de ruido determinista simple: hash trigonométrico sin dependencias
      const fallbackNoise2D = (x, z) => {
        const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1; // rango [-1, 1]
      };
      finalNoiseGenerator = {
        noise2D: (x, z) => fallbackNoise2D(x + noiseOffsetX, z + noiseOffsetZ)
      };
    }
  }
  
  // Usar el generador de ruido final (ya sea el proporcionado o el recién creado)
  // Renombramos a noiseGen para evitar conflicto con el parámetro noiseGenerator
  const noiseGen = finalNoiseGenerator;
  
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
      // GENERACIÓN DE ALTURA:
      // Algunos biomas tienen su propia función computeHeight (ej: Rock con forma de montaña)
      // Si el bioma tiene computeHeight, usarla; si no, usar generateHeight estándar con ruido
      let height;
      let heightNorm = null; // Algunos biomas necesitan heightNorm para colores (ej: Rock)

      if (biome.computeHeight && typeof biome.computeHeight === 'function') {
        // Bioma con función computeHeight personalizada (ej: Rock con forma de montaña)
        // Esta función puede retornar {height, heightNorm} o solo height
        const context = { gridRadius: GRID_RADIUS };
        const result = biome.computeHeight(q, r, noiseGen, context);
        
        if (typeof result === 'object' && result !== null) {
          // Si retorna un objeto, puede tener height y heightNorm
          height = result.height;
          heightNorm = result.heightNorm !== undefined ? result.heightNorm : null;
        } else {
          // Si retorna un número directamente, usar ese valor
          height = result;
        }
      } else {
        // Bioma estándar: usar generateHeight con ruido Simplex
        // Usa Simplex Noise para generar alturas suaves y continuas
        // Hexágonos adyacentes tendrán alturas similares, creando un terreno natural
        // El ruido se evalúa en (q * noiseScale, r * noiseScale) y se mapea al rango del bioma
        const biomeNoiseScale = biome.heightNoiseScale !== undefined ? biome.heightNoiseScale : noiseScale;
        height = generateHeight(q, r, biome, noiseGen, biomeNoiseScale);
      }

      // Calcular la posición (x, z) del centro del hexágono en el mundo
      // Esto viene directamente de la función hexToPixel3D (equivalente a axialToWorld)
      // Se almacena en la celda como worldX y worldZ para reutilización
      // IMPORTANTE: hexToPixel3D retorna {x, y, z}, pero y siempre es 0 (plano XZ)
      const pos = hexToPixel3D(q, r, HEX_RADIUS_WORLD);

      // Crear objeto celda ANTES de calcular el color
      // Esto permite que computeColor pueda modificar propiedades (ej: candidateWater)
      const cell = {
        q: q,
        r: r,
        worldX: pos.x,  // Posición X del centro del hexágono en el mundo (viene de hexToPixel3D)
        worldZ: pos.z,  // Posición Z del centro del hexágono en el mundo (viene de hexToPixel3D)
        height: height,
        heightNorm: heightNorm,  // Altura normalizada (0..1) - solo para biomas que la usan (ej: Rock)
        biome: biome,  // Guardar referencia al bioma para filtrado
        candidateWater: false, // Por defecto, no es candidato a agua (se puede cambiar en computeColor)
        isWater: false, // Se decidirá después mediante detección de clusters
        waterHeight: null, // Altura específica para agua (se asignará en detectWaterClusters)
        noiseGenerator: noiseGen // Pasamos el generador de ruido para que computeColor pueda usarlo (ej: Wheat)
      };

      // Si heightNorm no se calculó arriba pero el bioma lo necesita, calcularlo ahora
      if (cell.heightNorm === null && biome.computeColor) {
        // Calcular heightNorm para biomas que lo necesitan (como Rock)
        const heightRange = biome.maxHeight - biome.minHeight || 1.0;
        cell.heightNorm = (height - biome.minHeight) / heightRange;
      }

      // GENERACIÓN DE COLOR usando parámetros del bioma:
      // Cada bioma tiene su propia función computeColor específica
      // Si el bioma tiene computeColor, la usa; si no, usa la función genérica
      // IMPORTANTE: Pasamos la celda como tercer parámetro para que computeColor pueda marcarla como agua
      let color;
      if (biome.computeColor && typeof biome.computeColor === 'function') {
        // Usa la función específica del bioma (ej: computeGrassColor, computeForestColor, computeRockColor)
        // Algunos biomas usan height (Grass, Forest), otros usan heightNorm (Rock)
        // La función debe adaptarse a la firma esperada
        if (biome.name === "Rock") {
          // Bioma Rock: usa heightNorm directamente
          // Si heightNorm no está disponible, calcularlo ahora
          if (cell.heightNorm === null || cell.heightNorm === undefined) {
            const heightRange = biome.maxHeight - biome.minHeight || 1.0;
            cell.heightNorm = (height - biome.minHeight) / heightRange;
          }
          color = biome.computeColor(cell.heightNorm);
        } else {
          // Otros biomas: usa height, biome y cell (firma estándar)
          color = biome.computeColor(height, biome, cell);
        }
      } else {
        // Fallback: usa la función genérica para biomas sin función personalizada
        color = generateColor(baseColor, colorVariance);
      }

      // Validar que el color sea válido (array de 3 números)
      if (!color || !Array.isArray(color) || color.length !== 3 ||
        typeof color[0] !== 'number' || typeof color[1] !== 'number' || typeof color[2] !== 'number') {
        console.error(`Error: Color inválido para celda (${q}, ${r}):`, color);
        // Usar color por defecto si hay error
        color = [0.5, 0.5, 0.5]; // Gris por defecto
      }

      // Asignar el color calculado a la celda
      cell.color = color;

      // Agregar la celda al array
      cells.push(cell);
    }
  }

  console.log(`✓ ${cells.length} celdas creadas con bioma (radio hexagonal: ${GRID_RADIUS}):`);
  console.log(`  - Alturas: ${minHeight} a ${maxHeight}`);
  // Solo mostrar color base si el bioma lo tiene (Rock no tiene baseColor)
  if (baseColor && Array.isArray(baseColor) && baseColor.length >= 3) {
    console.log(`  - Color base: [${baseColor[0].toFixed(2)}, ${baseColor[1].toFixed(2)}, ${baseColor[2].toFixed(2)}]`);
  } else {
    console.log(`  - Color: calculado dinámicamente por computeColor`);
  }
  if (colorVariance !== undefined) {
    console.log(`  - Variación de color: ±${colorVariance}`);
  }

  // DETECCIÓN DE CLUSTERS DE AGUA (para biomas Forest y Clay)
  // Después de crear todas las celdas, detectar clusters de agua conectados
  // Solo los clusters grandes (≥6 celdas) se marcan como agua
  // Esto evita que aparezcan "pozos random" individuales
  if (biome.name === "Forest" || biome.name === "Clay" || biome.name === "Wheat") {
    // Para Wheat, usar un tamaño mínimo más pequeño ya que el terreno es más plano
    // y puede haber menos clusters grandes
    const MIN_WATER_CLUSTER = biome.name === "Wheat" ? 4 : 6; // 4 para Wheat, 6 para otros
    detectWaterClusters(cells, MIN_WATER_CLUSTER);

    // Aplicar altura y color de agua a las celdas marcadas como agua
    for (const cell of cells) {
      if (cell.isWater) {
        if (cell.waterHeight !== null) {
          cell.height = cell.waterHeight; // Altura plana para el agua
        }
        // Asegurar que el color de agua esté aplicado
        cell.color = [0.35, 0.45, 0.75]; // Color de agua azul claro
      }
    }
  }

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
/**
 * Obtiene los 6 vecinos de una celda hexagonal en coordenadas axiales.
 * 
 * En una grilla hexagonal, cada celda tiene exactamente 6 vecinos:
 * - (q+1, r), (q-1, r) - Este y Oeste
 * - (q, r+1), (q, r-1) - Noreste y Suroeste
 * - (q+1, r-1), (q-1, r+1) - Sureste y Noroeste
 * 
 * @param {number} q - Coordenada q del hexágono
 * @param {number} r - Coordenada r del hexágono
 * @returns {Array<{q: number, r: number}>} Array con las 6 coordenadas de los vecinos
 */
function getHexNeighbors(q, r) {
  return [
    { q: q + 1, r: r },      // Este
    { q: q - 1, r: r },      // Oeste
    { q: q, r: r + 1 },      // Noreste
    { q: q, r: r - 1 },      // Suroeste
    { q: q + 1, r: r - 1 },  // Sureste
    { q: q - 1, r: r + 1 }   // Noroeste
  ];
}

/**
 * Encuentra un cluster conectado de celdas candidatas a agua usando BFS (Breadth-First Search).
 * 
 * RESPONSABILIDAD:
 * - Partiendo de una celda candidata no visitada, explora todos sus vecinos candidatos
 * - Retorna todas las celdas del cluster conectado
 * - Marca las celdas como visitadas durante la búsqueda
 * 
 * DETECCIÓN DE CLUSTERS:
 * - Un cluster es un grupo de celdas candidatas a agua que están conectadas entre sí
 * - Dos celdas están conectadas si son vecinos hexagonales adyacentes
 * - Usa BFS para encontrar todos los vecinos conectados recursivamente
 * 
 * @param {Object} startCell - Celda inicial del cluster (debe tener candidateWater === true)
 * @param {Map<string, Object>} cellMap - Map de celdas indexadas por "q,r"
 * @param {Set<string>} visited - Set de celdas ya visitadas (clave: "q,r")
 * @returns {Array<Object>} Array de celdas que pertenecen al cluster
 */
function findWaterCluster(startCell, cellMap, visited) {
  const cluster = [];
  const queue = [startCell];
  const startKey = `${startCell.q},${startCell.r}`;
  visited.add(startKey);

  while (queue.length > 0) {
    const cell = queue.shift();
    cluster.push(cell);

    // Explorar los 6 vecinos hexagonales
    const neighbors = getHexNeighbors(cell.q, cell.r);
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.q},${neighbor.r}`;

      // Si el vecino existe, es candidato y no ha sido visitado, agregarlo al cluster
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
 * 
 * RESPONSABILIDAD:
 * - Recorre todas las celdas candidatas a agua
 * - Encuentra clusters conectados usando BFS
 * - Solo marca como agua los clusters que tengan al menos MIN_WATER_CLUSTER celdas
 * - Esto evita que aparezcan "pozos random" individuales
 * 
 * MIN_WATER_CLUSTER:
 * - Define el tamaño mínimo que debe tener un cluster para ser considerado agua
 * - Clusters más pequeños se descartan (no son agua)
 * - Clusters grandes forman lagunas o ríos coherentes
 * - Valor recomendado: 6-10 celdas para lagunas pequeñas, más para ríos
 * 
 * @param {Array<Object>} cells - Array de todas las celdas del terreno
 * @param {number} minClusterSize - Tamaño mínimo del cluster para ser considerado agua
 * @returns {number} Número de clusters de agua encontrados
 */
function detectWaterClusters(cells, minClusterSize = 6) {
  // Crear un Map para acceso rápido a las celdas por coordenadas (q, r)
  const cellMap = new Map();
  for (const cell of cells) {
    const key = `${cell.q},${cell.r}`;
    cellMap.set(key, cell);
  }

  // Set para rastrear celdas ya visitadas durante la búsqueda de clusters
  const visited = new Set();

  // Contador de clusters encontrados
  let clusterCount = 0;
  let totalWaterCells = 0;

  // Recorrer todas las celdas candidatas
  for (const cell of cells) {
    // Solo procesar celdas candidatas que no hayan sido visitadas
    if (cell.candidateWater && !visited.has(`${cell.q},${cell.r}`)) {
      // Encontrar el cluster completo usando BFS
      const cluster = findWaterCluster(cell, cellMap, visited);

      // Solo marcar como agua si el cluster es suficientemente grande
      if (cluster.length >= minClusterSize) {
        clusterCount++;
        totalWaterCells += cluster.length;

        // Marcar todas las celdas del cluster como agua
        for (const clusterCell of cluster) {
          clusterCell.isWater = true;
          // Ajustar altura del agua: usar minHeight directamente o ligeramente por debajo
          // Esto crea una transición más suave con las celdas de tierra adyacentes
          // Usar minHeight - 0.1 en lugar de -0.2 para transición más suave
          clusterCell.waterHeight = clusterCell.biome.minHeight - 0.1;
          // Asignar color de agua (azul claro como en la referencia)
          clusterCell.color = [0.35, 0.45, 0.75]; // WATER_COLOR - azul claro para agua
        }
      } else {
        // Cluster pequeño: no es agua, marcar como falso positivo
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

function hexToPixel3D(q, r, size = HEX_RADIUS_WORLD) {
  const sqrt3 = Math.sqrt(3);
  
  // FÓRMULA ESTÁNDAR PARA HEXÁGONOS "FLAT-TOP"
  // Esta fórmula garantiza un tesselado perfecto donde los hexágonos
  // se tocan exactamente en sus LADOS (no en las puntas) sin huecos ni superposición
  // IMPORTANTE: size debe ser exactamente HEX_RADIUS_WORLD
  // 
  // Para hexágonos flat-top con radio 'size' (centro a vértice):
  // - Ancho (vértice a vértice) = 2 * size
  // - Altura (borde plano a borde plano) = size * sqrt(3)
  // - Apotema (centro a borde plano) = size * sqrt(3) / 2
  //
  // Espaciado entre centros (debe ser igual a la altura para tesselado perfecto):
  // - Horizontal (misma fila): size * 1.5 = 3/4 del ancho
  // - Vertical (filas adyacentes): size * sqrt(3) = altura del hexágono
  //
  // Esta fórmula garantiza que los LADOS de los hexágonos se toquen directamente,
  // creando un mosaico perfecto donde cada lado está en contacto con otro lado.
  const x = size * 1.5 * q;
  const y = 0.0; // Siempre en el plano XZ
  const z = size * sqrt3 * (r + q / 2.0);
  
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
function drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, y, z, height, color, viewMatrix, projectionMatrix, isWater = false, cameraPos = null) {
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
  const alphaLocation = gl.getUniformLocation(program, 'u_alpha'); // Nuevo uniform
  const isWaterLocation = gl.getUniformLocation(program, 'uIsWater');
  const cameraPosLocation = gl.getUniformLocation(program, 'uCameraPosition');

  // Configura las matrices en el shader
  gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
  gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
  gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);

  // Configura el color del hexágono
  gl.uniform3f(colorLocation, color[0], color[1], color[2]);

  // Configura el alpha (opacidad)
  gl.uniform1f(alphaLocation, 1.0); // Por defecto opaco

  // Configura la bandera de agua (1.0 si es agua, 0.0 si es terreno)
  gl.uniform1f(isWaterLocation, isWater ? 1.0 : 0.0);

  // Configura la posición de la cámara (ya se configuró en drawHexGrid, pero lo establecemos aquí también por si se llama directamente)
  // El shader usa uCameraPosition para calcular correctamente el view direction (V)
  if (cameraPosLocation) {
    if (cameraPos) {
      gl.uniform3f(cameraPosLocation, cameraPos[0], cameraPos[1], cameraPos[2]);
    } else {
      // Posición aproximada si no se proporciona
      gl.uniform3f(cameraPosLocation, 5.0, 8.0, 5.0);
    }
  }

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
function drawHexGrid(gl, program, positionBuffer, normalBuffer, canvas, cells, hexRadius, viewMatrix, projectionMatrix, cameraPos = null) {
  // Limpia el canvas con color de fondo oscuro
  // Fondo negro puro estilo Blender
  clearCanvas(gl, 0.0, 0.0, 0.0, 1.0);

  // Activa el programa de shaders (solo una vez para todos los prismas)
  gl.useProgram(program);

  // Si no se proporcionan las matrices, calcularlas automáticamente
  let finalViewMatrix = viewMatrix;
  let finalProjectionMatrix = projectionMatrix;
  let finalCameraPos = cameraPos;

  if (!finalViewMatrix || !finalProjectionMatrix) {
    // Calcula el tamaño del terreno para ajustar la cámara
    const terrainSize = GRID_RADIUS * hexRadius * Math.sqrt(3) * 2;
    // Cámara más cerca del terreno (reducido de 1.2 a 0.85 para acercar la vista)
    const cameraDistance = terrainSize * 0.85;

    const eye = [cameraDistance * 0.7, cameraDistance * 0.8, cameraDistance * 0.7];
    const center = [0, 0, 0];
    const up = [0, 1, 0];

    finalViewMatrix = lookAt(eye, center, up);

    // Si no se proporcionó cameraPos, usar la posición de eye calculada
    if (!finalCameraPos) {
      finalCameraPos = eye;
    }

    const aspect = canvas.width / canvas.height;
    finalProjectionMatrix = perspective(60, aspect, 0.1, 100.0);
  }

  // RENDERIZADO EN DOS PASOS: Primero terreno, luego agua
  // Esto asegura que el agua se renderice encima y tenga el efecto especial

  // Configurar posición de la cámara en el shader (una vez para todos los hexágonos)
  // Esto es necesario para el cálculo correcto del view direction (V) en el efecto especular del agua
  // El shader usa uCameraPosition (no u_cameraPos) para calcular correctamente los reflejos
  const cameraPosLocation = gl.getUniformLocation(program, 'uCameraPosition');
  if (cameraPosLocation) {
    if (finalCameraPos) {
      gl.uniform3f(cameraPosLocation, finalCameraPos[0], finalCameraPos[1], finalCameraPos[2]);
    } else {
      // Si no se proporciona, usar una posición aproximada basada en la configuración típica
      gl.uniform3f(cameraPosLocation, 5.0, 8.0, 5.0);
    }
  }

  // PASO 1: Dibujar todas las celdas de terreno (no agua)
  for (const cell of cells) {
    if (!cell.isWater) {
      // Usar directamente las posiciones almacenadas en la celda
      // cell.worldX y cell.worldZ son el centro exacto del hexágono en el mundo
      const x = cell.worldX;
      const z = cell.worldZ;

      // Dibuja el prisma en esa posición con la altura y color correspondientes
      // isWater = false para aplicar iluminación normal
      drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, 0, z, cell.height, cell.color, finalViewMatrix, finalProjectionMatrix, false, finalCameraPos);
    }
  }

  // PASO 2: Dibujar todas las celdas de agua
  // El agua se renderiza después para que quede encima y tenga el efecto especial
  let waterCellCount = 0;
  for (const cell of cells) {
    if (cell.isWater) {
      waterCellCount++;
      const x = cell.worldX;
      const z = cell.worldZ;

      // Dibuja el prisma de agua con altura plana y color azul
      // isWater = true para activar el material especial de agua en el shader
      // Esto activa el brillo especular y la iluminación especial del agua
      // VERIFICACIÓN: asegurar que isWater=true se está pasando correctamente
      drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, 0, z, cell.height, cell.color, finalViewMatrix, finalProjectionMatrix, true, finalCameraPos);
    }
  }

  const terrainCellCount = cells.length - waterCellCount;
  console.log(`✓ Grilla 3D dibujada: ${terrainCellCount} prismas de terreno + ${waterCellCount} prismas de agua (total: ${cells.length})`);
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
 * @param {number} [alpha=1.0] - Valor de opacidad (0.0 a 1.0)
 */
function drawMesh(gl, program, positionBuffer, normalBuffer, indexBuffer, indexCount, modelMatrix, viewMatrix, projectionMatrix, color, indexOffset = 0, alpha = 1.0) {
  // Calcular la matriz normal (inversa transpuesta de la matriz modelo)
  const normalMatrix = calculateNormalMatrix(modelMatrix);

  // Obtiene las ubicaciones de los uniforms en el shader
  const modelLocation = gl.getUniformLocation(program, 'u_model');
  const viewLocation = gl.getUniformLocation(program, 'u_view');
  const projectionLocation = gl.getUniformLocation(program, 'u_projection');
  const normalMatrixLocation = gl.getUniformLocation(program, 'u_normalMatrix');
  const colorLocation = gl.getUniformLocation(program, 'u_color');
  const alphaLocation = gl.getUniformLocation(program, 'u_alpha'); // Nuevo uniform
  const isWaterLocation = gl.getUniformLocation(program, 'uIsWater');
  const noLightingLocation = gl.getUniformLocation(program, 'uNoLighting');
  
  // Configura las matrices en el shader
  gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
  gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
  gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);

  // Configura el color del objeto
  gl.uniform3f(colorLocation, color[0], color[1], color[2]);

  // Configura el alpha (opacidad)
  gl.uniform1f(alphaLocation, alpha);

  // IMPORTANTE: Establecer uIsWater = 0.0 para objetos que NO son agua
  // Esto asegura que árboles, ovejas y terreno normal no reciban el efecto de agua
  gl.uniform1f(isWaterLocation, 0.0);
  
  // IMPORTANTE: Establecer uNoLighting = 0.0 por defecto (iluminación activa)
  // Se puede cambiar a 1.0 para objetos que no deben tener iluminación (ej: trigo)
  if (noLightingLocation) {
    gl.uniform1f(noLightingLocation, 0.0);
  }
  
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
  // Usar la versión con color personalizado, pasando el color por defecto de Grass
  drawTreeWithColor(gl, program, treeMesh, modelMatrix, viewMatrix, projectionMatrix, TREE_CROWN_COLOR_GRASS);
}

/**
 * Dibuja un árbol completo (tronco + copa) con colores diferentes y color de copa personalizable.
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {WebGLProgram} program - Programa de shaders compilado
 * @param {Object} treeMesh - Mesh del árbol con trunkIndexCount y crownIndexCount
 * @param {Float32Array} modelMatrix - Matriz modelo del árbol
 * @param {Float32Array} viewMatrix - Matriz de vista
 * @param {Float32Array} projectionMatrix - Matriz de proyección
 * @param {number[]} crownColor - Color RGB [r, g, b] para la copa del árbol
 * @param {number} [alpha=1.0] - Valor de opacidad para el árbol (0.0 a 1.0)
 */
function drawTreeWithColor(gl, program, treeMesh, modelMatrix, viewMatrix, projectionMatrix, crownColor, alpha = 1.0) {
  // 1. DIBUJAR SOMBRA (si está disponible en la malla)
  // Dibujar primero y sin escribir en depth buffer para evitar z-fighting con el suelo
  if (treeMesh.shadowIndexCount && treeMesh.shadowIndexCount > 0) {
    gl.depthMask(false); // No escribir en depth buffer

    drawMesh(
      gl, program,
      treeMesh.positionBuffer,
      treeMesh.normalBuffer,
      treeMesh.indexBuffer,
      treeMesh.shadowIndexCount,
      modelMatrix,
      viewMatrix,
      projectionMatrix,
      [0.0, 0.0, 0.0], // Color negro sombra
      treeMesh.shadowIndexOffset * 2, // Offset bytes
      0.4 // Alpha 40% para la sombra
    );

    gl.depthMask(true); // Restaurar escritura
  }

  // 2. DIBUJAR TRONCO (marrón)
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
    0, // Offset: empieza desde el inicio
    alpha
  );

  // 3. DIBUJAR COPA (color personalizado según el bioma)
  drawMesh(
    gl, program,
    treeMesh.positionBuffer,
    treeMesh.normalBuffer,
    treeMesh.indexBuffer,
    treeMesh.crownIndexCount,
    modelMatrix,
    viewMatrix,
    projectionMatrix,
    crownColor,
    treeMesh.crownIndexOffset * 2, // Offset en bytes
    alpha
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
function createTreeInstances(cells, targetBiome = null) {
  // Si no se especifica un bioma, usar el bioma activo
  if (!targetBiome) {
    targetBiome = getActiveBiome();
  }

  const treeInstances = [];
  let biomeCellsCount = 0;

  // Obtener la densidad de árboles del bioma (cada bioma puede tener su propia densidad)
  const treeDensity = targetBiome.treeDensity !== undefined ? targetBiome.treeDensity : TREE_DENSITY;

  // Recorrer todas las celdas del terreno
  for (const cell of cells) {
    // FILTRAR: Solo generar árboles en celdas del bioma objetivo
    // Esto evita generar árboles fuera del bioma o en biomas incorrectos
    if (cell.biome !== targetBiome) {
      continue; // Saltar celdas que no pertenecen al bioma objetivo
    }
    
    // FILTRAR ESPECIAL: No generar árboles en el bioma Wheat
    if (cell.biome.name === "Wheat") {
      continue; // No hay árboles en campos de trigo
    }
    
    // FILTRAR: Saltar celdas de agua (no hay árboles en el agua)
    if (cell.isWater) {
      continue; // Esta celda es agua, no poner árbol
    }

    // FILTRAR ESPECIAL PARA BIOMA ROCK:
    // En el bioma Rock, solo generar árboles en la zona verde (base de la montaña)
    // La zona verde corresponde a heightNorm < 0.2 (primeros 20% de la altura, solo pasto)
    // No generar árboles en roca ni nieve (heightNorm >= 0.2)
    if (cell.biome.name === "Rock") {
      // Si no tiene heightNorm, calcularlo
      if (cell.heightNorm === null || cell.heightNorm === undefined) {
        const heightRange = cell.biome.maxHeight - cell.biome.minHeight || 1.0;
        cell.heightNorm = (cell.height - cell.biome.minHeight) / heightRange;
      }
      // Solo generar árboles en los hexágonos de pasto (zona verde: heightNorm < 0.2)
      if (cell.heightNorm >= 0.2) {
        continue; // Esta celda está en zona rocosa o nevada, no poner árbol
      }
    }

    // FILTRAR ESPECIAL PARA BIOMA CLAY:
    // En el bioma Clay, solo generar árboles en las colinas altas de pasto
    // Las colinas altas corresponden a heightNorm >= 0.8 (últimos 20% de la altura)
    // No generar árboles en roca (70-80%) ni en cobre (0-70%)
    if (cell.biome.name === "Clay") {
      // Si no tiene heightNorm, calcularlo
      if (cell.heightNorm === null || cell.heightNorm === undefined) {
        const heightRange = cell.biome.maxHeight - cell.biome.minHeight || 1.0;
        cell.heightNorm = (cell.height - cell.biome.minHeight) / heightRange;
      }
      // Solo generar árboles en las colinas altas de pasto (heightNorm >= 0.8)
      if (cell.heightNorm < 0.8) {
        continue; // Esta celda está en zona de cobre o roca, no poner árbol
      }
    }

    biomeCellsCount++;

    // EVITAR CONFLICTOS: Saltar celdas que ya tienen una oveja
    // Esto asegura que árboles y ovejas no compartan el mismo hexágono
    if (cell.occupied) {
      continue; // Esta celda ya tiene una oveja, no poner árbol
    }

    // Decidir aleatoriamente si esta celda debe tener un árbol
    // Usar la densidad del bioma (cada bioma puede tener diferente densidad)
    if (Math.random() >= treeDensity) {
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

  const biomeName = targetBiome.name || "Unknown";
  console.log(`✓ ${treeInstances.length} árboles instanciados sobre ${biomeCellsCount} celdas de ${biomeName} (de ${cells.length} totales, densidad: ${(treeDensity * 100).toFixed(1)}%)`);

  return treeInstances;
}

/**
 * Crea instancias de trigo distribuidas aleatoriamente sobre las celdas del bioma Wheat.
 * 
 * RESPONSABILIDAD:
 * - Generar instancias de plantas de trigo (palitos/rectángulos) sobre celdas del bioma Wheat
 * - Filtrar por bioma y excluir celdas de agua
 * - Retornar un array de instancias con sus matrices modelo
 * 
 * FILTRADO POR BIOMA:
 * - Solo genera trigo en celdas que pertenecen al bioma Wheat
 * - No se genera trigo en celdas de agua
 * 
 * POSICIONAMIENTO:
 * - Cada planta de trigo está perfectamente centrada en un hexágono
 * - La posición (x, z) se usa directamente desde cell.worldX y cell.worldZ
 * - La altura en Y se calcula como la altura visual del hexágono (top del hex)
 * - El trigo tiene su base en y=0 (en su sistema local)
 * - Se traslada a y = visualHeight para que la base quede sobre la tapa del hexágono
 * 
 * @param {Array} cells - Array de celdas con formato { q, r, worldX, worldZ, height, color, biome }
 * @param {Object} targetBiome - Bioma objetivo para generar trigo (por defecto wheatBiome)
 * @returns {Array<{modelMatrix: Float32Array}>} Array de instancias de trigo
 */
function createWheatInstances(cells, targetBiome = null) {
  // Si no se especifica un bioma, usar el bioma activo
  if (!targetBiome) {
    targetBiome = getActiveBiome();
  }
  
  const wheatInstances = [];
  let biomeCellsCount = 0;
  
  // Obtener la densidad de trigo del bioma
  const wheatDensity = targetBiome.wheatDensity !== undefined ? targetBiome.wheatDensity : 0.85;
  
  // Recorrer todas las celdas del terreno
  for (const cell of cells) {
    // FILTRAR: Solo generar trigo en celdas del bioma Wheat
    if (cell.biome !== targetBiome || cell.biome.name !== "Wheat") {
      continue;
    }
    
    // FILTRAR: Saltar celdas de agua (no hay trigo en el agua)
    if (cell.isWater) {
      continue;
    }
    
    biomeCellsCount++;
    
    // Decidir aleatoriamente si esta celda debe tener trigo
    if (Math.random() >= wheatDensity) {
      continue;
    }
    
    // MARCADO DE CELDA OCUPADA: Marcar esta celda como ocupada por trigo
    cell.occupied = true;
    
    // Posición: usar EXACTAMENTE los mismos datos que usan los hexágonos
    const HEX_BASE_HEIGHT = 0.5;
    const posX = cell.worldX;
    const posZ = cell.worldZ;
    const visualHeight = cell.height * HEIGHT_UNIT;
    const actualHexHeight = HEX_BASE_HEIGHT * visualHeight;
    const posY = actualHexHeight; // Trigo sobre la tapa del hexágono
    
    // Validar que la altura sea válida
    if (posY <= 0) {
      continue;
    }
    
    // Sin rotación ni escala (el trigo es un conjunto de palitos, no necesita variación)
    const rotationY = 0;
    const scale = 1.0;
    
    // Construir matriz modelo (igual que árboles)
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
 * Crea instancias de ovejas distribuidas aleatoriamente sobre las celdas del bioma Grass.
 * 
 * @param {Array} cells - Array de celdas con formato { q, r, worldX, worldZ, height, color, biome }
 * @param {Object} targetBiome - Bioma objetivo para generar ovejas (por defecto grassBiome)
 * @returns {Array<{modelMatrix: Float32Array}>} Array de instancias de ovejas
 */
function createSheepInstances(cells, targetBiome = null) {
  // Si no se especifica un bioma, usar el bioma activo
  if (!targetBiome) {
    targetBiome = getActiveBiome();
  }

  const sheepInstances = [];
  let validCells = 0;
  let skippedBorder = 0;
  let skippedNoHeight = 0;

  // Obtener la densidad de ovejas del bioma (cada bioma puede tener su propia densidad)
  const sheepDensity = targetBiome.sheepDensity !== undefined ? targetBiome.sheepDensity : SHEEP_DENSITY;

  // MARGEN DE SEGURIDAD: Excluir celdas muy cerca del borde para evitar ovejas fuera del terreno
  // El modelo de oveja puede extenderse un poco fuera del hexágono, así que dejamos un margen
  const SAFE_MARGIN = 1; // Excluir celdas a menos de 1 unidad del borde

  for (const cell of cells) {
    // Solo generar ovejas en celdas del bioma objetivo
    if (cell.biome !== targetBiome) {
      continue;
    }

    // FILTRAR: Saltar celdas de agua (no hay ovejas en el agua)
    if (cell.isWater) {
      continue; // Esta celda es agua, no poner oveja
    }

    // FILTRAR: No generar ovejas en celdas ya ocupadas por árboles
    if (cell.occupied) {
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
    // Usar la densidad del bioma (cada bioma puede tener diferente densidad)
    if (Math.random() >= sheepDensity) {
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

  const biomeName = targetBiome.name || "Unknown";
  console.log(`✓ ${sheepInstances.length} ovejas instanciadas sobre ${validCells} celdas válidas de ${biomeName} (densidad: ${(sheepDensity * 100).toFixed(1)}%)`);
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

  // Configuraciones globales de WebGL
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE); // Opcional: mejora rendimiento no dibujando caras traseras

  // Habilitar mezcla (blending) para transparencias (sombras, agua futura)
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Color de fondo (cielo)
  gl.clearColor(0.53, 0.81, 0.92, 1.0); // Azul cielo suave

  // Paso 2: Crear programa de shaders (función de render/gl.js)
  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    console.error('Error: No se pudo crear el programa de shaders');
    return;
  }
  
  // Paso 3: Inicializar generador de ruido compartido (para modo board)
  // En modo singleBiome, cada createCells crea su propio generador
  // En modo board, todos los tiles comparten el mismo generador para coherencia
  let sharedNoiseGenerator = null;
  
  // Crear generador de ruido compartido (reutiliza lógica de createCells)
  try {
    let noise2D = null;
    let SimplexNoiseModule = null;
    
    if (typeof window !== 'undefined' && window.SimplexNoise) {
      SimplexNoiseModule = window.SimplexNoise;
    } else if (typeof SimplexNoise !== 'undefined') {
      SimplexNoiseModule = SimplexNoise;
    } else if (typeof window !== 'undefined' && typeof window.createNoise2D === 'function') {
      noise2D = window.createNoise2D();
    }
    
    if (SimplexNoiseModule && !noise2D) {
      if (typeof SimplexNoiseModule.createNoise2D === 'function') {
        noise2D = SimplexNoiseModule.createNoise2D();
      } else if (typeof SimplexNoiseModule === 'function') {
        const simplex = new SimplexNoiseModule();
        noise2D = simplex.noise2D.bind(simplex);
      }
    }
    
    if (noise2D && typeof noise2D === 'function') {
      sharedNoiseGenerator = { noise2D: noise2D };
      console.log('✓ Generador de ruido compartido inicializado');
    }
  } catch (error) {
    console.warn('⚠ No se pudo crear generador de ruido compartido, cada tile creará el suyo');
  }
  
  // Paso 4: Seleccionar modo de visualización
  let cells, treeInstances, sheepInstances, wheatInstances, activeBiome;
  let board = null; // Solo se usa en modo board
  
  if (VIEW_MODE === "board") {
    // MODO TABLERO: Crear múltiples tiles con diferentes biomas
    console.log(`✓ Modo: Tablero (${BOARD_WIDTH}×${BOARD_HEIGHT} tiles)`);
    
    // Crear el tablero
    board = createBoard(BOARD_WIDTH, BOARD_HEIGHT, sharedNoiseGenerator);
    
    // Generar todos los tiles del tablero
    board.generate();
    
    // Obtener todas las celdas y objetos de todos los tiles
    cells = board.getAllCells();
    const allObjects = board.getAllObjectInstances();
    treeInstances = allObjects.treeInstances;
    sheepInstances = allObjects.sheepInstances;
    wheatInstances = allObjects.wheatInstances;
    
    // Para el título, usar "Board" o el bioma más común
    activeBiome = { name: "Board" };
    
    console.log(`✓ Tablero generado: ${cells.length} celdas totales, ${treeInstances.length} árboles, ${sheepInstances.length} ovejas, ${wheatInstances.length} trigo`);
  } else {
    // MODO BIOMA ÚNICO: Lógica existente (un solo tile)
    console.log(`✓ Modo: Bioma Único`);
    
    activeBiome = getActiveBiome();
    console.log(`✓ Bioma activo: ${activeBiome.name || "Unknown"}`);
    
    // Crear estructura de celdas usando los parámetros del bioma activo
    // Cada celda tiene { q, r, height, color, biome, isWater, ... }
    // - height: generado entre minHeight y maxHeight del bioma usando ruido
    // - color: generado desde baseColor con variación colorVariance (función específica del bioma)
    // - isWater: marcado por computeColor si la celda es agua (opcional, solo Forest por ahora)
    // Genera un terreno hexagonal completo con radio GRID_RADIUS
    cells = createCells(activeBiome, sharedNoiseGenerator);
    
    // Crear instancias de objetos (solo en modo singleBiome, en modo board ya están creadas)
    treeInstances = createTreeInstances(cells, activeBiome);
    wheatInstances = createWheatInstances(cells, activeBiome);
    sheepInstances = createSheepInstances(cells, activeBiome);
  }
  
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
  
  // Paso 7b: Crear mesh de trigo programáticamente
  // El trigo se genera en código (sin modelos externos)
  // Está compuesto por múltiples palitos/rectángulos de diferentes alturas
  const wheatMesh = createWheatMesh(gl, HEX_RADIUS_WORLD, 60); // 60 palitos por hexágono (muy denso, como imagen)
  
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
  
  
  // Paso 11: Ajustar tamaño del canvas a pantalla completa
  // El canvas debe usar toda la ventana del navegador
  function resizeCanvas() {
    webgl.canvas.width = window.innerWidth;
    webgl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, webgl.canvas.width, webgl.canvas.height);
    // Recalcular la matriz de proyección con el nuevo aspect ratio
    const newAspect = webgl.canvas.width / webgl.canvas.height;
    return perspective(60, newAspect, 0.1, 100.0);
  }
  resizeCanvas(); // Ajustar tamaño inicial

  // Actualizar el título de la pestaña del navegador con el nombre del bioma activo
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    pageTitle.textContent = activeBiome.name || 'Bioma';
  }
  
  // Actualizar el título visible en pantalla
  // IMPORTANTE: En Board Mode, NO mostrar ningún texto en pantalla (pantalla limpia)
  const biomeTitle = document.getElementById('biomeTitle');
  if (biomeTitle) {
    if (VIEW_MODE === "board") {
      // En Board Mode: ocultar el título completamente
      biomeTitle.style.display = 'none';
    } else {
      // En Single Biome: mostrar el título normalmente
      biomeTitle.style.display = 'block';
      biomeTitle.textContent = (activeBiome.name || 'Bioma') + ' Biome';
    }
  }

  // Paso 12: Preparar matrices de vista y proyección (compartidas para terreno, árboles y ovejas)
  // Estas matrices se calculan una vez y se usan para todos los objetos
  
  // ============================================================
  // CONFIGURACIÓN DE CÁMARA
  // ============================================================
  
  let terrainSize;
  let cameraEye, cameraCenter, cameraUp;
  
  if (VIEW_MODE === "board") {
    // MODO BOARD: Cámara para explorar el tablero completo
    // Calcular tamaño del tablero usando el mismo sistema que board.js
    // board.getBoardSize() retorna { width, height } basado en el radio hexagonal
    const boardSize = board ? board.getBoardSize() : { 
      // Fallback: calcular tamaño exacto del tablero hexagonal 5×5 (radio 2)
      // Distancia del centro al borde más lejano: BOARD_RADIUS * tileSpacing + tileApothem
      // donde tileSpacing = 2 * tileApothem y tileApothem = (GRID_RADIUS + 0.5) * HEX_RADIUS_WORLD * sqrt(3)
      width: (() => {
        const sqrt3 = Math.sqrt(3);
        const BOARD_RADIUS = 2;
        const tileApothem = (GRID_RADIUS + 0.5) * HEX_RADIUS_WORLD * sqrt3;
        const tileSpacing = tileApothem * 2;
        const halfExtent = BOARD_RADIUS * tileSpacing + tileApothem;
        return halfExtent * 2;
      })(),
      height: (() => {
        const sqrt3 = Math.sqrt(3);
        const BOARD_RADIUS = 2;
        const tileApothem = (GRID_RADIUS + 0.5) * HEX_RADIUS_WORLD * sqrt3;
        const tileSpacing = tileApothem * 2;
        const halfExtent = BOARD_RADIUS * tileSpacing + tileApothem;
        return halfExtent * 2;
      })()
    };
    terrainSize = Math.max(boardSize.width, boardSize.height) + GRID_RADIUS * HEX_RADIUS_WORLD * 2;
    
    // Posición inicial de la cámara: más alta y más alejada para ver todo el tablero
    const cameraDistance = terrainSize * 1.2; // Más alejada que en single biome
    cameraEye = [cameraDistance * 0.6, cameraDistance * 1.0, cameraDistance * 0.6];
    cameraCenter = [0, 0, 0]; // Centro del tablero
    cameraUp = [0, 1, 0];
  } else {
    // MODO SINGLE BIOME: Cámara fija como antes (sin cambios)
    terrainSize = GRID_RADIUS * HEX_RADIUS_WORLD * Math.sqrt(3) * 2;
    const cameraDistance = terrainSize * 0.85;
    cameraEye = [cameraDistance * 0.7, cameraDistance * 0.8, cameraDistance * 0.7];
    cameraCenter = [0, 0, 0];
    cameraUp = [0, 1, 0];
  }
  
  // Estado de la cámara para Board Mode (se actualiza con controles)
  let currentCameraEye = [...cameraEye];
  let currentCameraCenter = [...cameraCenter];
  
  const aspect = webgl.canvas.width / webgl.canvas.height;
  let viewMatrix = lookAt(currentCameraEye, currentCameraCenter, cameraUp);
  let projectionMatrix = perspective(60, aspect, 0.1, 100.0);
  
  // ============================================================
  // CONTROLES DE CÁMARA PARA BOARD MODE
  // ============================================================
  // En Board Mode, permite mover la cámara con teclado para explorar el tablero
  // 
  // CONTROLES:
  // - W / Flecha Arriba: Mover cámara hacia adelante (en dirección de visión)
  // - S / Flecha Abajo: Mover cámara hacia atrás
  // - A / Flecha Izquierda: Mover cámara hacia la izquierda
  // - D / Flecha Derecha: Mover cámara hacia la derecha
  // - Q: Mover cámara hacia arriba (elevar)
  // - E: Mover cámara hacia abajo (bajar)
  // - R: Resetear posición de cámara a la inicial
  // 
  // VELOCIDAD: Se puede ajustar cambiando CAMERA_MOVE_SPEED
  // SENSIBILIDAD: Se puede ajustar cambiando CAMERA_ROTATE_SPEED (si se agrega rotación)
  
  if (VIEW_MODE === "board") {
    // ============================================================
    // CONFIGURACIÓN DE CONTROLES DE CÁMARA PARA BOARD MODE
    // ============================================================
    // 
    // CONTROLES DE MOVIMIENTO:
    // - W / Flecha Arriba: Mover cámara hacia adelante (en dirección de visión)
    // - S / Flecha Abajo: Mover cámara hacia atrás
    // - A / Flecha Izquierda: Mover cámara hacia la izquierda
    // - D / Flecha Derecha: Mover cámara hacia la derecha
    // - Q: Mover cámara hacia arriba (elevar)
    // - E: Mover cámara hacia abajo (bajar)
    // - R: Resetear posición de cámara a la inicial
    // 
    // CONTROLES DE ZOOM:
    // - Rueda del mouse hacia arriba: Acercar (zoom in)
    // - Rueda del mouse hacia abajo: Alejar (zoom out)
    // - Teclas + / -: Alternativa para zoom in/out
    // 
    // PARÁMETROS AJUSTABLES:
    // - CAMERA_MOVE_SPEED: Velocidad de movimiento en X/Z/Y (unidades por frame)
    // - CAMERA_ZOOM_SPEED: Velocidad de zoom (factor de multiplicación/división)
    // - CAMERA_ZOOM_MIN: Distancia mínima al centro (no se puede acercar más)
    // - CAMERA_ZOOM_MAX: Distancia máxima al centro (no se puede alejar más)
    
    const CAMERA_MOVE_SPEED = 0.5; // Velocidad de movimiento (unidades por frame)
    const CAMERA_ZOOM_SPEED = 0.1; // Velocidad de zoom (10% por paso de rueda)
    const CAMERA_ZOOM_MIN = 2.0;   // Distancia mínima al centro (muy cerca)
    const CAMERA_ZOOM_MAX = 200.0; // Distancia máxima al centro (muy lejos)
    
    const keysPressed = {}; // Estado de teclas presionadas
    
    // Detectar teclas presionadas
    window.addEventListener('keydown', (e) => {
      keysPressed[e.key.toLowerCase()] = true;
      keysPressed[e.code] = true; // Para Arrow keys
      // Prevenir scroll cuando se presionan teclas de zoom
      if (e.key === '+' || e.key === '-' || e.key === '=') {
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      keysPressed[e.key.toLowerCase()] = false;
      keysPressed[e.code] = false;
    });
    
    // Detectar rueda del mouse para zoom
    webgl.canvas.addEventListener('wheel', (e) => {
      e.preventDefault(); // Prevenir scroll de página
      
      // Calcular dirección de vista (de eye hacia center)
      const viewDir = [
        currentCameraCenter[0] - currentCameraEye[0],
        currentCameraCenter[1] - currentCameraEye[1],
        currentCameraCenter[2] - currentCameraEye[2]
      ];
      
      // Calcular distancia actual
      const currentDistance = Math.sqrt(
        viewDir[0] * viewDir[0] + 
        viewDir[1] * viewDir[1] + 
        viewDir[2] * viewDir[2]
      );
      
      // Normalizar dirección
      const viewDirNorm = [
        viewDir[0] / currentDistance,
        viewDir[1] / currentDistance,
        viewDir[2] / currentDistance
      ];
      
      // Calcular nueva distancia según scroll
      // deltaY > 0 = scroll hacia abajo = alejar
      // deltaY < 0 = scroll hacia arriba = acercar
      let newDistance = currentDistance;
      if (e.deltaY > 0) {
        // Alejar: aumentar distancia
        newDistance = currentDistance * (1.0 + CAMERA_ZOOM_SPEED);
      } else {
        // Acercar: disminuir distancia
        newDistance = currentDistance * (1.0 - CAMERA_ZOOM_SPEED);
      }
      
      // Limitar distancia a los rangos permitidos
      newDistance = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, newDistance));
      
      // Mover eye hacia/desde center manteniendo center fijo
      currentCameraEye[0] = currentCameraCenter[0] - viewDirNorm[0] * newDistance;
      currentCameraEye[1] = currentCameraCenter[1] - viewDirNorm[1] * newDistance;
      currentCameraEye[2] = currentCameraCenter[2] - viewDirNorm[2] * newDistance;
      
      // Actualizar vista y renderizar
      viewMatrix = lookAt(currentCameraEye, currentCameraCenter, cameraUp);
      renderScene();
    }, { passive: false }); // passive: false para poder prevenir default
    
    // Función para actualizar la cámara según las teclas presionadas
    function updateCamera() {
      let moved = false;
      const forward = [currentCameraCenter[0] - currentCameraEye[0], 0, currentCameraCenter[2] - currentCameraEye[2]];
      const forwardLength = Math.sqrt(forward[0] * forward[0] + forward[2] * forward[2]);
      if (forwardLength > 0.001) {
        forward[0] /= forwardLength;
        forward[2] /= forwardLength;
      }
      
      // Calcular dirección derecha (perpendicular a forward)
      const right = [-forward[2], 0, forward[0]];
      
      // Movimiento hacia adelante/atrás
      if (keysPressed['w'] || keysPressed['arrowup']) {
        currentCameraEye[0] += forward[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] += forward[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] += forward[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] += forward[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      if (keysPressed['s'] || keysPressed['arrowdown']) {
        currentCameraEye[0] -= forward[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] -= forward[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] -= forward[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] -= forward[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      
      // Movimiento lateral
      if (keysPressed['a'] || keysPressed['arrowleft']) {
        currentCameraEye[0] -= right[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] -= right[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] -= right[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] -= right[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      if (keysPressed['d'] || keysPressed['arrowright']) {
        currentCameraEye[0] += right[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] += right[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] += right[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] += right[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      
      // Movimiento vertical
      if (keysPressed['q']) {
        currentCameraEye[1] += CAMERA_MOVE_SPEED;
        currentCameraCenter[1] += CAMERA_MOVE_SPEED;
        moved = true;
      }
      if (keysPressed['e']) {
        currentCameraEye[1] -= CAMERA_MOVE_SPEED;
        currentCameraCenter[1] -= CAMERA_MOVE_SPEED;
        moved = true;
      }
      
      // Zoom con teclado (+ / -)
      if (keysPressed['+'] || keysPressed['=']) {
        // Acercar: disminuir distancia
        const viewDir = [
          currentCameraCenter[0] - currentCameraEye[0],
          currentCameraCenter[1] - currentCameraEye[1],
          currentCameraCenter[2] - currentCameraEye[2]
        ];
        const currentDistance = Math.sqrt(viewDir[0] * viewDir[0] + viewDir[1] * viewDir[1] + viewDir[2] * viewDir[2]);
        const viewDirNorm = [
          viewDir[0] / currentDistance,
          viewDir[1] / currentDistance,
          viewDir[2] / currentDistance
        ];
        const newDistance = Math.max(CAMERA_ZOOM_MIN, currentDistance * (1.0 - CAMERA_ZOOM_SPEED));
        currentCameraEye[0] = currentCameraCenter[0] - viewDirNorm[0] * newDistance;
        currentCameraEye[1] = currentCameraCenter[1] - viewDirNorm[1] * newDistance;
        currentCameraEye[2] = currentCameraCenter[2] - viewDirNorm[2] * newDistance;
        moved = true;
      }
      if (keysPressed['-'] || keysPressed['_']) {
        // Alejar: aumentar distancia
        const viewDir = [
          currentCameraCenter[0] - currentCameraEye[0],
          currentCameraCenter[1] - currentCameraEye[1],
          currentCameraCenter[2] - currentCameraEye[2]
        ];
        const currentDistance = Math.sqrt(viewDir[0] * viewDir[0] + viewDir[1] * viewDir[1] + viewDir[2] * viewDir[2]);
        const viewDirNorm = [
          viewDir[0] / currentDistance,
          viewDir[1] / currentDistance,
          viewDir[2] / currentDistance
        ];
        const newDistance = Math.min(CAMERA_ZOOM_MAX, currentDistance * (1.0 + CAMERA_ZOOM_SPEED));
        currentCameraEye[0] = currentCameraCenter[0] - viewDirNorm[0] * newDistance;
        currentCameraEye[1] = currentCameraCenter[1] - viewDirNorm[1] * newDistance;
        currentCameraEye[2] = currentCameraCenter[2] - viewDirNorm[2] * newDistance;
        moved = true;
      }
      
      // Resetear cámara
      if (keysPressed['r']) {
        currentCameraEye = [...cameraEye];
        currentCameraCenter = [...cameraCenter];
        moved = true;
        keysPressed['r'] = false; // Evitar reset continuo
      }
      
      if (moved) {
        viewMatrix = lookAt(currentCameraEye, currentCameraCenter, cameraUp);
        renderScene();
      }
    }
    
    // Actualizar cámara cada frame (usando requestAnimationFrame)
    function cameraUpdateLoop() {
      updateCamera();
      requestAnimationFrame(cameraUpdateLoop);
    }
    cameraUpdateLoop();
    
    console.log('✓ Controles de cámara activados para Board Mode');
    console.log('  W/S/Arrows: Mover | Q/E: Elevar/Bajar | Rueda mouse/+/−: Zoom | R: Reset');
  }
  
  // Función para redibujar la escena (se llama cuando cambia el tamaño de la ventana)
  function renderScene() {
    // Actualizar matriz de proyección con el nuevo aspect ratio
    projectionMatrix = resizeCanvas();

    // Redibujar toda la escena
    // En Board Mode, usar currentCameraEye; en Single Biome, usar eye original
    const cameraPosForShader = VIEW_MODE === "board" ? currentCameraEye : currentCameraEye;
    drawHexGrid(gl, program, positionBuffer, normalBuffer, webgl.canvas, cells, HEX_RADIUS_WORLD, viewMatrix, projectionMatrix, cameraPosForShader);
    
    // Dibujar árboles
    if (treeInstances.length > 0) {
      // En Board Mode, los árboles pueden pertenecer a diferentes biomas
      // Usamos un color por defecto (Grass) ya que es el más común
      // En Single Biome, usamos el color del bioma activo
      const treeCrownColor = (VIEW_MODE === "board" || activeBiome.name === "Forest") ? 
        (activeBiome.name === "Forest" ? TREE_CROWN_COLOR_FOREST : TREE_CROWN_COLOR_GRASS) : 
        TREE_CROWN_COLOR_GRASS;
      for (const tree of treeInstances) {
        drawTreeWithColor(gl, program, treeMesh, tree.modelMatrix, viewMatrix, projectionMatrix, treeCrownColor);
      }
    }
    
    // Dibujar trigo (bioma Wheat)
    if (wheatMesh && wheatInstances.length > 0) {
      // Color uniforme para todos los palitos de trigo (amarillo dorado brillante, como imagen)
      // Todos los palitos de todas las instancias usan exactamente el mismo color
      const WHEAT_COLOR = [0.95, 0.82, 0.22]; // Amarillo/dorado brillante uniforme (más dorado, como imagen)
      
      // Configurar uniform para desactivar iluminación en el trigo
      // Esto hace que todos los palitos tengan exactamente el mismo color sin variación
      const noLightingLocation = gl.getUniformLocation(program, 'uNoLighting');
      if (noLightingLocation) {
        gl.uniform1f(noLightingLocation, 1.0); // Desactivar iluminación para trigo
      }
      
      for (const wheat of wheatInstances) {
        // El trigo se dibuja como un mesh simple con un solo color uniforme
        // Todos los palitos tienen exactamente el mismo color (sin variación por iluminación)
        drawMesh(
          gl, program,
          wheatMesh.positionBuffer,
          wheatMesh.normalBuffer,
          wheatMesh.indexBuffer,
          wheatMesh.indexCount,
          wheat.modelMatrix,
          viewMatrix,
          projectionMatrix,
          WHEAT_COLOR // Color fijo e idéntico para todas las instancias y todos los palitos
        );
      }
      
      // Restaurar iluminación para otros objetos
      if (noLightingLocation) {
        gl.uniform1f(noLightingLocation, 0.0);
      }
    }
    
    // Dibujar ovejas
    if (sheepMesh && sheepInstances.length > 0) {
      for (const sheep of sheepInstances) {
        drawMesh(gl, program, sheepMesh.white.positionBuffer, sheepMesh.white.normalBuffer, sheepMesh.white.indexBuffer, sheepMesh.white.indexCount, sheep.modelMatrix, viewMatrix, projectionMatrix, [0.95, 0.95, 0.95], 0, false);
        drawMesh(gl, program, sheepMesh.black.positionBuffer, sheepMesh.black.normalBuffer, sheepMesh.black.indexBuffer, sheepMesh.black.indexCount, sheep.modelMatrix, viewMatrix, projectionMatrix, [0.2, 0.2, 0.2], 0, false);
      }
    }
  }

  // Agregar listener para redimensionar la ventana
  window.addEventListener('resize', renderScene);

  // Paso 13: Renderizar la escena inicial (terreno + árboles + ovejas)
  // renderScene() dibuja todo: terreno, árboles y ovejas con las matrices correctas
  renderScene();

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
