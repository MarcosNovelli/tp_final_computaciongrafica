/**
 * ============================================================
 * utils/config.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene todas las constantes de configuración de la aplicación.
 */

/**
 * Factor de escala para la altura visual de las columnas hexagonales.
 */
const HEIGHT_UNIT = 0.3;

/**
 * Radio de la grilla hexagonal (distancia máxima desde el centro).
 */
const GRID_RADIUS = 8;

/**
 * MODO DE VISUALIZACIÓN: Selecciona cómo se muestra el mundo.
 * - "singleBiome": Modo actual - una sola isla/tile de un bioma
 * - "board": Nuevo modo - tablero con múltiples tiles, cada uno con su bioma
 */
const VIEW_MODE = "board";

/**
 * BIOMA ACTIVO: Solo se usa en modo "singleBiome".
 */
const ACTIVE_BIOME = "Grass";

/**
 * CONFIGURACIÓN DEL TABLERO (solo se usa en modo "board").
 */
const BOARD_WIDTH = 5;
const BOARD_HEIGHT = 5;

/**
 * Densidad de árboles en el bioma Grass (porcentaje de celdas que tendrán un árbol).
 */
const TREE_DENSITY = 0.08;

/**
 * Densidad de ovejas en el bioma Grass (porcentaje de celdas que tendrán una oveja).
 */
const SHEEP_DENSITY = 0.06;

/**
 * Color para la copa de los árboles en el bioma Grass (verde oscuro estilo low-poly).
 */
const TREE_CROWN_COLOR_GRASS = [0.1, 0.35, 0.1];

/**
 * Color para la copa de los árboles en el bioma Forest (verde muy oscuro para pinos).
 */
const TREE_CROWN_COLOR_FOREST = [0.05, 0.25, 0.08];

/**
 * Color para el tronco de los árboles (marrón oscuro como en la imagen de referencia).
 */
const TREE_TRUNK_COLOR = [0.35, 0.2, 0.12];

/**
 * Radio del hexágono en unidades del mundo (distancia del centro a un vértice).
 */
const HEX_RADIUS_WORLD = 0.5;

