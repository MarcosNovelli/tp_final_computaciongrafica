
/**
 * main.js - Raytracing Implementation
 * 
 * Renders the hexagonal world using Raymarching (SDFs) by encoding the 
 * world state into a Data Texture.
 */

/* =========================================================================
   CONSTANTS & CONFIG
   ========================================================================= */
const GRID_RADIUS = 12;      // Same as jose
const HEX_RADIUS = 1.0;      // Local space radius
const HEX_RADIUS_WORLD = 1.0; // World space radius
const TEXTURE_SIZE = 128;    // Size of data texture (should fit grid)

// --- HELPER FUNCTIONS (Required by Biomes) ---
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function hexDistance(q1, r1, q2, r2) {
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

function clamp01(val) {
    return Math.max(0, Math.min(1, val));
}

// Initialize Simplex Noise
let noise2D;
if (typeof SimplexNoise !== 'undefined') {
    const simplex = new SimplexNoise();
    noise2D = simplex.noise2D.bind(simplex);
} else {
    console.error("SimplexNoise not loaded");
    noise2D = () => 0; // Fallback
}

// Biome selection (Same logic as jose)
const ACTIVE_BIOME = "Forest";

function getActiveBiome() {
    switch (ACTIVE_BIOME) {
        case "Grass": return grassBiome;
        case "Forest": return forestBiome;
        case "Rock": return rockBiome;
        case "Clay": return clayBiome;
        case "Desert": return desertBiome;
        default: return grassBiome;
    }
}

/* =========================================================================
   SHADERS (Raymarching)
   ========================================================================= */

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform sampler2D u_dataTexture;   // RGB: [Height, Type, WaterFlag]
  uniform sampler2D u_colorTexture;  // RGB: Color
  uniform vec2 u_resolution;
  uniform float u_time;
  
  // Camera
  uniform vec3 u_cameraPos;
  uniform vec3 u_cameraDir;
  uniform vec3 u_cameraUp;
  uniform vec3 u_cameraRight;
  uniform float u_fov; // tan(fov/2)

  // Constants
  const float HEX_R = 1.0;
  const float GRID_R = 12.0; // Must match JS
  const float TEXTURE_SIZE = 128.0;
  
  // Primitives
  
  // Signed Distance Function for Hexagon Prism
  // p: point, h: height, r: radius
  float sdHexPrism(vec3 p, vec2 h) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.5773531); // sin(60), cos(60), tan(30)
    p = abs(p);
    p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
    vec2 d = vec2(
       length(p.xy - vec2(clamp(p.x, -k.z*h.x, k.z*h.x), h.x))*sign(p.y - h.x),
       p.z - h.y 
    );
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  
  // Hexagonal coordinates helper
  // Returns axial coords (q, r) for a standard flat-topped hex grid
  // Note: logic adapted for 3D world space (x, z plane)
  // Our grid: flat topped? 
  // Jose logic: x = size * 3/2 * q, z = size * sqrt(3) * (r + q/2)
  // Inverting this:
  // q = 2/3 * x / size
  // r = (-1/3 * x + sqrt(3)/3 * z) / size
  
  vec2 worldToAxial(vec2 p) {
      float q = (2.0/3.0 * p.x) / HEX_R;
      float r = (-1.0/3.0 * p.x + sqrt(3.0)/3.0 * p.y) / HEX_R;
      return vec2(q, r);
  }
  
  vec3 axialToCube(vec2 hex) {
      float x = hex.x;
      float z = hex.y;
      float y = -x - z;
      return vec3(x, y, z);
  }
  
  vec2 cubeToAxial(vec3 cube) {
      return cube.xz;
  }
  
  vec2 roundHex(vec2 hex) {
      vec3 cube = axialToCube(hex);
      vec3 rounded = floor(cube + 0.5);
      vec3 diff = abs(rounded - cube);
      
      if (diff.x > diff.y && diff.x > diff.z) {
          rounded.x = -rounded.y - rounded.z;
      } else if (diff.y > diff.z) {
          rounded.y = -rounded.x - rounded.z;
      } else {
          rounded.z = -rounded.x - rounded.y;
      }
      return cubeToAxial(rounded);
  }
  
  // Texture sampling helper
  // Map axial (q, r) to UV coordinates (0..1)
  // Valid range for q,r is approx -GRID_R to +GRID_R
  // Texture is centered at 0.5, 0.5
  vec2 axialToUV(vec2 axial) {
      vec2 centered = axial + vec2(TEXTURE_SIZE * 0.5);
      return (centered + 0.5) / TEXTURE_SIZE; // +0.5 to sample pixel center
  }

  // Get cell data: x=height, y=type, z=isWater
  vec3 getCellData(vec2 axial) {
      vec2 uv = axialToUV(axial);
      // Check bounds to avoid texture repeat artifacts
      if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
      return texture2D(u_dataTexture, uv).xyz;
  }
  
  vec3 getCellColor(vec2 axial) {
      vec2 uv = axialToUV(axial);
      return texture2D(u_colorTexture, uv).xyz;
  }

  // SDF for a single tree
  float sdTree(vec3 p) {
    // Trunk: Hex prism, very thin
    float trunk = sdHexPrism(p, vec2(0.06, 0.25)); // r=0.06, h=0.25 (total height 0.5)
    
    // Crown: 3 Cones approximated (SDF cone is expensive, using spheres/ellipsoids for speed/style?)
    // Actually, let's use a simple capsule or ellipsoid for performance in raymarching
    // Tree crown starts at y=0.5
    vec3 cp = p - vec3(0.0, 0.75, 0.0); // center of crown approx
    // Sphere approximation for low poly look? Let's use an ellipsoid for the "clump"
    float d = length((cp)/vec3(0.3, 0.5, 0.3)) - 1.0;
    d = d * 0.3; // scale distance back
    
    return min(trunk, d);
  }
  
  // Main Map Function
  // Returns vec2(distance, material_id)
  // Material 0: Empty/Sky
  // Material 1: Terrain
  // Material 2: Water
  // Material 3: TreeTrunk
  // Material 4: TreeCrown
  
  vec2 map(vec3 p) {
      // 1. Terrain Check (Hex Grid)
      // Determine which hex we are over
      vec2 hex = roundHex(worldToAxial(p.xz));
      
      // Fetch Data
      vec3 data = getCellData(hex);
      float cellHeight = data.x;
      float type = data.y; // 0=None, 1=Tree, 2=Sheep
      float isWater = data.z;
      
      // Calculate local coordinates within the hex
      // Center of hex in world space:
      float cx = HEX_R * 3.0/2.0 * hex.x;
      float cy = HEX_R * sqrt(3.0) * (hex.y + hex.x/2.0);
      vec3 cellCenter = vec3(cx, 0.0, cy);
      vec3 localP = p - cellCenter;
      
      // --- TERRAIN ---
      // Hexagon Prism SDF
      // Height is in Y. Our prism function takes h.y as half-height.
      // But our cellHeight implies total height from 0.
      float h = max(cellHeight, 0.01);
      
      // We need to shift p.y so that the base is at 0
      // sdHexPrism is centered at origin.
      // Shift logic: p.y - h/2.0
      
      // Adjust hex radius slightly for gap
      float hexDist = sdHexPrism(vec3(localP.x, p.y - h * 0.5, localP.z), vec2(HEX_R * 0.95, h * 0.5));
      
      // --- WATER ---
      float waterDist = 1000.0;
      if (isWater > 0.5) {
         // Water plane at cellHeight (approx) slightly lower/higher?
         // Let's say water is a flat plane at y = cellHeight * 0.8? 
         // Implementation: Simple plane SDF
         // Actually, if it's water, the "terrain" is the water volume for now for simplicity
         // Material 2 = Water
      }
      
      // --- TREES ---
      float treeDist = 1000.0;
      if (type > 0.5 && type < 1.5) { // Tree flag
          // Tree sits on top of terrain
          vec3 treeP = localP - vec3(0.0, h, 0.0);
          treeDist = sdTree(treeP);
      }
      
      // Result Combination
      float d = hexDist;
      float mat = isWater > 0.5 ? 2.0 : 1.0;
      
      if (treeDist < d) {
          d = treeDist;
          mat = 3.0; // Tree
      }
     
     // Bounding Box optimization: If far from grid, return simple distance
     if (length(p.xz) > (GRID_R + 2.0) * HEX_R * 1.5) {
         return vec2(length(p.xz) - GRID_R * HEX_R, 0.0);
     }
      
      return vec2(d, mat);
  }

  // Normals via Gradient
  vec3 calcNormal(vec3 p) {
      const float h = 0.001;
      const vec2 k = vec2(1,-1);
      return normalize(k.xyy*map(p + k.xyy*h).x + 
                       k.yyx*map(p + k.yyx*h).x + 
                       k.yxy*map(p + k.yxy*h).x + 
                       k.xxx*map(p + k.xxx*h).x);
  }
  
  // Shadows (Soft)
  float calcSoftShadow(vec3 ro, vec3 rd, float mint, float tmax) {
    float res = 1.0;
    float t = mint;
    for(int i=0; i<16; i++) {
        float h = map(ro + rd*t).x;
        res = min(res, 8.0*h/t);
        t += clamp(h, 0.02, 0.10);
        if(res<0.005 || t>tmax) break;
    }
    return clamp(res, 0.0, 1.0);
  }

  void main() {
    float aspectRatio = u_resolution.x / u_resolution.y;
    vec2 uv = v_uv * 2.0 - 1.0; // -1 to 1
    uv.x *= aspectRatio;
    
    // Ray setup
    vec3 ro = u_cameraPos;
    vec3 forward = normalize(u_cameraDir);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward)); // Assume Y up
    vec3 up = cross(forward, right);
    
    // FOV adjustment
    // vec3 rd = normalize(forward + uv.x * right * 0.5 + uv.y * up * 0.5); // approx
    // Better: use u_cameraRight/Up passed from JS which scales with FOV
    vec3 rd = normalize(u_cameraDir + (u_cameraRight * uv.x) + (u_cameraUp * uv.y));
    
    // Raymarching
    float t = 0.0;
    float tMax = 100.0;
    vec2 res = vec2(-1.0, 0.0);
    
    for(int i=0; i<128; i++) {
        vec3 p = ro + rd * t;
        res = map(p);
        if(res.x < 0.001 || t > tMax) break;
        t += res.x;
    }
    
    vec3 col = vec3(0.53, 0.81, 0.92); // Sky
    
    if (t < tMax) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 sunDir = normalize(vec3(0.6, 1.0, 0.4));
        
        // Materials
        vec3 baseColor = vec3(0.5);
        float material = res.y;
        
        if (material == 1.0 || material == 2.0) { // Terrain or Water
           vec2 hex = roundHex(worldToAxial(p.xz));
           baseColor = getCellColor(hex);
        } else if (material == 3.0) { // Tree
           if (p.y > getCellData(roundHex(worldToAxial(p.xz))).x + 0.5) 
              baseColor = vec3(0.1, 0.6, 0.1); // Green Crown
           else
              baseColor = vec3(0.4, 0.3, 0.2); // Brown Trunk
        }
        
        // Lighting
        float diff = max(dot(n, sunDir), 0.0);
        
        // Shadows
        float shadow = calcSoftShadow(p + n*0.01, sunDir, 0.02, 5.0);
        
        vec3 ambient = vec3(0.7, 0.75, 0.8) * 0.4;
        vec3 sunLight = vec3(1.0, 0.95, 0.9) * diff * 1.0 * shadow;
        
        // Matte Lighting (Wrapped Diffuse) for Terrain
        if (material == 1.0) {
            float ndotl = max(dot(n, sunDir), 0.0);
            float wrap = ndotl * 0.7 + 0.3;
            col = baseColor * (ambient + vec3(1.0, 0.95, 0.9) * wrap * shadow);
        } 
        // Water Lighting (Phong + Fresnel)
        else if (material == 2.0) {
            vec3 diffuse = baseColor * (0.5 + diff * 0.5);
            vec3 v = normalize(u_cameraPos - p);
            float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
            vec3 skyRef = vec3(0.8, 0.9, 0.95);
            vec3 r = reflect(-sunDir, n);
            float spec = pow(max(dot(r, v), 0.0), 60.0) * 0.6 * shadow;
            col = mix(diffuse, skyRef, fresnel * 0.6) + spec;
        }
        // Simple lighting for trees
        else {
             col = baseColor * (ambient + sunLight);
        }
        
    }
    
    // Gamma
    col = pow(col, vec3(1.0/2.2));
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* =========================================================================
   JS LOGIC
   ========================================================================= */

