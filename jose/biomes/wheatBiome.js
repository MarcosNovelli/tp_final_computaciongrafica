/**
 * ============================================================
 * biomes/wheatBiome.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define el bioma Wheat (trigo) con toda su
 * configuración y lógica de generación de altura y colorización específica.
 * 
 * Contiene:
 * - Configuración del bioma (minHeight, maxHeight, heightNoiseScale, wheatDensity, sheepDensity)
 * - Función para calcular alturas (terreno casi plano con muy poca variación)
 * - Función para calcular colores: amarillo/dorado (campo de trigo)
 * - Soporte para zonas de agua (clusters)
 * 
 * DEPENDENCIAS:
 * - Requiere que randomInRange() y clamp01() estén disponibles globalmente
 *   (definidas en main.js)
 */

/**
 * Calcula el color de una celda del bioma Wheat basado en su altura.
 * 
 * RESPONSABILIDAD:
 * - Generar colores amarillo/dorado para el terreno (campo de trigo)
 * - Marcar áreas muy bajas como candidatas a agua
 * - Aplicar variación sutil de color
 * 
 * PALETA DE COLORES WHEAT:
 * - Color base: Naranja/marrón arcillado [0.75, 0.55, 0.35] (suelo de campo)
 * - Variación sutil para textura natural
 * - Agua: Azul oscuro (definido en main.js)
 * 
 * @param {number} height - Altura de la celda (entero entre minHeight y maxHeight)
 * @param {Object} biome - Objeto bioma con { baseColor, minHeight, maxHeight, colorVariance }
 * @param {Object} cell - Objeto celda (opcional, usado para marcar candidateWater)
 * @returns {number[]} Color RGB [r, g, b] con variación sutil
 */
function computeWheatColor(height, biome, cell = null) {
  // Normaliza la altura del rango [minHeight, maxHeight] a [0, 1]
  const heightRange = biome.maxHeight - biome.minHeight || 1.0;
  const normalizedHeight = (height - biome.minHeight) / heightRange; // 0..1
  
  // MARCAR CANDIDATOS DE AGUA: Basado en ruido Simplex, NO en altura
  // Como el terreno es casi plano (poca variación de altura), usamos un método diferente
  // Generamos agua usando ruido Simplex basado en las coordenadas (q, r) de la celda
  // Esto crea patrones de agua más naturales, orgánicos y variados (no siempre en el mismo lugar)
  if (cell && typeof cell.q === 'number' && typeof cell.r === 'number') {
    // Usar ruido Simplex si está disponible, sino usar hash simple como fallback
    let waterValue;
    if (cell.noiseGenerator && typeof cell.noiseGenerator.noise2D === 'function') {
      // Usar ruido Simplex con escala diferente a la del terreno para generar patrones de agua
      // Escala más grande (0.08) = patrones más grandes y suaves de agua
      const waterNoiseScale = 0.08;
      const noiseValue = cell.noiseGenerator.noise2D(cell.q * waterNoiseScale, cell.r * waterNoiseScale);
      // Normalizar ruido de [-1, 1] a [0, 1]
      waterValue = (noiseValue + 1.0) * 0.5;
    } else {
      // Fallback: usar hash simple si no hay ruido disponible
      const seed = Math.abs((cell.q * 73856093) ^ (cell.r * 19349663));
      waterValue = ((seed * 83492791) % 1000000) / 1000000.0;
    }
    
    // El umbral determina qué porcentaje del terreno será candidato a agua
    // Usar ruido permite que el umbral cree patrones más orgánicos
    // Queremos mayormente tierra con algunos clusters de agua, así que solo una pequeña fracción
    // Valores de ruido < 0.15 = solo ~15% de las celdas serán candidatas (después se agrupan en clusters)
    const WATER_THRESHOLD = 0.20; // Solo celdas con ruido muy bajo (< 0.15) serán candidatas a agua
    
    // Si el valor de ruido está por debajo del umbral, es candidato a agua
    if (waterValue < WATER_THRESHOLD) {
      cell.candidateWater = true;
      cell.isWater = false; // Se decidirá después mediante clusters
    } else {
      cell.candidateWater = false;
      cell.isWater = false;
    }
  } else if (cell) {
    // Si no tiene coordenadas válidas, asegurarse de que no sea candidata
    cell.candidateWater = false;
    cell.isWater = false;
  }
  
  // Si la celda es agua (ya marcada por el detector de clusters), usar el color de agua
  if (cell && cell.isWater) {
    return [0.35, 0.45, 0.75]; // Color de agua azul claro
  }
  
  // Extrae el color base del bioma (amarillo/dorado)
  const [r, g, b] = biome.baseColor;
  
  // Aplicar variación aleatoria sutil usando colorVariance
  const variationProbability = biome.colorVariationProbability !== undefined ? biome.colorVariationProbability : 0.4;
  let rr = r;
  let gg = g;
  let bb = b;
  
  // Solo aplicar variación si pasa la probabilidad
  if (Math.random() < variationProbability) {
    const dr = randomInRange(-biome.colorVariance, biome.colorVariance);
    const dg = randomInRange(-biome.colorVariance, biome.colorVariance);
    const db = randomInRange(-biome.colorVariance, biome.colorVariance);
    
    rr = r + dr;
    gg = g + dg;
    bb = b + db;
  }
  
  // Ajuste de brillo ligero según altura (áreas altas un poco más claras)
  const brightness = 0.96 + normalizedHeight * 0.04; // 96% a 100%
  rr *= brightness;
  gg *= brightness;
  bb *= brightness;
  
  // Clamp de los valores a [0, 1] antes de devolverlos
  rr = clamp01(rr);
  gg = clamp01(gg);
  bb = clamp01(bb);
  
  return [rr, gg, bb];
}

/**
 * Bioma de Trigo (Wheat)
 * 
 * Características:
 * - Terreno casi plano con muy poca variación de altura
 * - Color naranja/marrón arcillado (suelo de campo)
 * - Zonas de agua generadas por ruido/coordenadas (NO basadas en altura, detectadas por clusters)
 * - Densidad alta de plantas de trigo (palitos) en hexágonos que no son agua
 * - Sin ovejas por defecto (pero se puede ajustar)
 */
const wheatBiome = {
  name: "Wheat",                               // Nombre del bioma (para identificación)
  baseColor: [0.85, 0.518, 0.255],              // Naranja/marrón arcillado (suelo de campo)
  minHeight: 1,                                // Altura mínima (terreno casi plano)
  maxHeight: 2,                                // Altura máxima (muy poca variación)
  colorVariance: 0.05,                         // Variación de color sutil
  colorVariationProbability: 0.4,              // Probabilidad de variación (40% de celdas)
  wheatDensity: 0.85,                          // 85% de densidad de trigo (muy denso, como campo)
  sheepDensity: 0.0,                           // Sin ovejas por defecto
  heightNoiseScale: 0.10,                      // Escala del ruido muy baja para terreno casi plano
  computeColor: computeWheatColor              // Función específica para calcular colores
};

