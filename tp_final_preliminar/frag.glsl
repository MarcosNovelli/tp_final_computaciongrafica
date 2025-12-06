// Fragment shader: raymarches a small hex map with simple biomes and water outside the board.
precision highp float;
varying vec2 vUV;
uniform vec2 uResolution; // Canvas size in pixels
uniform float uTime;      // Seconds since start; drives animated details like waves
uniform vec3 uCamPos;     // Camera world position
uniform vec3 uCamDir;     // Camera look direction (normalized)
uniform vec3 uCamUp;      // Camera up vector to build the view basis
uniform float uFov;       // Field-of-view scale; higher = wider view/converges slower

// World tuning knobs
const float HEX_SIZE = 1.0;         // Radius of each hex tile in world units; larger = bigger tiles
const float GRID_RADIUS = 2.0;      // Hex grid radius (rings from center); controls map footprint
const float BOARD_THICKNESS = 0.35; // Solid thickness under tiles; keeps underside finite
const float WATER_HEIGHT = -0.15;   // Water plane height outside the board; lowers/raises shoreline

// Biomes: 0 forest, 1 wheat/plains, 2 desert/brick, 3 ore/mountain, 4 pasture
const int BIOME_COUNT = 5;
// --- Noise Functions ---
// 2D Random
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}
// 2D Noise based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}
// Fractal Brownian Motion: stack octaves of noise for softer terrain modulation
#define OCTAVES 6
float fbm (in vec2 st) {
    float value = 0.0;
    float amplitude = .5;
    float frequency = 0.;
    
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * noise(st);
        st *= 2.;
        amplitude *= .5;
    }
    return value;
}

// --- Hex helpers ---
float hexDist(vec2 p) { // signed distance to a unit hex centered at origin
    p = abs(p);
    return max(p.x * 0.8660254 + p.y * 0.5, p.y) - 1.0;
}

vec2 axialCoord(vec2 p) {
    float q = (0.577350269 * p.x - 0.3333333 * p.y) / HEX_SIZE;
    float r = (0.6666667 * p.y) / HEX_SIZE;
    return vec2(q, r);
}

vec3 cubeRound(vec3 c) {
    vec3 rc = floor(c + 0.5);
    vec3 d = abs(rc - c);
    if(d.x > d.y && d.x > d.z) rc.x = -rc.y - rc.z;
    else if(d.y > d.z)         rc.y = -rc.x - rc.z;
    else                       rc.z = -rc.x - rc.y;
    return rc;
}

vec2 cubeToCenter(vec3 cube) {
    float q = cube.x;
    float r = cube.y;
    return HEX_SIZE * vec2(1.7320508 * q + 0.8660254 * r, 1.5 * r);
}

float cellSeed(vec3 cube) {
    return fract(sin(dot(cube.xy, vec2(37.2, 91.7))) * 43758.5453);
}

int clampBiome(int b) {
    if(b < 0) return 0;
    if(b > 4) return 4;
    return b;
}

// Per-biome terrain feel. Tweak these to shape how each hex sits and ripples.
void biomeHeightSettings(int b, out float baseOffset, out float baseAmp, out float localAmp, out float localFreq) {
    // baseOffset: lifts the whole tile; baseAmp: large-scale bumps per hex
    // localAmp/localFreq: intra-hex ripples (higher freq = busier surface)
    // For a board-game look we keep baseAmp = 0 so all tiles meet flush; only baseOffset lifts a tile as a whole.
    if(b == 0) { baseOffset = 0.12; baseAmp = 0.0; localAmp = 0.16; localFreq = 2.1; return; } // forest: shallow bumps
    if(b == 1) { baseOffset = 0.10; baseAmp = 0.0; localAmp = 0.10; localFreq = 2.4; return; } // wheat: almost flat
    if(b == 2) { baseOffset = 0.10; baseAmp = 0.0; localAmp = 0.14; localFreq = 3.6; return; } // desert/brick: fine ripples
    if(b == 3) { baseOffset = 0.12; baseAmp = 0.0; localAmp = 0.30; localFreq = 2.4; return; } // mountain: same rim height as others
    baseOffset = 0.11; baseAmp = 0.0; localAmp = 0.14; localFreq = 1.9;                       // pasture default
}

// Per-biome texture frequency used for color variation; higher = more busy albedo.
float biomeToneFreq(int b) {
    if(b == 0) return 1.8; // forest
    if(b == 1) return 1.4; // wheat
    if(b == 2) return 3.2; // desert/brick
    if(b == 3) return 2.6; // mountain
    return 1.6;            // pasture
}

void biomeColors(int b, out vec3 base, out vec3 high) {
    if(b == 0) { base = vec3(0.12, 0.45, 0.18); high = vec3(0.18, 0.6, 0.22); return; }
    if(b == 1) { base = vec3(0.88, 0.8, 0.36); high = vec3(0.95, 0.88, 0.5); return; }
    if(b == 2) { base = vec3(0.76, 0.63, 0.38); high = vec3(0.82, 0.7, 0.45); return; }
    if(b == 3) { base = vec3(0.55, 0.55, 0.62); high = vec3(0.75, 0.75, 0.8); return; }
    base = vec3(0.26, 0.6, 0.42); high = vec3(0.32, 0.7, 0.5); // pasture fallback
}

int biomeId(vec3 cube) {
    // Deterministic variety per tile: hash cube to 0..4 so small boards show all biomes
    float seed = cellSeed(cube);
    return int(floor(seed * 5.0));
}