// --- HEX HELPERS (Same as jose/main.js logic) ---
// Note: We need axial to pixel conversion exactly like original to match visual
function hexToPixel(q, r) {
    const x = HEX_RADIUS_WORLD * 3 / 2 * q;
    const z = HEX_RADIUS_WORLD * Math.sqrt(3) * (r + q / 2);
    return { x, z };
}

// --- WORLD GENERATION (Simplified port) ---
function createWorldData(biome) {
    const cells = [];
    const mapData = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4); // Height, Type, Water, Unused
    const colorData = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4); // R, G, B, A

    // Initialize with empty
    mapData.fill(0);
    colorData.fill(0);

    // Generate Cells
    // Use same Spiral or Loop logic as original
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
        const r1 = Math.max(-GRID_RADIUS, -q - GRID_RADIUS);
        const r2 = Math.min(GRID_RADIUS, -q + GRID_RADIUS);
        for (let r = r1; r <= r2; r++) {
            // Logic from jose createCells
            const { x, z } = hexToPixel(q, r);

            // Height
            let h = 0;
            let isWater = false;
            let heightColor = [0.5, 0.5, 0.5];

            // Use Biome Functions (Assume they are loaded globally)
            if (biome.name === "Desert") {
                // Simplified manual logic for now or call biome function if possible
                // Let's reimplement basic noise for robustness here since we can't easily call internal shader logic from JS
                // Using simplex noise lib
                const nx = x * 0.1;
                const nz = z * 0.1;
                h = noise2D(nx, nz) * 0.5 + 0.5; // 0..1
                h = h * (biome.maxHeight - biome.minHeight) + biome.minHeight;

                // Color
                const t = h / biome.maxHeight;
                heightColor = [0.9 + t * 0.1, 0.8 + t * 0.1, 0.5 + t * 0.1]; // Sand
            } else {
                // Default/Forest/Grass
                const nx = x * biome.noiseScale;
                const nz = z * biome.noiseScale;
                h = noise2D(nx, nz); // -1..1
                h = (h + 1) * 0.5; // 0..1
                h = Math.pow(h, biome.heightExponent || 1.0);
                h = h * (biome.maxHeight - biome.minHeight) + biome.minHeight;

                // Water
                if (biome.waterLevel !== undefined && h < biome.waterLevel) {
                    h = biome.waterLevel * 0.8; // Flatten water bed
                    isWater = true;
                    heightColor = biome.waterColor || [0.2, 0.4, 0.8];
                } else {
                    // Mix colors
                    heightColor = biome.baseColor || [0.2, 0.8, 0.2];
                }
            }

            // Store Cell
            cells.push({ q, r, h, isWater, color: heightColor });

            // Write to Texture Data
            // Map (q, r) to UV space (0..TEXTURE_SIZE)
            // Center q=0, r=0 at 64, 64
            const tx = q + TEXTURE_SIZE / 2;
            const ty = r + TEXTURE_SIZE / 2;

            if (tx >= 0 && tx < TEXTURE_SIZE && ty >= 0 && ty < TEXTURE_SIZE) {
                const idx = (Math.floor(ty) * TEXTURE_SIZE + Math.floor(tx)) * 4;
                mapData[idx + 0] = h;
                mapData[idx + 1] = 0.0; // Type (filled later)
                mapData[idx + 2] = isWater ? 1.0 : 0.0;
                mapData[idx + 3] = 1.0;

                colorData[idx + 0] = heightColor[0];
                colorData[idx + 1] = heightColor[1];
                colorData[idx + 2] = heightColor[2];
                colorData[idx + 3] = 1.0;
            }
        }
    }

    // Trees
    const treeCount = Math.floor(cells.length * (biome.treeDensity || 0.1));
    for (let i = 0; i < treeCount; i++) {
        const cell = cells[Math.floor(Math.random() * cells.length)];
        if (!cell.isWater) {
            const tx = cell.q + TEXTURE_SIZE / 2;
            const ty = cell.r + TEXTURE_SIZE / 2;
            const idx = (Math.floor(ty) * TEXTURE_SIZE + Math.floor(tx)) * 4;
            mapData[idx + 1] = 1.0; // Tree Type
        }
    }

    return { mapData, colorData };
}

