/**
 * ============================================================
 * biomes/desertBiome.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define el bioma Desert (desierto) con su configuración
 * y lógica de colorización.
 * 
 * ESTRUCTURA:
 * - Configuración del bioma (baseColor, minHeight, maxHeight, colorVariance)
 * - Función para calcular colores específica del bioma Desert
 * 
 * NOTA: Actualmente esta es una estructura vacía lista para ser implementada.
 */

/**
 * Calcula el color de una celda del bioma Desert.
 * 
 * TODO: Implementar lógica de colorización específica del bioma Desert
 * 
 * @param {number} height - Altura de la celda
 * @param {Object} biome - Objeto bioma
 * @returns {number[]} Color RGB [r, g, b]
 */
function computeDesertColor(height, biome) {
  // TODO: Implementar lógica de colorización para Desert
  // Por ahora usa la función genérica
  return generateColor(biome.baseColor, biome.colorVariance);
}

/**
 * Bioma de Desierto (Desert)
 * 
 * Características:
 * - Color amarillo/beige/arena
 * - Típicamente en alturas bajas y medias
 * 
 * TODO: Definir parámetros del bioma Desert
 */
const desertBiome = {
  baseColor: [0.76, 0.70, 0.50],  // Color base temporal (beige/arena)
  minHeight: 1,                    // Altura mínima temporal
  maxHeight: 2,                    // Altura máxima temporal
  colorVariance: 0.05,             // Variación de color temporal
  computeColor: computeDesertColor // Función para calcular colores
};

