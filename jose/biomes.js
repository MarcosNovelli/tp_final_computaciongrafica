/**
 * ============================================================
 * biomes.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define los diferentes biomas del mundo hexagonal.
 * Cada bioma tiene parámetros que controlan:
 * - Colores base y variaciones
 * - Rangos de altura
 * - Otros parámetros visuales o de gameplay
 * 
 * ESTRUCTURA DE UN BIOMA:
 * {
 *   baseColor: [r, g, b],    // Color base RGB (valores 0.0 a 1.0)
 *   minHeight: number,        // Altura mínima de las columnas
 *   maxHeight: number,        // Altura máxima de las columnas
 *   colorVariance: number     // Variación máxima del color (0.0 a 1.0)
 * }
 */

/**
 * Bioma de Pasto (Grass)
 * 
 * Características:
 * - Color verde base para representar hierba/pasto
 * - Alturas moderadas (1 a 3) para terreno de pradera
 * - Pequeña variación de color para simular variaciones naturales en el pasto
 */
export const grassBiome = {
  baseColor: [0.2, 0.7, 0.2],  // Verde pasto (R=0.2, G=0.7, B=0.2)
  minHeight: 1,                 // Altura mínima: columnas de 1 unidad
  maxHeight: 3,                 // Altura máxima: columnas de 3 unidades
  colorVariance: 0.1            // Variación de color: ±0.1 en cada componente RGB
};

