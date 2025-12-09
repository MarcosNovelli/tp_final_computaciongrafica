precision highp float;

uniform vec2 uResolution;
uniform float uTanHalfFov;
uniform mat3 uCamRot;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform float uEpsilon;
uniform float uTime;
uniform float uBiome;

varying vec2 vUV;

// --- Noise Functions ---
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

// Low quality FBM for raymarching
float fbmLow(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    float f = 1.2;
    for (int i = 0; i < 3; i++) { // Reduces octaves 5->3
        v += noise(p * f) * a;
        f *= 2.15;
        a *= 0.55;
    }
    return v;
}

// High quality FBM for detail
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
    return max(dot(p, vec2(0.8660254, 0.5)), p.y) - r;
}

const float uHeightScale = 2.8;
const float uHexRadius = 2.35;
const float uGap = 0.05; // Gap between tiles
const float uWaterLevel = -0.05; // Global ocean height

// Base height field logic
float heightFieldBase(vec2 p, float hexR, out float mask, bool highQuality, vec2 offset) {
    vec2 q = p * 1.35;
    float d = sdHex(q, hexR);
    mask = 1.0 - smoothstep(0.02, 0.18, d);
    float radial = length(q) * 0.68;
    float falloff = exp(-radial * radial * 1.6) * mask;
    
    vec2 qn = q + offset; // Offset for noise only
    
    float macro = highQuality ? fbm(qn * 0.55) : fbmLow(qn * 0.55);
    // Reduced impact of sharp peaks slightly (1.15 -> 0.9)
    float peaks = ridge(qn * 0.45) * 0.9; 
    float detail = highQuality ? (fbm(qn * 2.2) * 0.22) : 0.0; // Skip fine detail in low quality match
    
    float h = (macro * 0.32 + peaks * 0.82 + detail) * falloff;
    // Reduced exponent (1.35 -> 1.1) to flatten/smooth the curve
    h = pow(max(h, 0.0), 1.1);
    return h;
}

float heightFieldDesert(vec2 p, float hexR, out float mask, bool highQuality, vec2 offset) {
  vec2 q = p * 1.35;
  float d = sdHex(q, hexR);
  mask = 1.0 - smoothstep(0.02, 0.18, d);
  float radial = length(q) * 0.68;
  float falloff = exp(-radial * radial * 1.6) * mask;
  
  vec2 qn = q + offset;

  // Dunas suaves
  float dunes = 0.0;
  // Removed time term so dunes stay static
  dunes += sin(qn.x * 4.0 + qn.y * 2.0) * 0.15;
  dunes += sin(qn.x * 8.0 - qn.y * 5.0) * 0.08;
  float f = highQuality ? fbm(qn * 3.0) : fbmLow(qn * 3.0);
  dunes += f * 0.1;
  
  float h = (dunes + 0.2) * falloff * 0.6; 
  return max(h, 0.0);
}

float heightFieldClay(vec2 p, float hexR, out float mask, bool highQuality, vec2 offset) {
  vec2 q = p * 1.3;
  float d = sdHex(q, hexR);
  mask = 1.0 - smoothstep(0.02, 0.18, d);

  float radial = length(q) * 0.45; 
  float falloff = exp(-radial * radial * 0.6); 

  vec2 qn = q + offset;

  float base = highQuality ? fbm(qn * 0.7) : fbmLow(qn * 0.7);
  float erosion = ridge(qn * 1.2) * 0.15;
  float detail = highQuality ? (fbm(qn * 4.0) * 0.05) : 0.0;
  
  float h = (base - erosion + detail) * falloff * mask;
  
  float steps = 7.0; 
  float s = h * steps;
  h = (s - sin(6.28318 * s) * 0.14) / steps;

  return max(h, 0.0) * 0.9;
}

float heightFieldJungle(vec2 p, float hexR, out float mask, bool highQuality, vec2 offset) {
  vec2 q = p * 1.3;
  float d = sdHex(q, hexR);
  mask = 1.0 - smoothstep(0.02, 0.18, d);
  
  float radial = length(q) * 0.45;
  float falloff = exp(-radial * radial * 0.6);

  vec2 qn = q + offset;

  float hills = (highQuality ? fbm(qn * 0.5) : fbmLow(qn * 0.5)) * 0.4;
  
  float canopyFor = noise(qn * 4.0);
  float canopy = (1.0 - abs(canopyFor * 2.0 - 1.0)) * 0.15;
  
  float leaves = highQuality ? (fbm(qn * 15.0) * 0.03) : 0.0;

  float h = (hills + canopy + leaves + 0.12) * falloff * mask;
    h *= 0.6;
  
  return max(h, 0.0);
}

