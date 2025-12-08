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
 * 
 * RESPONSABILIDAD:
 * - Generar un color para una celda del bioma Forest
 * - Aplicar variación aleatoria sutil usando colorVariance
 * - Ajustar el brillo según la altura (celdas más bajas = más oscuras, más altas = más claras)
 * - Detectar zonas de agua en áreas muy bajas
 * - Asegurar que los valores finales estén en el rango [0.0, 1.0]
 * 
 * COLOR BASE (baseColor):
 * - Representa el color RGB principal del bioma Forest (marrón terroso)
 * - Es el color de referencia del que parten todas las variaciones
 * - Ejemplo: [0.45, 0.28, 0.16] = marrón del suelo del bosque
 * 
 * VARIACIÓN DE COLOR (colorVariance):
 * - Controla cuánto puede variar cada componente RGB del color base
 * - Valores pequeños (ej: 0.06) = variación sutil, colores más consistentes
 * - Valores grandes (ej: 0.2) = variación más pronunciada, colores más diversos
 * - Para cada componente (R, G, B), se suma un valor aleatorio entre -colorVariance y +colorVariance
 * 
 * AJUSTE POR ALTURA:
 * - Celdas más bajas se hacen un poco más oscuras (menor brillo)
 * - Celdas más altas se hacen un poco más claras (mayor brillo)
 * - Esto simula que áreas bajas tienen suelo más húmedo/oscuro
 * - La altura se normaliza del rango [minHeight, maxHeight] a [0, 1]
 * - Se aplica un factor de brillo: 0.92 + normalizedHeight * 0.08
 * - Esto significa que celdas en la altura mínima serán 8% más oscuras
 * - Y celdas en la altura máxima serán 8% más claras
 * 
 * ZONAS DE AGUA (OPCIONAL):
 * - Si la altura normalizada es muy baja (menor a 0.15), se marca como agua
 * - El color del agua es azul: [0.1, 0.2, 0.5]
 * - Esto crea pequeñas zonas de agua en áreas depresionadas del bosque
 * 
 * @param {number} height - Altura de la celda (entero entre minHeight y maxHeight)
 * @param {Object} biome - Objeto bioma con { baseColor, minHeight, maxHeight, colorVariance }
 * @param {Object} cell - Objeto celda (opcional, usado para marcar isWater)
 * @returns {number[]} Color RGB [r, g, b] con variación y ajuste por altura
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
  name: "Forest",                              // Nombre del bioma (para identificación)
  baseColor: [0.25, 0.15, 0.08],              // Marrón terroso más oscuro (suelo de bosque)
  minHeight: 1,                               // Altura mínima (bajado de 2 a 1 para transiciones más suaves)
  maxHeight: 7,                               // Altura máxima (bajado de 8 a 7 para transiciones más suaves)
  colorVariance: 0.02,                         // Variación de color sutil
  colorVariationProbability: 0.4,              // Probabilidad de variación (40% de celdas)
  treeDensity: 0.45,                           // 35% de las celdas tendrán árboles (bosque denso)
  sheepDensity: 0.0,                           // Sin ovejas en este bioma
  heightNoiseScale: 0.20,                      // Escala del ruido para alturas (ajustable)
  computeColor: computeForestColor             // Función específica para calcular colores
};

