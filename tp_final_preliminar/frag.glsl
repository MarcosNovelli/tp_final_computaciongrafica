precision highp float;
varying vec2 vUV;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamDir;
uniform vec3 uCamUp;
uniform float uFov;
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
// Fractal Brownian Motion
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
// --- Raymarching ---
// Map function: defines the world
// Returns distance to the surface (or height difference for terrain)
float map(vec3 p) {
    // Terrain height at position p.xz
    float h = fbm(p.xz * 0.5) * 4.0; 
    // We want to find where p.y intersects h. 
    // For raymarching terrain, we often use p.y - h as a signed distance approximation
    // But exact SDF for heightmap is hard. 
    // We will use a simple step approach in the march loop for robustness or 
    // just p.y - h * 0.5 (lipschitz bound)
    return p.y - h;
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
        
        t += d * 0.4; // Step size multiplier
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
        
        // Simple lighting
        vec3 lightDir = normalize(vec3(0.5, 0.8, 0.2));
        float diff = max(dot(n, lightDir), 0.0);
        
        // Color based on height
        vec3 terrainColor = mix(vec3(0.1, 0.4, 0.1), vec3(0.6, 0.5, 0.4), smoothstep(0.0, 3.0, p.y));
        
        col = terrainColor * (diff * 0.8 + 0.2); // Diffuse + Ambient
        
        // Fog
        float fogAmount = 1.0 - exp(-t * 0.02);
        vec3 fogColor = vec3(0.5, 0.7, 0.9);
        col = mix(col, fogColor, fogAmount);
    } else {
        // Sky
        col = vec3(0.5, 0.7, 0.9) - rd.y * 0.2;
    }
    gl_FragColor = vec4(col, 1.0);
}