/* =========================================================================
   MAIN
   ========================================================================= */

async function main() {
    const canvas = document.getElementById('glCanvas');
    const gl = canvas.getContext('webgl');
    if (!gl) { alert("WebGL not supported"); return; }

    // Extension for float textures
    gl.getExtension('OES_texture_float');

    // Shaders
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);

    // Fullscreen Quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Generate Data
    const biome = getActiveBiome();
    const { mapData, colorData } = createWorldData(biome);

    // Create Textures
    const mapTex = createDataTexture(gl, mapData, TEXTURE_SIZE, 0);
    const colTex = createDataTexture(gl, colorData, TEXTURE_SIZE, 1);

    // Uniforms
    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uData = gl.getUniformLocation(program, "u_dataTexture");
    const uColorLoc = gl.getUniformLocation(program, "u_colorTexture");

    gl.uniform1i(uData, 0);
    gl.uniform1i(uColorLoc, 1);

    // Camera State
    let camRadius = 25.0;
    let camTheta = 0.5; // Pitch
    let camPhi = 0.0;   // Yaw

    // Camera Uniforms
    const uCamPos = gl.getUniformLocation(program, "u_cameraPos");
    const uCamDir = gl.getUniformLocation(program, "u_cameraDir");
    const uCamUp = gl.getUniformLocation(program, "u_cameraUp");
    const uCamRight = gl.getUniformLocation(program, "u_cameraRight");

    // Input
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') camPhi -= 0.1;
        if (e.key === 'ArrowRight') camPhi += 0.1;
        if (e.key === 'ArrowUp') camTheta = Math.max(0.1, camTheta - 0.1);
        if (e.key === 'ArrowDown') camTheta = Math.min(1.5, camTheta + 0.1);
    });

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    function render(time) {
        gl.uniform1f(uTime, time * 0.001);

        // Camera Matrix
        const y = camRadius * Math.cos(camTheta);
        const h = camRadius * Math.sin(camTheta);
        const x = h * Math.sin(camPhi);
        const z = h * Math.cos(camPhi);

        const pos = [x, y, z];
        const target = [0, 0, 0];
        const up = [0, 1, 0];

        // LookAt
        const f = normalizeVec3(subVec3(target, pos)); // Forward
        const r = normalizeVec3(crossVec3(up, f)); // Right (note: cross order matters depending on coord system)
        // Actually standard is Right = Cross(Forward, Up) if Forward is Z-. 
        // Here Forward is Target - Pos. 
        // GLM lookAt uses F = target - eye. 
        // s = cross(f, up). u = cross(s, f).
        // Let's manually compute vectors to pass to shader
        const s = normalizeVec3(crossVec3(f, up));
        const u = crossVec3(s, f);

        // Scale by FOV aspect
        const fovY = 60 * Math.PI / 180;
        const tanHalfFov = Math.tan(fovY / 2);
        const aspect = canvas.width / canvas.height;

        // RayDir = Forward + uv.x * Right * tanHalf * aspect + uv.y * Up * tanHalf
        // Pre-scale Right and Up vectors
        const scaleRight = [s[0] * tanHalfFov * aspect, s[1] * tanHalfFov * aspect, s[2] * tanHalfFov * aspect];
        const scaleUp = [u[0] * tanHalfFov, u[1] * tanHalfFov, u[2] * tanHalfFov];

        gl.uniform3fv(uCamPos, pos);
        gl.uniform3fv(uCamDir, f);
        gl.uniform3fv(uCamRight, scaleRight);
        gl.uniform3fv(uCamUp, scaleUp);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

// Helper: Create Float Texture
function createDataTexture(gl, data, size, unit) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
}

// Math Helpers
function normalizeVec3(v) {
    const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
}
function subVec3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function crossVec3(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// Start
main();