// uniform float uBiome; -> already declared above
uniform float uGridRadius; 
uniform float uSeed; // New uniform

// Helper to determine biome for a given hex ID
float getTileBiome(vec2 id) {
    if (uBiome > -0.5) return uBiome; // Not random
    
    // Random biome based on ID + uSeed
    // Multiply by large prime and add seed
    float h = hash(id * 12.34 + vec2(uSeed));
    
    // Map 0..1 to 0, 1, 2, 3
    if (h < 0.25) return 0.0; // Mountain
    if (h < 0.5) return 1.0;  // Desert
    if (h < 0.75) return 2.0; // Clay
    return 3.0;               // Jungle
}

float sampleHeight(vec2 worldC, out float mask, out float biome, bool highQuality, float inputBiome, vec2 noiseOffset) {
    mask = 0.0;
    biome = inputBiome; 
    
    if (inputBiome < 0.5) return heightFieldBase(worldC, uHexRadius, mask, highQuality, noiseOffset);
    if (inputBiome < 1.5) return heightFieldDesert(worldC, uHexRadius, mask, highQuality, noiseOffset);
    if (inputBiome < 2.5) return heightFieldClay(worldC, uHexRadius, mask, highQuality, noiseOffset);
    return heightFieldJungle(worldC, uHexRadius, mask, highQuality, noiseOffset);
}

// ... (existing code)

// Hex Grid Logic
struct HexID {
    vec2 id;      // Axial coordinate
    vec2 center;  // World center of this hex
    vec2 uv;      // Local p relative to center
};

// IQ's Hexagon Grid logic
HexID getHex(vec2 p, float r) {
    vec2 q = vec2( p.x*2.0/1.73205, p.y + p.x*0.57735 );
    
    vec2 pi = floor(q);
    vec2 pf = fract(q);

    float v = mod(pi.x + pi.y, 3.0);
    float ca = step(1.0,v);
    float cb = step(2.0,v);
    vec2  ma = step(pf,vec2(ca,cb));
    
    // Smoothing/rounding not needed for id, just get center
    // Re-deriving center from IQ's method is tricky, let's use standard axial.
    
    // Alternative: Standard Axial Rounding
    // x_axial = p.x * 2/3 / R
    // z_axial = (-p.x/3 + sqrt(3)/3 * p.z) / R ... careful with orientation
    
    // Actually, simple tiling:
    // The Montana hex setup seems aligned such that uHexRadius is face-to-face?
    // sdHex uses dot(p, (0.866, 0.5)). 
    
    // Let's rely on standard spacing.
    // Width = sqrt(3) * Radius. 
    // Spacing X: sqrt(3)*R. Spacing Y: 1.5*R.
    // Staggered rows.
    
    float size = r;
    float w = 1.7320508 * size; // width
    float h = 2.0 * size;       // height (corner to corner)
    
    // Pointy topped or flat topped? sdHex is pointy topped (if y aligned). 
    // .x * 0.866 + .y * 0.5 suggests it.
    
    // Let's brute force "infinite repetition" with modest search or use known tiling.
    // Since we only really need neighbor checking if we cross boundaries.
    // But since walls are solid, we can just treat each cell as an object.
    
    // Efficient Tiling:
    vec2 r_sz = vec2(1.7320508 * size, 3.0 * size); 
    vec2 h_sz = r_sz * 0.5;
    
    vec2 a = mod(p, r_sz) - h_sz;
    vec2 b = mod(p - h_sz, r_sz) - h_sz;
    
    vec2 local = dot(a, a) < dot(b, b) ? a : b;
    
    // ID?
    vec2 center = p - local;
    //axial approx?
    
    // Convert center to axial coords for radius check
    float q_ax = (center.x * 1.7320508/3.0 - center.y / 3.0) / size; // Approximation
    float r_ax = center.y * 2.0/3.0 / size;
    // This assumes pointy topped.
    // Montana sdHex: max(dot(p, (0.866, 0.5)), p.y)... this is FLAT TOPPED ?? 
    // Wait: dot(p, (sqrt(3)/2, 1/2)). max(..., p.y).
    // If p.y is dominant, horizontal flat top? No, p.y is distance to horizontal line.
    // p.y = r -> flat line at y=r. 
    // So yes, it is FLAT TOPPED geometry (rotated 30 deg compared to pointy).
    // Flat topped: Width = 2*size. Height = sqrt(3)*size.
    // Stagger logic:
    // x spacing = 1.5 * size. y spacing = sqrt(3) * size?
    
    // Actually, let's use the layout from montana/main.js `updateTileOffsets`
    // x += r * 1.75? No, they used a loop.
    
    // Let's assume standard Flat Topped logic for tiling.
    // s = uHexRadius.
    // grid width = 3/2 * s? No.
    
    // Let's use simpler logic:
    // Just map p to "nearest hex center"
    // https://www.redblobgames.com/grids/hexagons/#pixel-to-hex
    
    float q_ = (2.0/3.0 * p.x) / uHexRadius;
    float r_ = (-1.0/3.0 * p.x + sqrt(3.0)/3.0 * p.y) / uHexRadius;
    
    // Round to nearest hex
    float rx = floor(q_ + 0.5);
    float ry = floor(r_ + 0.5);
    float rz = floor(-q_ - r_ + 0.5);
    
    float x_diff = abs(rx - q_);
    float y_diff = abs(ry - r_);
    float z_diff = abs(rz - (-q_ - r_));
    
    if (x_diff > y_diff && x_diff > z_diff) {
        rx = -ry - rz;
    } else if (y_diff > z_diff) {
        ry = -rx - rz;
    } else {
        rz = -rx - ry;
    }
    
    vec2 id = vec2(rx, ry);
    
    // Convert back to center
    // x = size * 3/2 * q
    // y = size * sqrt(3) * (r + q/2)
    vec2 center2;
    center2.x = uHexRadius * 1.5 * id.x;
    center2.y = uHexRadius * 1.7320508 * (id.y + id.x * 0.5);
    
    HexID hx;
    hx.id = id;
    hx.center = center2;
    hx.uv = p - center2;
    return hx;
}

