/**
 * ============================================================
 * biomes/clayBiome.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define el bioma Clay (arcilla) con toda su
 * configuración y lógica de generación de altura y colorización específica.
 * 
 * Contiene:
 * - Configuración del bioma (minHeight, maxHeight, heightNoiseScale, treeDensity, sheepDensity)
 * - Función para calcular alturas usando ruido Simplex (terreno variado con valles y colinas)
 * - Función para calcular colores: tonos naranja/terracota y marrón rojizo (arcilla)
 * - Soporte para zonas de agua y parches verdes de vegetación
 * 
 * DEPENDENCIAS:
 * - Requiere que randomInRange() y clamp01() estén disponibles globalmente
 *   (definidas en main.js)
 * - Requiere que hexDistance() esté disponible globalmente (definida en main.js)
 */

/**
 * Calcula el color de una celda del bioma Clay basado en su altura y posición.
 * 
 * RESPONSABILIDAD:
 * - Generar colores de arcilla (naranja/terracota y marrón rojizo)
 * - Crear variación de color basada en altura (valles más naranjas, colinas más marrones)
 * - Opcionalmente marcar áreas muy bajas como candidatas a agua
 * - Aplicar parches verdes ocasionales para vegetación en áreas específicas
 * 
 * PALETA DE COLORES CLAY:
 * 
 * 1. COLOR PRINCIPAL (baseColor):
 *    - Naranja/terracota: [0.75, 0.45, 0.25] (típico de arcilla)
 *    - Marrón rojizo: [0.65, 0.35, 0.20] (arcilla más oscura)
 *    - Los colores varían según la altura: valles más claros/naranjas, colinas más oscuras/marrones
 * 
 * 2. VARIACIÓN POR ALTURA:
 *    - Áreas bajas (valles): más naranjas y claras [0.75, 0.45, 0.25]
 *    - Áreas medias: marrón rojizo intermedio [0.70, 0.40, 0.22]
 *    - Áreas altas (colinas): marrón rojizo más oscuro [0.60, 0.32, 0.18]
 * 
 * 3. PARCHES VERDES (vegetación):
 *    - Ocasionalmente, algunas celdas pueden tener parches verdes [0.33, 0.61, 0.23]
 *    - Representa vegetación escasa que crece en áreas de arcilla
 *    - Probabilidad baja (~5-10%) para mantener el aspecto arcilloso dominante
 * 
 * 4. ZONAS DE AGUA (opcional):
 *    - Áreas muy bajas pueden marcarse como candidatas a agua
 *    - Similar al bioma Forest, pero menos común
 * 
 * @param {number} height - Altura de la celda (entero entre minHeight y maxHeight)
 * @param {Object} biome - Objeto bioma con { minHeight, maxHeight, baseColor }
 * @param {Object} cell - Objeto celda (opcional, usado para marcar candidateWater)
 * @returns {number[]} Color RGB [r, g, b] según altura y variación
 */
