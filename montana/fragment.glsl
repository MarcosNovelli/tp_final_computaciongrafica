precision highp float;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vHeight;
varying float vHexMask;
uniform vec3 uLightDir;
uniform vec3 uCameraPos;
uniform float uBiome;

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
  float a = 0.5;
  float f = 1.4;
  for (int i = 0; i < 4; i++) {
    v += noise(p * f) * a;
    f *= 2.15;
    a *= 0.55;
  }
  return v;
}

void main() {
  if (vHexMask < 0.01) discard;

  vec3 N = normalize(vNormal);
  float slope = 1.0 - clamp(N.y, 0.0, 1.0);
  vec3 grass = vec3(0.29, 0.38, 0.22);
  vec3 dirt = vec3(0.32, 0.27, 0.22);
  vec3 rock = vec3(0.38, 0.40, 0.42);
  vec3 snow = vec3(0.93, 0.95, 0.98);
  vec3 jungleSoil = vec3(0.24, 0.2, 0.16);
  vec3 deepJungle = vec3(0.12, 0.21, 0.14);
  vec3 leaf = vec3(0.18, 0.35, 0.21);
  vec3 moss = vec3(0.23, 0.42, 0.24);
  vec3 mist = vec3(0.58, 0.72, 0.64);
  // Clay / Badlands Palette
  vec3 clayRed = vec3(0.68, 0.32, 0.22);    // Reddish brown
  vec3 clayOrange = vec3(0.82, 0.52, 0.32); // Orange clay
  vec3 clayWhite = vec3(0.92, 0.88, 0.82);  // Pale layer
  vec3 clayDark = vec3(0.45, 0.25, 0.20);   // Dark streak

  vec3 base;
  
  if (uBiome < 0.5) {
    // Mountain coloring
    float snowLine = smoothstep(1.1, 1.5, vHeight);
    float rockMask = smoothstep(0.22, 0.62, slope + vHeight * 0.3);
    float grassMask = 1.0 - smoothstep(0.32, 0.65, slope + vHeight * 0.18);
    base = mix(grass, dirt, 1.0 - grassMask);
    base = mix(base, rock, rockMask);
    base = mix(base, snow, snowLine);
  } else if (uBiome < 1.5) {
    // Desert coloring
    vec3 sand = vec3(0.76, 0.70, 0.50);
    vec3 darkSand = vec3(0.70, 0.62, 0.42);
    vec3 dunePeak = vec3(0.82, 0.78, 0.60);
    
    base = mix(darkSand, sand, smoothstep(0.0, 0.3, vHeight));
    base = mix(base, dunePeak, smoothstep(0.3, 0.6, vHeight));
  } else if (uBiome < 2.5) {
    // Clay/Badlands: Stratified coloring
    // Add some noise to the height coordinate for wobbly layers
    float strataCoord = vHeight * 8.0 + fbm(vWorldPos.xz * 3.0) * 0.5;
    
    // Create banding pattern
    float layer1 = sin(strataCoord);
    float layer2 = sin(strataCoord * 2.3 + 1.0);
    
    // Start with base red clay
    base = clayRed;
    
    // Mix in other layers based on sine waves
    base = mix(base, clayOrange, smoothstep(0.4, 0.6, layer1));
    base = mix(base, clayWhite, smoothstep(0.8, 0.95, abs(layer2))); // Thin white stripes
    base = mix(base, clayDark, smoothstep(0.85, 0.95, layer1) * 0.5); // Occasional dark bands
    
    // Slope darkening (crevices)
    base *= mix(0.7, 1.0, smoothstep(0.5, 0.8, slope));
    
    // Add some dust/sediment at the very bottom
    float sediment = 1.0 - smoothstep(0.0, 0.15, vHeight);
    base = mix(base, clayOrange * 0.8, sediment * 0.8);
  } else {
    // Forest / Jungle coloring
    
    // Forest palette
    vec3 deepForest = vec3(0.05, 0.18, 0.08); // Dark shadows
    vec3 midGreen = vec3(0.18, 0.32, 0.16);   // Main foliage
    vec3 brightLeaf = vec3(0.28, 0.42, 0.20); // Sunlit tops
    vec3 trunkBrown = vec3(0.32, 0.24, 0.18); // Soil/Trunks
    
    // Use height and noise to vary the green
    // Higher spots (canopy tops) are brighter/yellower
    // Lower spots (shadows/ground) are darker
    
    float canopyNoise = fbm(vWorldPos.xz * 3.0);
    float heightFactor = smoothstep(0.1, 0.6, vHeight + canopyNoise * 0.1);
    
    base = mix(deepForest, midGreen, heightFactor);
    base = mix(base, brightLeaf, smoothstep(0.5, 0.9, heightFactor));
    
    // Add some brown for steep slopes (trunks or ground visible)
    base = mix(base, trunkBrown, smoothstep(0.6, 0.9, slope) * 0.7);
    
    // Occasional color variation (flowers or different trees)
    float variation = noise(vWorldPos.xz * 0.8);
    vec3 autumn = vec3(0.65, 0.40, 0.15); // Slight reddish/brownish tint
    base = mix(base, autumn, smoothstep(0.6, 0.8, variation) * 0.3);
  }

  // Small-scale color breakup for texture
  vec2 texPos = vWorldPos.xz * 2.8 + uBiome * 8.3;
  float grain = fbm(texPos);
  float striations = fbm(texPos * vec2(0.6, 1.4) + vHeight * 0.5);
  float detail = mix(grain, striations, 0.35);
  base *= mix(0.9, 1.12, detail);
  // Darken steeper slopes to hint at crevices
  base = mix(base, base * 0.78, smoothstep(0.45, 0.95, slope));

  vec3 L = normalize(uLightDir);
  float diff = clamp(dot(N, L), 0.0, 1.0);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 H = normalize(L + V);
  float rough = mix(0.35, 1.0, slope);
  float specExp = mix(22.0, 46.0, 1.0 - rough);
  float spec = pow(max(dot(N, H), 0.0), specExp) * mix(0.25, 0.72, 1.0 - rough);

  vec3 ambient = vec3(0.18, 0.2, 0.22);
  vec3 color = base * (ambient + diff * 1.05) + spec;

  // atenuacion suave hacia el borde del hexagono
  color = mix(vec3(0.2, 0.23, 0.27), color, clamp(vHexMask + 0.1, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