float axialDistance(vec2 id) {
    float q = id.x;
    float r = id.y;
    float s = -q - r;
    return max(max(abs(q), abs(r)), abs(s));
}

float map(vec3 p) {
    // 1. Tiling
    // If gridRadius is 0, we treat it as single tile (avoid overhead?)
    // But consistent logic is nice.
    
    HexID hex = getHex(p.xz, uHexRadius);
    
    // Check Radius
    // Hex distance from center (0,0) in axial coords is (abs(q) + abs(r) + abs(s)) / 2?
    // or max(abs(q), abs(r), abs(s)) which is Chebyshev distance on hex grid
    float q = hex.id.x;
    float r = hex.id.y;
    float s = -q - r;
    float dist = max(max(abs(q), abs(r)), abs(s));
    
    // Removed broken explicit return logic. Handled by bounding cylinder at end of map.
    
    // Local coords
    vec3 localP = vec3(hex.uv.x, p.y, hex.uv.y);
    

    
    // 1. Terrain Height at local p
    float mask, biome;
    float tileBiome = getTileBiome(hex.id);
    
    // Generate unique offset per tile based on ID
    vec2 noiseOffset = hash(hex.id + vec2(uSeed * 0.1)) * vec2(100.0) + vec2(uSeed);
    // Add time for desert dunes if needed, or keep static. Keep static/session based.
    
    float h = sampleHeight(localP.xz, mask, biome, false, tileBiome, noiseOffset) * uHeightScale;
    
    // 2. Define Prism Volume (Tapered)
    float slope = 0.4;
    float hexR = max(0.0, uHexRadius - uGap - localP.y * slope); // Apply gap and clamp
    float d_hex = sdHex(localP.xz * 1.35, hexR) / 1.35; // Local hex SDF
    d_hex *= 0.9;
    
    // 3. Define Top Surface
    float d_top = (localP.y - h) * 0.25;
    
    // 4. Solid Intersection
    float d_bottom = (-localP.y - 7.0); 
    
    float d_terrain = max(d_hex, max(d_top, d_bottom));
    
    float boundRadius = (uGridRadius + 0.1); 
    if (dist > boundRadius) {
        // Outside the valid grid: use a real bounding cylinder SDF to avoid over-stepping and missing the terrain
        float worldBound = uHexRadius * (1.6 * (uGridRadius + 1.2));
        float d_cyl = length(p.xz) - worldBound;
        return max(d_cyl, 0.15);
    }
    
    return d_terrain;
}

