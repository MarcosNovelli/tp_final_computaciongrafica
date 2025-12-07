/**
 * ============================================================
 * biomes/snowBiome.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define el bioma Snow (nieve) con su configuración
 * y lógica de colorización.
 * 
 * ESTRUCTURA:
 * - Configuración del bioma (baseColor, minHeight, maxHeight, colorVariance)
 * - Función para calcular colores específica del bioma Snow
 * 
 * NOTA: Actualmente esta es una estructura vacía lista para ser implementada.
 */

/**
 * Calcula el color de una celda del bioma Snow.
 * 
 * TODO: Implementar lógica de colorización específica del bioma Snow
 * 
 * @param {number} height - Altura de la celda
 * @param {Object} biome - Objeto bioma
 * @returns {number[]} Color RGB [r, g, b]
 */
function computeSnowColor(height, biome) {
  // TODO: Implementar lógica de colorización para Snow
  // Por ahora usa la función genérica
  return generateColor(biome.baseColor, biome.colorVariance);
}

/**
 * Bioma de Nieve (Snow)
 * 
 * Características:
 * - Color blanco/azulado claro
 * - Típicamente en alturas altas
 * 
 * TODO: Definir parámetros del bioma Snow
 */
const snowBiome = {
  baseColor: [0.9, 0.9, 0.95],  // Color base temporal (blanco azulado)
  minHeight: 4,                  // Altura mínima temporal
  maxHeight: 6,                  // Altura máxima temporal
  colorVariance: 0.05,           // Variación de color temporal
  computeColor: computeSnowColor // Función para calcular colores
};

