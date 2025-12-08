precision highp float;
attribute vec2 aPos;
uniform mat4 uViewProj;
uniform float uHeightScale;
uniform float uHexRadius;
uniform float uTime;
uniform float uBiome;
uniform vec2 uOffset;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vHeight;
varying float vHexMask;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  float f = 1.2;
  for (int i = 0; i < 5; i++) {
    v += noise(p * f) * a;
    f *= 2.15;
    a *= 0.55;
  }
  return v;
}
float ridge(vec2 p) {
  float r = 0.0;
  float f = 1.0;
  float w = 0.85;
  for (int i = 0; i < 4; i++) {
    float n = abs(2.0 * noise(p * f) - 1.0);
    r += (1.0 - n) * w;
    f *= 2.3;
    w *= 0.55;
  }
  return r;
}
float sdHex(vec2 p, float r) {
  p = abs(p);
  return max(dot(p, vec2(0.8660254, 0.5)), p.y) - r; // r = radio circunscrito
}
float heightField(vec2 p, float hexR, out float mask) {
  vec2 q = p * 1.35;
  float d = sdHex(q, hexR);
  mask = 1.0 - smoothstep(0.02, 0.18, d);
  float radial = length(q) * 0.68;
  float falloff = exp(-radial * radial * 1.6) * mask;
  float macro = fbm(q * 0.55);
  float peaks = ridge(q * 0.45) * 1.15;
  float detail = fbm(q * 2.2) * 0.22;
  float h = (macro * 0.32 + peaks * 0.82 + detail) * falloff;
  h = pow(max(h, 0.0), 1.35);
  return h;
}
float heightFieldDesert(vec2 p, float hexR, out float mask) {
  vec2 q = p * 1.35;
  float d = sdHex(q, hexR);
  mask = 1.0 - smoothstep(0.02, 0.18, d);
  float radial = length(q) * 0.68;
  float falloff = exp(-radial * radial * 1.6) * mask;
  
  // Dunas suaves
  float dunes = 0.0;
  dunes += sin(q.x * 4.0 + q.y * 2.0 + uTime * 0.1) * 0.15;
  dunes += sin(q.x * 8.0 - q.y * 5.0) * 0.08;
  dunes += fbm(q * 3.0) * 0.1;
  
  float h = (dunes + 0.2) * falloff * 0.6; // Menor altura que la montaña
  return max(h, 0.0);
}
float heightFieldJungle(vec2 p, float hexR, out float mask) {
  vec2 q = p * 1.2;
  float d = sdHex(q, hexR);
  mask = 1.0 - smoothstep(0.02, 0.18, d);
  float radial = length(q) * 0.6;
  float falloff = exp(-radial * radial * 1.2) * mask;
  float canopy = fbm(q * 1.1) * 0.45;
  float mounds = fbm(q * 2.6) * 0.22;
  float detail = fbm(q * 6.0) * 0.08;
  float h = (canopy + mounds + detail) * falloff;
  return max(h, 0.0);
}
float sampleHeight(vec2 p, float hexR, out float mask) {
  if (uBiome < 0.5) return heightField(p, hexR, mask);
  if (uBiome < 1.5) return heightFieldDesert(p, hexR, mask);
  return heightFieldJungle(p, hexR, mask);
}
vec3 calcNormal(vec2 p, float hexR) {
  float e = 0.0025;
  float m0; float h = sampleHeight(p, hexR, m0);
  float m1; float hx = sampleHeight(p + vec2(e, 0.0), hexR, m1);
  float m2; float hz = sampleHeight(p + vec2(0.0, e), hexR, m2);
  vec3 dx = vec3(e, hx - h, 0.0);
  vec3 dz = vec3(0.0, hz - h, e);
  return normalize(cross(dz, dx));
}
void main() {
  vec2 coord = aPos;
  float mask;
  float h = sampleHeight(coord, uHexRadius, mask) * uHeightScale;
  vHexMask = mask;
  vHeight = h;
  vec3 pos = vec3(coord.x + uOffset.x, h, coord.y + uOffset.y);
  vWorldPos = pos;
  vNormal = calcNormal(coord, uHexRadius);
  gl_Position = uViewProj * vec4(pos, 1.0);
}
