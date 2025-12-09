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

/**
 * Color de fondo del board (el área entre los tiles).
 * Color rojo para celdas lejanas a los tiles.
 */
const BOARD_BACKGROUND_COLOR = [0.106, 0.2, 0.294]; // Rojo (celdas lejanas)

/**
 * Color base para celdas del board que están cerca de tiles/biomas.
 * Este es el color que aparece con mayor frecuencia.
 * Color en RGB normalizado [r, g, b] donde cada valor va de 0.0 a 1.0.
 */
const BOARD_BACKGROUND_COLOR_NEAR = [0.75, 0.65, 0.50];

/**
 * Primer color de variación para celdas cercanas a tiles.
 * Color en RGB normalizado [r, g, b] donde cada valor va de 0.0 a 1.0.
 */
const BOARD_BACKGROUND_COLOR_VARIATION_1 = [0.90, 0.84, 0.67];

/**
 * Segundo color de variación para celdas cercanas a tiles.
 * Color en RGB normalizado [r, g, b] donde cada valor va de 0.0 a 1.0.
 */
const BOARD_BACKGROUND_COLOR_VARIATION_2 = [0.69, 0.60, 0.46];

/**
 * Distancia máxima (en unidades del mundo) desde una celda del board a una celda de tile
 * para que la celda del board sea considerada "cerca" y se pinte de arena.
 */
const BOARD_CELL_PROXIMITY_DISTANCE = 2.7;

/**
 * Probabilidad de usar el primer color de variación (0.0 a 1.0).
 * Ej: 0.25 = 25% de las celdas cercanas usarán BOARD_BACKGROUND_COLOR_VARIATION_1.
 */
const BOARD_COLOR_VARIATION_1_PROBABILITY = 0.15;

/**
 * Probabilidad de usar el segundo color de variación (0.0 a 1.0).
 * Solo se aplica si no se eligió la primera variación.
 * Ej: 0.15 = 15% de las celdas cercanas usarán BOARD_BACKGROUND_COLOR_VARIATION_2.
 * El resto usará el color base BOARD_BACKGROUND_COLOR_NEAR.
 */
const BOARD_COLOR_VARIATION_2_PROBABILITY = 0.15;




/**
 * Factor de escala del círculo del board (1.0 = tamaño exacto que cubre los tiles).
 * Valores mayores que 1.0 hacen el círculo más grande, menores que 1.0 más pequeño.
 */
const BOARD_CIRCLE_SCALE = 1.1;

/**
 * Ángulo de rotación del círculo del board (en grados, sentido antihorario visto desde arriba).
 * Ej: 0 = sin rotación, 30/60 = rotar, 90 = rotar un cuarto de vuelta.
 */
const BOARD_CIRCLE_ROTATION = 0;

/**
 * Altura (visual) de las celdas que forman el fondo hexagonal del board.
 */
const BOARD_HEXAGON_CELL_HEIGHT = 0.2;