vec3 intersectTerrain(vec3 ro, vec3 rd, float maxDist) {
    float t = 0.0;
    for(int i=0; i<160; i++) {
        if(t > maxDist) break;
        vec3 p = ro + rd * t;
        
        float d = map(p);
        
        if (d < uEpsilon) {
            // Need to reconstruct context for biome/mask
            HexID hex = getHex(p.xz, uHexRadius);
            vec3 localP = vec3(hex.uv.x, p.y, hex.uv.y);
            
            float mask, biome;
            float tileBiome = getTileBiome(hex.id);
            
            vec2 noiseOffset = hash(hex.id + vec2(uSeed * 0.1)) * vec2(100.0) + vec2(uSeed);
            
            sampleHeight(localP.xz, mask, biome, false, tileBiome, noiseOffset); 
            return vec3(t, mask, biome);
        }
        
        t += d;
    }
    return vec3(-1.0, 0.0, 0.0);
}

// Soft shadow for directional light. Marches along the light ray and fades when another tile blocks it.
float softShadow(vec3 ro, vec3 rd, float maxDist) {
    float res = 1.0;
    float t = 0.08;
    for (int i = 0; i < 48; i++) {
        if (t > maxDist) break;
        float h = map(ro + rd * t);
        if (h < uEpsilon) return 0.0;
        res = min(res, 12.0 * h / t);
        t += clamp(h, 0.04, 0.6);
    }
    return clamp(res, 0.0, 1.0);
}

// Old high-quality normal for terrain surface details
vec3 calcTerrainNormal(vec3 p) {
    vec2 e = vec2(0.005, 0.0);
    float m, b;
    // Must transform to local to sample correct height
    HexID hex = getHex(p.xz, uHexRadius);
    vec2 lp = hex.uv;
    
    float tileBiome = getTileBiome(hex.id);
    vec2 noiseOffset = hash(hex.id + vec2(uSeed * 0.1)) * vec2(100.0) + vec2(uSeed);
    
    float hL = sampleHeight(lp - e.xy, m, b, true, tileBiome, noiseOffset) * uHeightScale;
    float hR = sampleHeight(lp + e.xy, m, b, true, tileBiome, noiseOffset) * uHeightScale;
    float hD = sampleHeight(lp - e.yx, m, b, true, tileBiome, noiseOffset) * uHeightScale;
    float hU = sampleHeight(lp + e.yx, m, b, true, tileBiome, noiseOffset) * uHeightScale;
    
    vec3 v1 = vec3(2.0 * e.x, hR - hL, 0.0);
    vec3 v2 = vec3(0.0, hU - hD, 2.0 * e.x);
    
    return normalize(cross(v2, v1));
}

// General SDF normal for geometry (walls vs top)
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.005, 0.0);
    // Gradient of SDF
    // map(p) handles the tiling internally
    float d = map(p);
    vec3 n = vec3(
        d - map(p - e.xyy),
        d - map(p - e.yxy),
        d - map(p - e.yyx)
    );
    return normalize(n);
}

