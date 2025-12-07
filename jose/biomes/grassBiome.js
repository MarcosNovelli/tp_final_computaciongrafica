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
  // Genera valores aleatorios entre -colorVariance y +colorVariance
  const dr = randomInRange(-biome.colorVariance, biome.colorVariance);
  const dg = randomInRange(-biome.colorVariance, biome.colorVariance);
  const db = randomInRange(-biome.colorVariance, biome.colorVariance);
  
  // Suma la variación al color base
  let rr = r + dr;
  let gg = g + dg;
  let bb = b + db;
  
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
  baseColor: [0.5, 0.8, 0.3],     // Verde más brillante/lime green como en la imagen de referencia
  minHeight: 1,                    // Altura mínima
  maxHeight: 3,                    // Altura máxima
  colorVariance: 0.08,             // Variación de color un poco más visible
  computeColor: computeGrassColor  // Función específica para calcular colores
};

