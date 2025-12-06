precision mediump float;

varying vec3 vColor;
varying vec2 vPlanePos;
varying vec3 vBary;
varying float vBiome;
varying float vHeight;
varying float vEdgeBlend;

uniform float uEdge;
uniform float uHeightScale;
uniform vec3 uLightDir;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float f = 1.0;
  float a = 1.0;
  for (int i = 0; i < 4; i++) {
    v += noise2(p * f) * a;
    f *= 2.2;
    a *= 0.55;
  }
  return v;
}

float biomeBias(float biome) {
  return (biome < 0.5) ? 0.06 : (biome < 1.5 ? 0.0 : 0.04);
}

float heightField(float biome, vec2 p, float edgeBlend) {
  return ((fbm(p * 2.8) - 0.5) * uHeightScale + biomeBias(biome)) * edgeBlend;
}

void main() {
  float edge = 1.0 - smoothstep(uEdge * 0.35, uEdge, vBary.x);

  float biome = floor(vBiome + 0.5);
  vec3 albedo = vColor;
  vec2 p = vPlanePos;
  float height = heightField(biome, p, vEdgeBlend);

  if (biome < 0.5) {
    float n = fbm(p * 6.0);
    float veins = smoothstep(0.25, 0.45, abs(fract(n * 3.5) - 0.5));
    albedo *= 0.82 + 0.35 * n;
    albedo = mix(albedo, albedo * 0.85, veins * 0.6);
    float snow = smoothstep(0.18, 0.32, height);
    albedo = mix(albedo, vec3(0.92, 0.94, 0.98), snow);
  } else if (biome < 1.5) {
    float n = fbm(p * 4.0);
    float cracks = 1.0 - smoothstep(0.02, 0.08, abs(fract(p.x * 9.0 + n * 1.8) - 0.5));
    albedo *= 0.88 + 0.30 * n;
    albedo = mix(albedo, albedo * 0.60, cracks * 0.35);
  } else {
    float n = fbm(p * 7.0);
    float canopy = smoothstep(0.4, 0.8, n);
    float veins = smoothstep(0.45, 0.55, fract(p.y * 8.0 + n * 1.3));
    albedo *= 0.90 + 0.40 * canopy;
    albedo += vec3(0.04, 0.07, 0.02) * veins;
  }

  float eps = 0.01;
  float hC = height;
  float hX = heightField(biome, p + vec2(eps, 0.0), vEdgeBlend);
  float hY = heightField(biome, p + vec2(0.0, eps), vEdgeBlend);
  vec3 normal = normalize(vec3(hX - hC, eps, hY - hC));
  vec3 L = normalize(uLightDir);
  float diff = clamp(dot(normal, L), 0.05, 1.0);

  vec3 baseLit = albedo * (0.35 + 0.75 * diff);
  vec3 H = normalize(L + vec3(0.0, 1.0, 0.35));
  float spec = pow(max(dot(H, normal), 0.0), 10.0) * 0.2;
  baseLit += spec;

  float grain = (hash21(p * 18.37) - 0.5) * 0.03;
  vec3 shaded = baseLit * (1.0 + grain);

  vec3 outline = mix(vec3(0.08, 0.09, 0.12), shaded, 0.35);
  vec3 color = mix(outline, shaded, 1.0 - edge * 0.65);

  gl_FragColor = vec4(color, 1.0);
}

