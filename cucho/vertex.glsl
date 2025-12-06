// Vertex shader: posiciones 3D y tipo de terreno, con relieve procedural.
attribute vec3 aPosition;
attribute float aTerrainType;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

varying float vTerrainType;
varying vec3 vWorldPos;

// Perlin 2D simple.
float randomGradient(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 gradient(vec2 p) {
  float a = randomGradient(p) * 6.2831853; // 2*PI
  return vec2(cos(a), sin(a));
}

float perlin(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  vec2 g00 = gradient(i);
  vec2 g10 = gradient(i + vec2(1.0, 0.0));
  vec2 g01 = gradient(i + vec2(0.0, 1.0));
  vec2 g11 = gradient(i + vec2(1.0, 1.0));

  float n00 = dot(g00, f);
  float n10 = dot(g10, f - vec2(1.0, 0.0));
  float n01 = dot(g01, f - vec2(0.0, 1.0));
  float n11 = dot(g11, f - vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f); // fade
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vec2 noisePos = worldPos.xz;

  float baseH = 0.05 * sin(noisePos.x * 6.0) * cos(noisePos.y * 6.0);
  float mountainNoise = perlin(noisePos * 3.0);
  float mountainH = 0.3 * mountainNoise;
  float isMountain = step(1.5, aTerrainType); // terrainType >= 2
  float height = baseH + isMountain * mountainH;

  worldPos.y += height;
  vTerrainType = aTerrainType;
  vWorldPos = worldPos.xyz;
  gl_Position = uProj * uView * worldPos;
}
