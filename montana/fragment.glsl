precision highp float;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vHeight;
varying float vHexMask;
uniform vec3 uLightDir;
uniform vec3 uCameraPos;
uniform float uBiome;

void main() {
  if (vHexMask < 0.01) discard;

  vec3 N = normalize(vNormal);
  float slope = 1.0 - clamp(N.y, 0.0, 1.0);
  vec3 grass = vec3(0.29, 0.38, 0.22);
  vec3 dirt = vec3(0.32, 0.27, 0.22);
  vec3 rock = vec3(0.38, 0.40, 0.42);
  vec3 snow = vec3(0.93, 0.95, 0.98);

  vec3 base;
  
  if (uBiome > 0.5) {
    // Desert coloring
    vec3 sand = vec3(0.76, 0.70, 0.50);
    vec3 darkSand = vec3(0.70, 0.62, 0.42);
    vec3 dunePeak = vec3(0.82, 0.78, 0.60);
    
    base = mix(darkSand, sand, smoothstep(0.0, 0.3, vHeight));
    base = mix(base, dunePeak, smoothstep(0.3, 0.6, vHeight));
  } else {
    // Mountain coloring
    float snowLine = smoothstep(1.1, 1.5, vHeight);
    float rockMask = smoothstep(0.22, 0.62, slope + vHeight * 0.3);
    float grassMask = 1.0 - smoothstep(0.32, 0.65, slope + vHeight * 0.18);
    base = mix(grass, dirt, 1.0 - grassMask);
    base = mix(base, rock, rockMask);
    base = mix(base, snow, snowLine);
  }

  vec3 L = normalize(uLightDir);
  float diff = clamp(dot(N, L), 0.0, 1.0);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 38.0) * 0.6;

  vec3 ambient = vec3(0.18, 0.2, 0.22);
  vec3 color = base * (ambient + diff * 1.05) + spec;

  // atenuacion suave hacia el borde del hexagono
  color = mix(vec3(0.2, 0.23, 0.27), color, clamp(vHexMask + 0.1, 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
