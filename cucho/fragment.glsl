// Fragment shader: colorea segun el tipo de terreno con variaciones procedurales.
precision mediump float;

varying float vTerrainType;
varying vec3 vWorldPos;

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
  vec3 baseColor;
  if (vTerrainType < 0.5) {
    baseColor = vec3(0.7, 0.3, 0.2);   // arcilla
  } else if (vTerrainType < 1.5) {
    baseColor = vec3(0.9, 0.8, 0.3);   // trigo
  } else {
    baseColor = vec3(0.5, 0.5, 0.6);   // piedra/montaña
  }

  // Variaciones procedurales: ruido sen/cos + perlin.
  float cheapNoise = 0.12 * sin(vWorldPos.x * 5.0) * cos(vWorldPos.z * 5.0);
  float perlinNoise = perlin(vWorldPos.xz * 3.0); // -1..1 aprox

  float isMountain = step(1.5, vTerrainType);
  float mountainShade = mix(1.0, 0.55 + 0.45 * perlinNoise, isMountain);

  vec3 color = baseColor;
  color *= (1.0 + cheapNoise);
  color *= mountainShade;

  // Toque de nieve en montana segun altura.
  float snow = smoothstep(0.25, 0.45, vWorldPos.y) * isMountain;
  color = mix(color, vec3(0.92, 0.95, 0.98), snow);

  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