vec3 getBiomeColor(float biome, vec3 p, vec3 n, float h, float mask) {
    // Transform P to local for coloring logic if we want consistent texturing per tile
    HexID hex = getHex(p.xz, uHexRadius);
    vec2 lp = hex.uv;
    // We use p for global noise (variation) or lp for local?
    // Let's use p (world) for noise so texture flows? 
    // Wait, map uses cloned texture. 
    // Let's use 'p' as is. Since we render clones, p.xz will be different,
    // so coloring might look weird if heightField is local but coloring is global.
    // Actually, getBiomeColor uses fbm(p.xz).
    // If we want identical clones, use lp.
    // If we want random variation, use p.
    // Let's use 'lp' for structure consistency with heightfield, 
    // but maybe offset it by ID for variation later.
    // For now, let's use global 'p' to see if it makes tiles look distinctive.
    
    float slope = 1.0 - clamp(n.y, 0.0, 1.0);
    vec3 base;
    
    // Use local p for texturing to match heightfield features
    vec3 texP = vec3(lp.x, p.y, lp.y);

    if (biome < 0.5) {
        // Mountain
        vec3 grass = vec3(0.29, 0.38, 0.22);
        vec3 dirt = vec3(0.32, 0.27, 0.22);
        vec3 rock = vec3(0.38, 0.40, 0.42);
        vec3 snow = vec3(0.93, 0.95, 0.98);

        float snowLine = smoothstep(1.1, 1.5, h);
        float rockMask = smoothstep(0.22, 0.62, slope + h * 0.3);
        float grassMask = 1.0 - smoothstep(0.32, 0.65, slope + h * 0.18);
        base = mix(grass, dirt, 1.0 - grassMask);
        base = mix(base, rock, rockMask);
        base = mix(base, snow, snowLine);
        
        // Use local p for texturing to match heightfield features
        // Renaming 'p' to 'texP' for noise lookups would require changing all fbm(p.xz) calls.
        // simpler: Assume p is passed as the coordinate we want to shade.
        // If caller passes localP, it's local. If worldP, it's global.
        
        vec2 texPos = p.xz * 2.8; 
        float grain = fbm(texPos);
        float striations = fbm(texPos * vec2(0.6, 1.4) + h * 0.5);
        float detail = mix(grain, striations, 0.35);
        base *= mix(0.9, 1.12, detail);
        base = mix(base, base * 0.78, smoothstep(0.45, 0.95, slope));

    } else if (biome < 1.5) {
        // Desert
        vec3 sand = vec3(0.76, 0.70, 0.50);
        vec3 darkSand = vec3(0.70, 0.62, 0.42);
        vec3 dunePeak = vec3(0.82, 0.78, 0.60);
        
        base = mix(darkSand, sand, smoothstep(0.0, 0.3, h));
        base = mix(base, dunePeak, smoothstep(0.3, 0.6, h));

    } else if (biome < 2.5) {
        // Clay
        vec3 clayRed = vec3(0.68, 0.32, 0.22);
        vec3 clayOrange = vec3(0.82, 0.52, 0.32);
        vec3 clayWhite = vec3(0.92, 0.88, 0.82);
        vec3 clayDark = vec3(0.45, 0.25, 0.20);
        
        float strataCoord = h * 8.0 + fbm(p.xz * 3.0) * 0.5;
        float layer1 = sin(strataCoord);
        float layer2 = sin(strataCoord * 2.3 + 1.0);
        
        base = clayRed;
        base = mix(base, clayOrange, smoothstep(0.4, 0.6, layer1));
        base = mix(base, clayWhite, smoothstep(0.8, 0.95, abs(layer2)));
        base = mix(base, clayDark, smoothstep(0.85, 0.95, layer1) * 0.5);
        base *= mix(0.7, 1.0, smoothstep(0.5, 0.8, slope));
        
        float sediment = 1.0 - smoothstep(0.0, 0.15, h);
        base = mix(base, clayOrange * 0.8, sediment * 0.8);

    } else {
        // Jungle
        vec3 deepForest = vec3(0.05, 0.18, 0.08);
        vec3 midGreen = vec3(0.18, 0.32, 0.16);
        vec3 brightLeaf = vec3(0.28, 0.42, 0.20);
        vec3 trunkBrown = vec3(0.32, 0.24, 0.18);
        
        float canopyNoise = fbm(p.xz * 3.0);
        float heightFactor = smoothstep(0.1, 0.6, h + canopyNoise * 0.1);
        
        base = mix(deepForest, midGreen, heightFactor);
        base = mix(base, brightLeaf, smoothstep(0.5, 0.9, heightFactor));
        base = mix(base, trunkBrown, smoothstep(0.6, 0.9, slope) * 0.7);
        
        float variation = noise(p.xz * 0.8);
        vec3 autumn = vec3(0.65, 0.40, 0.15);
        base = mix(base, autumn, smoothstep(0.6, 0.8, variation) * 0.3);
    }
    
    return base;
}

vec3 colorCielo(vec3 dir){
    float t = clamp(0.5 * (dir.y + 1.0), 0.0, 1.0);
    vec3 top = vec3(0.55, 0.75, 1.0);
    vec3 bottom = vec3(0.07, 0.07, 0.12);
    return mix(bottom, top, t);
}

