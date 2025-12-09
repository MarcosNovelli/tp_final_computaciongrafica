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
 * Aplica variación aleatoria sutil y ajusta el brillo según la altura.
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
  name: "Grass",
  baseColor: [0.408, 0.62, 0.223],
  minHeight: 1,
  maxHeight: 5,
  colorVariance: 0.05,
  colorVariationProbability: 0.4,
  treeDensity: 0.08,
  sheepDensity: 0.06,
  computeColor: computeGrassColor
};