function computeClayColor(height, biome, cell = null) {
  // Normaliza la altura del rango [minHeight, maxHeight] a [0, 1]
  const heightRange = biome.maxHeight - biome.minHeight || 1.0;
  const normalizedHeight = (height - biome.minHeight) / heightRange; // 0..1
  
  // MARCAR CANDIDATOS DE AGUA: Áreas muy bajas pueden tener agua
  // Similar al Forest pero con umbral más bajo (solo en áreas muy deprimidas)
  const WATER_CANDIDATE_THRESHOLD = 0.12; // 12% del rango de altura = candidato a agua
  
  // Marcar como candidato si la altura normalizada está en el rango muy bajo
  if (cell && normalizedHeight < WATER_CANDIDATE_THRESHOLD) {
    cell.candidateWater = true;
    cell.isWater = false; // Se decidirá después mediante clusters
  } else if (cell) {
    cell.candidateWater = false;
    cell.isWater = false;
  }
  
  // Si la celda es agua (ya marcada por el detector de clusters), usar el color de agua
  if (cell && cell.isWater) {
    return [0.35, 0.45, 0.75]; // Color de agua azul claro
  }
  
  // COLOR PRINCIPAL: Distribución de bandas según altura
  // Banda alta (colinas): Pasto verde oscuro
  // Banda media: Roca oscura (como Rock dark)
  // Banda baja (valles): Variaciones de cobre (naranja/marrón rojizo)
  
  let r, g, b;
  
  if (normalizedHeight >= 0.8) {
    // BANDA ALTA (80-100%): Pasto verde oscuro en las colinas más altas
    // Más oscuro que el verde del bioma Grass
    // Rango: de 0.8 a 1.0 = 0.2 de rango
    const t = (normalizedHeight - 0.8) / 0.2; // 0..1 dentro del rango alto
    // Verde oscuro con gradiente: más oscuro en altura media, ligeramente más claro en la cima
    // Esto crea variación visual dentro de la banda verde
    r = 0.18 - t * 0.03; // 0.18 (verde oscuro) → 0.15 (verde muy oscuro en cima)
    g = 0.35 - t * 0.05; // 0.35 → 0.30
    b = 0.12 - t * 0.02; // 0.12 → 0.10
  } else if (normalizedHeight >= 0.7) {
    // BANDA MEDIA (70-80%): Roca oscura (como Rock dark)
    // Usa el mismo color de roca oscura que el bioma Rock
    // Rango: de 0.7 a 0.8 = 0.1 de rango
    const t = (normalizedHeight - 0.7) / 0.1; // 0..1 dentro del rango medio
    // Roca oscura del bioma Rock: [0.25, 0.27, 0.32] (dark) → [0.40, 0.42, 0.45] (baseRock)
    const darkRock = [0.25, 0.27, 0.32];     // Roca oscura (parte baja de la banda, heightNorm = 0.7)
    const baseRock = [0.40, 0.42, 0.45];    // Roca medio-oscura (parte alta de la banda, heightNorm = 0.8)
    // Interpolación de roca oscura a roca medio-oscura
    r = darkRock[0] + t * (baseRock[0] - darkRock[0]); // 0.25 → 0.40
    g = darkRock[1] + t * (baseRock[1] - darkRock[1]); // 0.27 → 0.42
    b = darkRock[2] + t * (baseRock[2] - darkRock[2]); // 0.32 → 0.45
  } else {
    // BANDA BAJA (0-70%): Variaciones de cobre en valles profundos
    // Mineral cobre con variaciones (naranja/marrón rojizo) - MÁS OSCURO
    // Rango: de 0.0 a 0.7 = 0.7 de rango
    const t = normalizedHeight / 0.7; // 0..1 dentro del rango bajo
    // Variaciones de cobre: desde cobre intenso hasta cobre medio
    // Cobre más intenso en el fondo (t=0), transición a cobre medio (t=1)
    // Colores más oscuros para mejor contraste
    r = 0.68 - t * 0.08; // 0.68 (cobre intenso oscuro en fondo) → 0.60 (cobre medio oscuro en altura 0.7)
    g = 0.35 - t * 0.06; // 0.35 → 0.29
    b = 0.15 - t * 0.03; // 0.15 → 0.12
  }
  
  // Aplicar variación aleatoria sutil para textura
  const colorVariance = biome.colorVariance !== undefined ? biome.colorVariance : 0.03;
  const variationProbability = biome.colorVariationProbability !== undefined ? biome.colorVariationProbability : 0.4;
  
  if (Math.random() < variationProbability) {
    r += randomInRange(-colorVariance, colorVariance);
    g += randomInRange(-colorVariance, colorVariance);
    b += randomInRange(-colorVariance, colorVariance);
  }
  
  // Ajuste de brillo ligero según altura (áreas altas un poco más claras)
  const brightness = 0.96 + normalizedHeight * 0.04; // 96% a 100%
  r *= brightness;
  g *= brightness;
  b *= brightness;
  
  // Clamp de los valores a [0, 1] antes de devolverlos
  r = clamp01(r);
  g = clamp01(g);
  b = clamp01(b);
  
  return [r, g, b];
}

/**
 * Bioma de Arcilla (Clay)
 * 
 * Características:
 * - Distribución de colores según elevación:
 *   - Valles profundos: Mineral cobre (naranja/marrón rojizo intenso)
 *   - Colinas altas: Roca gris oscuro/carbón
 * - Terreno variado con valles profundos y colinas rocosas (alturas moderadas)
 * - Parches verdes ocasionales de vegetación (8% de probabilidad en zonas medias)
 * - Zonas de agua opcionales en áreas muy bajas (detectadas por clusters)
 * - Vegetación escasa (pocos árboles, densidad baja)
 * - Sin ovejas (terreno de arcilla/minas no es adecuado para ellas)
 */
const clayBiome = {
  name: "Clay",                               // Nombre del bioma (para identificación)
  baseColor: [0.55, 0.30, 0.18],             // Color base intermedio (roca con matiz cobre)
  minHeight: 1,                               // Altura mínima (valles profundos con cobre)
  maxHeight: 20,                               // Altura máxima (colinas rocosas)
  colorVariance: 0.03,                        // Variación de color moderada
  colorVariationProbability: 0.4,             // Probabilidad de variación (40% de celdas)
  treeDensity: 0.1,                          // 5% de densidad de árboles (vegetación escasa en arcilla)
  sheepDensity: 0.0,                          // Sin ovejas en este bioma
  heightNoiseScale: 0.15,                     // Escala del ruido para alturas (terreno variado)
  computeColor: computeClayColor              // Función específica para calcular colores
};