// Returns both base (flat bottom) and top (with local noise)
void sampleHexHeights(vec3 cube, vec2 local, out float baseH, out float topH) {
    int biome = clampBiome(biomeId(cube));
    float seed = cellSeed(cube);
    float baseOffset;
    float baseAmp;
    float localAmp;
    float localFreq;
    biomeHeightSettings(biome, baseOffset, baseAmp, localAmp, localFreq);

    // Board-game flatness: baseH is constant per biome, no per-hex slope, so edges stay flush.
    baseH = baseOffset;

    float edgeMask = 1.0 - smoothstep(-0.25, 0.0, hexDist(local)); // 1 in center, 0 near edge to keep borders coherent
    edgeMask = pow(edgeMask, 3.0); // Steepen falloff so noise dies out before the border
    float localNoise = fbm(local * localFreq + seed * 5.3) * localAmp * edgeMask; // intra-hex variation

    topH = baseH + localNoise;

    // Add a center-only lift for mountains so peaks rise without floating rims.
    if(biome == 3) {
        float peak = pow(edgeMask, 2.0) * 0.55; // adjust 0.55 to change mountain height
        topH += peak;
    }

    float d = hexDist(local);
    float edge = smoothstep(0.0, 0.08, d); // soften edges between tiles
    topH = mix(topH, topH - 0.35, edge); // shallow moat between tiles
}

// --- Raymarching ---
// Map function: defines the world
// Returns distance to the surface (or height difference for terrain)
float map(vec3 p) {
    vec2 axial = axialCoord(p.xz);
    vec3 cube = cubeRound(vec3(axial, -axial.x - axial.y));
    float ring = max(max(abs(cube.x), abs(cube.y)), abs(cube.z));
    if(ring > GRID_RADIUS) {
        return p.y - WATER_HEIGHT; // Water plane outside the finite grid
    }
    vec2 center = cubeToCenter(cube);
    vec2 local = (p.xz - center) / HEX_SIZE;

    float baseH;
    float topH;
    sampleHexHeights(cube, local, baseH, topH);

    // Avoid drawing an infinite underside: if we're well below the top surface, treat as empty space.
    if(p.y < baseH - BOARD_THICKNESS) return 5.0;
    return p.y - topH;
}
// Calculate normal using finite differences
vec3 calcNormal(vec3 p) {
    const float h = 0.001; // epsilon
    const vec2 k = vec2(1,-1);
    return normalize(k.xyy*map(p + k.xyy*h) + 
                     k.yyx*map(p + k.yyx*h) + 
                     k.yxy*map(p + k.yxy*h) + 
                     k.xxx*map(p + k.xxx*h));
}
// Raymarch loop
float raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    float tmax = 100.0;
    
    for(int i=0; i<200; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        
        // Since map(p) is p.y - height, it's not a true Euclidean SDF.
        // We need to be careful. A multiplier < 1.0 helps convergence.
        if(d < 0.001 * t) return t; // Hit
        if(t > tmax) break;      // Miss
        
        t += d * 0.4; // Step size multiplier; lower = safer but slower
    }
    return -1.0;
}
void main() {
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = vUV * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;
    // Camera setup
    vec3 ro = uCamPos;
    vec3 forward = normalize(uCamDir);
    vec3 right = normalize(cross(forward, uCamUp));
    vec3 up = cross(right, forward);
    
    // Ray direction
    vec3 rd = normalize(forward + uv.x * right * uFov + uv.y * up * uFov);
    // Render
    float t = raymarch(ro, rd);
    
    vec3 col = vec3(0.0);
    
    if(t > 0.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        vec2 axial = axialCoord(p.xz);
        vec3 cube = cubeRound(vec3(axial, -axial.x - axial.y));
        float ring = max(max(abs(cube.x), abs(cube.y)), abs(cube.z));
        int biome = clampBiome(biomeId(cube));
        
        // Simple lighting
        vec3 lightDir = normalize(vec3(0.5, 0.8, 0.2)); // Directional light angle
        float diff = max(dot(n, lightDir), 0.0);        // Lambert term

        if(ring > GRID_RADIUS + 0.01) {
            // Water shading outside the board
            vec3 waterColor = vec3(0.08, 0.32, 0.55);
            float wave = 0.03 * fbm(p.xz * 3.0 + vec2(uTime * 0.15, uTime * 0.12)); // Amplitude/freq set here
            float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0); // Edge reflectivity strength
            col = waterColor * (0.4 + 0.6 * diff) + wave;          // Base water shading + ripple
            col = mix(col, vec3(0.65, 0.8, 0.95), fresnel * 0.25);  // Blend towards sky tint at grazing angles
        } else {
            // Per-hex color with slight procedural variation
            vec3 baseCol;
            vec3 highCol;
            biomeColors(biome, baseCol, highCol);
            vec2 local = (p.xz - cubeToCenter(cube)) / HEX_SIZE;
            float tone = fbm(local * (2.0 + biomeToneFreq(biome)) + float(biome) * 3.17); // Increase multiplier for busier texture
            vec3 terrainColor = mix(baseCol, highCol, 0.5 + 0.5 * tone);
            
            col = terrainColor * (diff * 0.8 + 0.2); // Diffuse + Ambient
        }
        
        // Fog
        float fogAmount = 1.0 - exp(-t * 0.02); // Density; raise coefficient for thicker fog
        vec3 fogColor = vec3(0.5, 0.7, 0.9);    // Horizon tint
        col = mix(col, fogColor, fogAmount);
    } else {
        // Sky
        col = vec3(0.5, 0.7, 0.9) - rd.y * 0.2;
    }
    gl_FragColor = vec4(col, 1.0);
}
