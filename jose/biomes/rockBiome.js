/**
 * ============================================================
 * biomes/rockBiome.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo define el bioma Rock (montaña rocosa) con toda su
 * configuración y lógica de generación de altura y colorización específica.
 * 
 * Contiene:
 * - Configuración del bioma (minHeight, maxHeight, heightNoiseScale, treeDensity, sheepDensity)
 * - Función para calcular alturas con forma de montaña (combinación de distancia radial + ruido)
 * - Función para calcular colores en 3 bandas: verde (base), roca gris (medio), nieve (punta)
 * 
 * DEPENDENCIAS:
 * - Requiere que hexDistance() esté disponible globalmente (definida en main.js)
 * - Requiere que clamp01() esté disponible globalmente (definida en main.js)
 * - Requiere que GRID_RADIUS esté disponible globalmente (definida en main.js)
 */

/**
 * Calcula la altura de una celda del bioma Rock con forma de montaña.
 * Genera un pico en el centro que disminuye radialmente hacia los bordes.
 */
function computeRockHeight(q, r, noise, context = null) {
  // Obtener el radio de la grilla desde el contexto o usar el valor global
  const gridRadius = context?.gridRadius || (typeof GRID_RADIUS !== 'undefined' ? GRID_RADIUS : 20);
  
  // Calcular distancia hexagonal desde el centro (0, 0)
  // Esta distancia se usa para determinar qué tan lejos está la celda del pico central
  const dist = hexDistance(0, 0, q, r);
  
  // Normalizar la distancia al rango [0, 1]
  // 0 = centro (pico de la montaña), 1 = borde del terreno
  const rNorm = Math.min(dist / gridRadius, 1.0);
  
  // FORMA BASE DE MONTAÑA:
  // Usamos Math.pow(1.0 - rNorm, 1.4) para crear un perfil de montaña
  // - En el centro (rNorm = 0): mountainShape = 1.0 (altura máxima)
  // - En el borde (rNorm = 1): mountainShape = 0.0 (altura mínima)
  // - El exponente 1.4 crea un pico pronunciado que decae suavemente
  const mountainShape = Math.pow(1.0 - rNorm, 1.4);
  
  // VARIACIÓN POR RUIDO:
  // El ruido Simplex agrega variación local para textura detallada
  // Se escala por heightNoiseScale para controlar la rugosidad
  // El ruido se normaliza de [-1, 1] a [0, 1] y se multiplica por 0.35 para variación moderada
  const noiseX = q * rockBiome.heightNoiseScale;
  const noiseY = r * rockBiome.heightNoiseScale;
  const n = noise.noise2D(noiseX, noiseY);
  const noiseTerm = (n + 1.0) * 0.5 * 0.35; // 0..0.35
  
  // COMBINAR FORMA BASE + RUIDO:
  // La forma de montaña es dominante, el ruido agrega detalles locales
  let hNorm = mountainShape + noiseTerm;
  
  // Asegurar que hNorm esté en el rango [0, 1]
  hNorm = Math.max(0.0, Math.min(1.0, hNorm));
  
  // MAPEAR AL RANGO DE ALTURAS DEL BIOMA:
  // Convertir la altura normalizada al rango [minHeight, maxHeight]
  const { minHeight, maxHeight } = rockBiome;
  const height = minHeight + hNorm * (maxHeight - minHeight);
  
  // Retornar altura redondeada y altura normalizada
  // heightNorm se usa en computeRockColor para determinar la banda (verde/roca/nieve)
  return {
    height: Math.round(height),
    heightNorm: hNorm
  };
}

/**
 * Calcula el color de una celda del bioma Rock basado en su altura normalizada.
 * Divide el terreno en 3 bandas: verde (base), roca gris (medio), nieve (punta).
 */
function computeRockColor(heightNorm) {
  // BANDA BAJA: Zona verde (base de la montaña)
  // heightNorm < 0.2 corresponde a los primeros 20% de la altura
  // Esta zona tiene pasto/vegetación similar al bioma Grass
  if (heightNorm < 0.2) {
    const grass = [0.33, 0.61, 0.23]; // Verde similar al grass biome
    return grass;
  }
  
  // BANDA MEDIA: Zona rocosa (cuerpo de la montaña)
  // 0.2 <= heightNorm < 0.97 corresponde a la parte media de la altura
  // Esta zona tiene roca gris con gradiente de oscuro (abajo) a medio (arriba)
  if (heightNorm < 0.97) {
    const baseRock = [0.45, 0.48, 0.52]; // Gris medio (parte alta de la banda rocosa)
    const dark = [0.25, 0.27, 0.32];     // Gris oscuro (parte baja de la banda rocosa)
    
    // Calcular posición dentro de la banda rocosa (0..1)
    // t = 0 en heightNorm = 0.2 (inicio de la banda)
    // t = 1 en heightNorm = 0.97 (fin de la banda)
    const t = (heightNorm - 0.2) / (0.97 - 0.2);
    
    // Interpolación lineal entre dark (t=0) y baseRock (t=1)
    // Esto crea un gradiente suave de gris oscuro a gris medio
    return [
      baseRock[0] * (1.0 - t) + dark[0] * t,
      baseRock[1] * (1.0 - t) + dark[1] * t,
      baseRock[2] * (1.0 - t) + dark[2] * t,
    ];
  }
  
  // BANDA ALTA: Zona nevada (punta de la montaña)
  // heightNorm >= 0.97 corresponde al 3% superior de la altura
  // Esta zona tiene nieve blanca en la punta de la montaña
  const snowBase = [0.95, 0.96, 0.98]; // Blanco casi puro con ligero toque azulado
  return snowBase;
}

/**
 * Bioma de Montaña Roca (Rock)
 * 
 * Características:
 * - Forma de montaña con pico en el centro del terreno
 * - Alturas variables: de 2.0 (base) a 12.0 (pico) - montaña muy prominente
 * - Tres bandas de color: verde (base), roca gris (medio), nieve (punta)
 * - Poca vegetación (solo en la zona verde de la base)
 * - Sin ovejas (terreno montañoso no es adecuado para ellas)
 */
const rockBiome = {
  name: "Rock",
  minHeight: 1.0,
  maxHeight: 40.0,
  heightNoiseScale: 0.2,
  treeDensity: 0.13,
  sheepDensity: 0.0,
  computeHeight: computeRockHeight,
  computeColor: computeRockColor
};

