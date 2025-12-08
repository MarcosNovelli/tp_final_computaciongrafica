/**
 * ============================================================
 * biomes/grassBiome.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define el bioma Grass (pasto/hierba) con toda su
 * configuración y lógica de colorización específica.
 * 
 * Contiene:
 * - Configuración del bioma (baseColor, minHeight, maxHeight, colorVariance)
 * - Función para calcular colores específica del bioma Grass
 * - Lógica de variación y ajuste por altura
 * 
 * DEPENDENCIAS:
 * - Requiere que randomInRange() y clamp01() estén disponibles globalmente
 *   (definidas en main.js)
 */

/**
 * Calcula el color de una celda del bioma Grass con variación y ajuste por altura.
 * 
 * RESPONSABILIDAD:
 * - Generar un color para una celda del bioma Grass
 * - Aplicar variación aleatoria sutil usando colorVariance
 * - Ajustar el brillo según la altura (celdas más altas = más claras)
 * - Asegurar que los valores finales estén en el rango [0.0, 1.0]
 * 
 * COLOR BASE (baseColor):
 * - Representa el color RGB principal del bioma Grass
 * - Es el color de referencia del que parten todas las variaciones
 * - Ejemplo: [0.33, 0.61, 0.23] = verde principal suave estilo low-poly
 * 
 * VARIACIÓN DE COLOR (colorVariance):
 * - Controla cuánto puede variar cada componente RGB del color base
 * - Valores pequeños (ej: 0.05) = variación sutil, colores más consistentes
 * - Valores grandes (ej: 0.2) = variación más pronunciada, colores más diversos
 * - Para cada componente (R, G, B), se suma un valor aleatorio entre -colorVariance y +colorVariance
 * - Esto crea pequeñas variaciones entre celdas adyacentes, simulando variaciones naturales
 * 
 * PROBABILIDAD DE VARIACIÓN (colorVariationProbability):
 * - Controla con qué frecuencia se aplica la variación de color
 * - Valores entre 0.0 y 1.0:
 *   - 0.0 = ninguna celda varía (todas usan color base)
 *   - 1.0 = todas las celdas varían (comportamiento actual)
 *   - 0.3 = solo 30% de las celdas tienen variación, 70% usan color base
 * - Esto permite controlar la "frecuencia" de variación independientemente de la "cantidad"
 * 
 * AJUSTE POR ALTURA:
 * - Celdas más altas se hacen un poco más claras (mayor brillo)
 * - Esto simula que áreas elevadas reciben más luz o tienen diferentes tipos de vegetación
 * - La altura se normaliza del rango [minHeight, maxHeight] a [0, 1]
 * - Se aplica un factor de brillo: 1.0 + normalizedHeight * 0.06
 * - Esto significa que celdas en la altura máxima serán hasta 6% más claras
 * - El ajuste es sutil para mantener el estilo low-poly suave
 * 
 * @param {number} height - Altura de la celda (entero entre minHeight y maxHeight)
 * @param {Object} biome - Objeto bioma con { baseColor, minHeight, maxHeight, colorVariance }
 * @returns {number[]} Color RGB [r, g, b] con variación y ajuste por altura
 */
function computeGrassColor(height, biome) {
  // Extrae el color base del bioma
  const [r, g, b] = biome.baseColor;
  
  // PASO 1: Aplicar variación aleatoria por canal usando colorVariance
  // PERO solo si pasa la probabilidad de variación (para controlar frecuencia)
  let rr = r;
  let gg = g;
  let bb = b;
  
  // Solo aplicar variación si pasa la probabilidad
  const variationProbability = biome.colorVariationProbability !== undefined ? biome.colorVariationProbability : 1.0;
  if (Math.random() < variationProbability) {
    // Genera valores aleatorios entre -colorVariance y +colorVariance
    const dr = randomInRange(-biome.colorVariance, biome.colorVariance);
    const dg = randomInRange(-biome.colorVariance, biome.colorVariance);
    const db = randomInRange(-biome.colorVariance, biome.colorVariance);
    
    // Suma la variación al color base
    rr = r + dr;
    gg = g + dg;
    bb = b + db;
  }
  // Si no pasa la probabilidad, rr, gg, bb ya tienen el color base sin variación
  
  // PASO 2: Aplicar ajuste de brillo según la altura
  // Normaliza la altura del rango [minHeight, maxHeight] a [0, 1]
  const heightRange = biome.maxHeight - biome.minHeight || 1.0;
  const normalizedHeight = (height - biome.minHeight) / heightRange; // 0..1
  
  // Calcula el factor de brillo: celdas más altas son hasta 6% más claras
  // brightness va de 1.0 (altura mínima) a 1.06 (altura máxima)
  const brightness = 1.0 + normalizedHeight * 0.06;
  
  // Aplica el factor de brillo multiplicando cada componente
  rr *= brightness;
  gg *= brightness;
  bb *= brightness;
  
  // PASO 3: Clamp de los valores a [0, 1] antes de devolverlos
  // Asegura que los valores RGB estén en el rango válido para WebGL
  rr = clamp01(rr);
  gg = clamp01(gg);
  bb = clamp01(bb);
  
  return [rr, gg, bb];
}

/**
 * Bioma de Pasto (Grass)
 * 
 * Características:
 * - Color verde principal suave estilo low-poly
 * - Alturas moderadas (1 a 3) para terreno de pradera
 * - Variación de color sutil con ajuste de brillo por altura
 * - Áreas más altas se ven ligeramente más claras
 */
const grassBiome = {
  name: "Grass",                             // Nombre del bioma (para identificación)
  baseColor: [0.408, 0.62, 0.223],              // Verde más brillante/lime green como en la imagen de referencia
  minHeight: 1,                             // Altura mínima
  maxHeight: 5,                             // Altura máxima
  colorVariance: 0.05,                      // Cantidad de variación cuando se aplica (cuánto varía)
  colorVariationProbability: 0.4,           // Probabilidad de que una celda tenga variación (0.0 a 1.0)
  // 0.5 = 50% de las celdas tendrán variación, 50% usarán color base puro
  // 1.0 = todas las celdas varían (comportamiento anterior)
  // 0.3 = solo 30% varían, 70% usan color base
  computeColor: computeGrassColor           // Función específica para calcular colores
};

