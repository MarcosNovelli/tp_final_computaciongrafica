// Fragment shader: colorea segun el tipo de terreno.
precision mediump float;
varying float vTerrainType;

void main() {
  vec3 color;
  if (vTerrainType < 0.5) {
    color = vec3(0.7, 0.3, 0.2);   // arcilla
  } else if (vTerrainType < 1.5) {
    color = vec3(0.9, 0.8, 0.3);   // trigo
  } else {
    color = vec3(0.5, 0.5, 0.6);   // piedra
  }
  gl_FragColor = vec4(color, 1.0);
}
