/**
 * ============================================================
 * biomes/forestBiome.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define el bioma Forest (bosque) con toda su
 * configuración y lógica de colorización específica.
 * 
 * Contiene:
 * - Configuración del bioma (baseColor, minHeight, maxHeight, colorVariance)
 * - Función para calcular colores específica del bioma Forest
 * - Lógica de variación y ajuste por altura
 * - Soporte para zonas de agua en áreas bajas
 * 
 * DEPENDENCIAS:
 * - Requiere que randomInRange() y clamp01() estén disponibles globalmente
 *   (definidas en main.js)
 */

/**
 * Calcula el color de una celda del bioma Forest con variación y ajuste por altura.
 * Aplica variación aleatoria sutil, ajusta el brillo según la altura y detecta zonas de agua.
 */
function computeForestColor(height, biome, cell = null) {
  // Normaliza la altura del rango [minHeight, maxHeight] a [0, 1]
  const heightRange = biome.maxHeight - biome.minHeight || 1.0;
  const normalizedHeight = (height - biome.minHeight) / heightRange; // 0..1
  
  // MARCAR CANDIDATOS DE AGUA: En lugar de marcar directamente como agua,
  // marcamos como "candidato" si la altura está en el rango bajo
  // La decisión final de si es agua se tomará después mediante detección de clusters
  // Esto evita que aparezcan "pozos random" de agua individual
  const WATER_CANDIDATE_THRESHOLD = 0.18; // 18% del rango de altura = candidato a agua
  
  // Marcar como candidato si la altura normalizada está en el rango bajo
  if (cell && normalizedHeight < WATER_CANDIDATE_THRESHOLD) {
    cell.candidateWater = true;
    cell.isWater = false; // Se decidirá después mediante clusters
  } else if (cell) {
    cell.candidateWater = false;
    cell.isWater = false;
  }
  
  // Si no es agua, continuar con el color normal del suelo
  
  // Extrae el color base del bioma
  const [r, g, b] = biome.baseColor;
  
  // PASO 1: Aplicar variación aleatoria por canal usando colorVariance
  const variationProbability = biome.colorVariationProbability !== undefined ? biome.colorVariationProbability : 1.0;
  let rr = r;
  let gg = g;
  let bb = b;
  
  // Solo aplicar variación si pasa la probabilidad
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
  
  // PASO 2: Aplicar ajuste de brillo según la altura
  // Celdas más bajas = más oscuras (suelo húmedo)
  // Celdas más altas = más claras (suelo seco)
  // brightness va de 0.92 (altura mínima, más oscuro) a 1.0 (altura máxima, más claro)
  const brightness = 0.92 + normalizedHeight * 0.08;
  
  // Aplica el factor de brillo multiplicando cada componente
  rr *= brightness;
  gg *= brightness;
  bb *= brightness;
  
  // PASO 3: Clamp de los valores a [0, 1] antes de devolverlos
  rr = clamp01(rr);
  gg = clamp01(gg);
  bb = clamp01(bb);
  
  return [rr, gg, bb];
}

/**
 * Color base para las celdas de agua.
 * 
 * Azul oscuro que representa agua profunda con buena visibilidad.
 * Este color se aplica a las celdas que finalmente se determinan como agua
 * después de la detección de clusters.
 */
const WATER_COLOR = [0.106, 0.2, 0.294]; // Azul oscuro para el agua

/**
 * Bioma de Bosque (Forest)
 * 
 * Características:
 * - Color marrón terroso del suelo del bosque
 * - Alturas moderadas-altas (1.5 a 3.5) para terreno de bosque
 * - Variación de color sutil con ajuste de brillo por altura
 * - Áreas más bajas se ven más oscuras (suelo húmedo)
 * - Áreas más altas se ven más claras (suelo seco)
 * - Alta densidad de árboles (bosque denso)
 * - Sin ovejas (no habitan en bosques densos)
 * - Zonas de agua opcionales en áreas muy bajas
 */
const forestBiome = {
  name: "Forest",
  baseColor: [0.25, 0.15, 0.08],
  minHeight: 1,
  maxHeight: 7,
  colorVariance: 0.02,
  colorVariationProbability: 0.4,
  treeDensity: 0.45,
  sheepDensity: 0.0,
  heightNoiseScale: 0.20,
  computeColor: computeForestColor
};