// Simple gerstner-ish waves for the ocean plane
float waterHeight(vec2 p) {
    float h = 0.0;
    h += sin(dot(p, normalize(vec2(1.2, 0.9))) * 2.4 + uTime * 0.9) * 0.04;
    h += sin(dot(p, normalize(vec2(-0.7, 1.3))) * 3.1 + uTime * 1.35) * 0.03;
    h += fbm(p * 1.8 + uTime * 0.15) * 0.02;
    return h;
}

vec3 waterNormal(vec2 p, out float chop) {
    float e = 0.08;
    float h = waterHeight(p);
    float hx = waterHeight(p + vec2(e, 0.0)) - h;
    float hz = waterHeight(p + vec2(0.0, e)) - h;
    chop = clamp((abs(hx) + abs(hz)) * 14.0, 0.0, 1.0);
    return normalize(vec3(-hx / e, 1.0, -hz / e));
}

void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 ndc = vec2(vUV * 2.0 - 1.0);
    vec3 rayDirCam = normalize(vec3(ndc.x * uTanHalfFov * aspect,
                                    ndc.y * uTanHalfFov,
                                    -1.0));
    vec3 rayOrigin = uCamPos;
    vec3 rayDir = normalize(uCamRot * rayDirCam);

    vec3 res = intersectTerrain(rayOrigin, rayDir, 60.0);
    float t = res.x;
    float mask = res.y;
    float biome = res.z;
    
    // Water Plane Logic
    float tWater = (uWaterLevel - rayOrigin.y) / rayDir.y;
    bool hitWater = false;
    
    if (tWater > 0.0) {
        if (t < 0.0 || tWater < t) {
            t = tWater;
            hitWater = true;
        }
    }
    
    vec3 color;
    
    if (t > 0.0) {
        vec3 p = rayOrigin + rayDir * t;
        
        if (hitWater) {
             float chop;
             vec3 n = waterNormal(p.xz, chop);
             float surfaceOffset = waterHeight(p.xz);
             p.y = uWaterLevel + surfaceOffset; // Lift the point to the displaced surface
             
             HexID waterHex = getHex(p.xz, uHexRadius);
             float hexDist = axialDistance(waterHex.id);
             bool insideGrid = hexDist <= (uGridRadius + 0.1);
             
             float groundH = -6.0;
             float tileBiome = 0.0;
             float dummyMask = 0.0;
             float dummyBiome = 0.0;
             if (insideGrid) {
                 tileBiome = getTileBiome(waterHex.id);
                 vec2 noiseOffset = hash(waterHex.id + vec2(uSeed * 0.1)) * vec2(100.0) + vec2(uSeed);
                 groundH = sampleHeight(waterHex.uv, dummyMask, dummyBiome, false, tileBiome, noiseOffset) * uHeightScale;
             }
             float depth = clamp((uWaterLevel - groundH) * 0.32, 0.0, 1.0);
             
             vec3 terrainColor = vec3(0.0);
             if (insideGrid) {
                 vec3 terrainP = vec3(waterHex.uv.x, groundH, waterHex.uv.y);
                 terrainColor = getBiomeColor(tileBiome, terrainP, vec3(0.0, 1.0, 0.0), groundH, 1.0);
             }
             
             // Shore foam where the ocean meets the hex walls
             float edge = abs(sdHex(waterHex.uv * 1.35, uHexRadius - uGap));
             float foam = insideGrid ? (1.0 - smoothstep(0.06, 0.32, edge)) : 0.0;
             foam *= (0.35 + 0.65 * chop);
             float foamStrength = foam * (0.55 + 0.35 * (1.0 - depth)); // softer and fades with depth
             
             vec3 L = normalize(uLightDir);
             vec3 V = normalize(uCamPos - p);
             vec3 H = normalize(L + V);
             float diff = max(dot(n, L), 0.0);
             float shadow = softShadow(p + n * uEpsilon * 6.0, L, 40.0);
             float fresnel = pow(1.0 - max(dot(V, n), 0.0), 4.0);
             
             vec3 skyRef = colorCielo(reflect(-V, n));
             float terrainView = insideGrid ? mix(0.5, 0.12, depth) : 0.0; // stronger in shallows
             vec3 sceneRef = mix(skyRef, terrainColor, terrainView);
             vec3 deepColor = vec3(0.22, 0.55, 0.62);
             vec3 shallowColor = vec3(0.22, 0.55, 0.62);
             vec3 absorption = mix(shallowColor, deepColor, depth * 0.45 + 0.08);
             vec3 foamColor = vec3(0.55, 0.66, 0.72);
             
             float spec = pow(max(dot(n, H), 0.0), 160.0) * (0.25 + 0.75 * shadow);
             float subsurface = exp(-depth * 0.8) * (0.7 + 0.3 * diff * shadow);
             
             vec3 body = absorption * subsurface;
             body = mix(body, foamColor, foamStrength);
             float reflectMix = fresnel * 0.75 + 0.18;
             color = mix(body, sceneRef, reflectMix) + spec;
             
        } else {
            // Re-calculate precise height for coloring/normals
            // Get local P again
            HexID hex = getHex(p.xz, uHexRadius);
            vec3 localP = vec3(hex.uv.x, p.y, hex.uv.y);
            
            float preciseMask, preciseBiome;
            float tileBiome = getTileBiome(hex.id);
            vec2 noiseOffset = hash(hex.id + vec2(uSeed * 0.1)) * vec2(100.0) + vec2(uSeed);
            
            float preciseH = sampleHeight(localP.xz, preciseMask, preciseBiome, true, tileBiome, noiseOffset) * uHeightScale;
            
            // Calculate normal using SDF gradient (Geometry Normal)
            vec3 n_geo = calcNormal(p);
            // Re-eval SDF components to decide if we hit Wall or Top
            
            float slope = 0.4;
            float r = max(0.0, uHexRadius - p.y * slope); // Clamp radius
            float d_hex_check = (sdHex(localP.xz * 1.35, r) / 1.35) * 0.9; // Use localP
            float d_top_check = (p.y - preciseH) * 0.25; 
            
            bool isWall = d_hex_check > (d_top_check + 0.005); 

            vec3 n;
            vec3 baseColor;
            
            if (isWall) {
                // Tapered Wall
                n = n_geo;
                
                // Better Wall Texture (Triplanar-ish logic)
                vec3 wallColor = vec3(0.40, 0.35, 0.28);
                vec3 darkRock = vec3(0.25, 0.20, 0.15);
                
                // Use y and position for noise to avoid vertical stretching
                // Use LOCAL P for horizontal noise to match tile, but Global P for variation?
                // Let's use localP to keep it looking consistent on clones
                float noiseScale = 3.0;
                float rockNoise = fbm(localP.xy * noiseScale) + fbm(localP.zy * noiseScale);
                
                // Cracks/Strata
                float strata = sin(p.y * 6.0 + rockNoise * 2.0);
                
                baseColor = mix(wallColor, darkRock, smoothstep(-0.2, 0.5, strata));
                baseColor *= mix(0.8, 1.1, rockNoise); // detail
                
            } else {
                // Top Surface
                n = calcTerrainNormal(p); 
                baseColor = getBiomeColor(biome, p, n, preciseH, mask);
            }
            
            // Lighting
            vec3 L = normalize(uLightDir);
            float diff = clamp(dot(n, L), 0.0, 1.0);
            vec3 V = normalize(uCamPos - p);
            vec3 H = normalize(L + V);
            
            float surfSlope = 1.0 - n.y;
            float rough = mix(0.35, 1.0, surfSlope);
            float specExp = mix(22.0, 46.0, 1.0 - rough);
            float spec = pow(max(dot(n, H), 0.0), specExp) * mix(0.15, 0.4, 1.0 - rough);
            float shadow = softShadow(p + n * uEpsilon * 6.0, L, 40.0);
            diff *= shadow;
            spec *= shadow;
            
            vec3 ambient = vec3(0.12, 0.14, 0.16);
            vec3 skyBounce = colorCielo(L) * clamp(0.15 + 0.45 * n.y, 0.0, 0.55);
            float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
            color = baseColor * (ambient + skyBounce + diff * 1.2) + spec + baseColor * rim * 0.15;
        }
    } else {
        color = colorCielo(rayDir);
    }

    gl_FragColor = vec4(color, 1.0);
}
