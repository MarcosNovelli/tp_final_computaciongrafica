// Vertex shader: posiciones 2D y tipo de terreno.
attribute vec2 aPosition;
attribute float aTerrainType;
varying float vTerrainType;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTerrainType = aTerrainType;
}
