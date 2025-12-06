const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl");

if (!gl) {
  alert("Tu navegador no soporta WebGL");
  throw new Error("WebGL no disponible");
}

// Vertex shader: altura por bioma con rangos, bordes al mismo nivel
const vertexShaderSource = `
precision mediump float;

attribute vec2 aPosition;
attribute vec3 aColor;
attribute vec3 aBary;
attribute float aBiome;
attribute float aEdge;

uniform mat4 uViewProj;
uniform float uHeightScale;

varying vec3 vColor;
varying vec2 vPlanePos;
varying vec3 vBary;
varying float vBiome;
varying float vHeight;
varying float vEdgeBlend;

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

vec2 biomeRange(float biome) {
  // piedra, arcilla, bosque
  if (biome < 0.5)      return vec2(0.2, 0.3);
  else if (biome < 1.5) return vec2(-0.05, 0.05);
  else                  return vec2(0.05, 0.15);
}

float heightField(float biome, vec2 p, float edgeBlend) {
  vec2 range = biomeRange(biome);
  float n = fbm(p * 2.8);
  float h = range.x + (range.y - range.x) * n;
  return h * edgeBlend;
}

void main() {
  vPlanePos = aPosition;
  vColor = aColor;
  vBary = aBary;
  vBiome = aBiome;
  vEdgeBlend = aEdge;

  float h = heightField(aBiome, aPosition, aEdge) * uHeightScale;
  vHeight = h;

  // Desplazar en Y con la altura para dar volumen real.
  vec3 worldPos = vec3(aPosition.x, h, aPosition.y);
  gl_Position = uViewProj * vec4(worldPos, 1.0);
}
`;

// Utilidades WebGL
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// Datos del tablero
const BOARD_RADIUS = 2;
const HEX_SIZE = 0.32;
const HEX_SUBDIV = 100; // subdivisiones radiales por lado

const terrainOrder = ["piedra", "arcilla", "bosque"];
const terrainColors = {
  piedra: [0.62, 0.64, 0.68],
  arcilla: [0.83, 0.45, 0.20],
  bosque: [0.16, 0.64, 0.30]
};

function terrainType(q, r) {
  const idx = ((q * 1 + r * 2) % terrainOrder.length + terrainOrder.length) % terrainOrder.length;
  return terrainOrder[idx];
}

function axialToWorld(q, r, size) {
  const x = size * Math.sqrt(3) * (q + r * 0.5);
  const y = size * 1.5 * r;
  return [x, y];
}

function buildBoardMesh() {
  const cells = [];
  let maxExtent = 0;

  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    const rMin = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS);
    const rMax = Math.min(BOARD_RADIUS, -q + BOARD_RADIUS);
    for (let r = rMin; r <= rMax; r++) {
      const center = axialToWorld(q, r, HEX_SIZE);
      maxExtent = Math.max(maxExtent, Math.abs(center[0]) + HEX_SIZE, Math.abs(center[1]) + HEX_SIZE);
      cells.push({ q, r, center, terrain: terrainType(q, r) });
    }
  }

  const scale = 0.95 / maxExtent;

  const cornerOffsets = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    cornerOffsets.push([
      Math.cos(angle) * HEX_SIZE * scale,
      Math.sin(angle) * HEX_SIZE * scale
    ]);
  }

  const positions = [];
  const colors = [];
  const bary = [];
  const biomes = [];
  const edges = [];

  for (const cell of cells) {
    const cx = cell.center[0] * scale;
    const cy = cell.center[1] * scale;
    const color = terrainColors[cell.terrain];
    const biomeId = terrainOrder.indexOf(cell.terrain);

    const radius = Math.hypot(cornerOffsets[0][0], cornerOffsets[0][1]);

    for (let i = 0; i < 6; i++) {
      const a = cornerOffsets[i];
      const b = cornerOffsets[(i + 1) % 6];

      for (let s = 0; s < HEX_SUBDIV; s++) {
        const t0 = s / HEX_SUBDIV;
        const t1 = (s + 1) / HEX_SUBDIV;

        const pA0 = [cx + a[0] * t0, cy + a[1] * t0];
        const pA1 = [cx + a[0] * t1, cy + a[1] * t1];
        const pB0 = [cx + b[0] * t0, cy + b[1] * t0];
        const pB1 = [cx + b[0] * t1, cy + b[1] * t1];

        const quad = [pA0, pB0, pA1, pB1];
        const tris = [
          [quad[0], quad[1], quad[2]],
          [quad[2], quad[1], quad[3]]
        ];

        for (const tri of tris) {
          for (const p of tri) {
            positions.push(p[0], p[1]);
            colors.push(...color);
            // distancia al borde para dibujar outline
            const dist = Math.hypot(p[0] - cx, p[1] - cy);
            const edgeFactor = 1.0 - Math.min(dist / radius, 1.0);
            bary.push(edgeFactor, 0, 0);
            biomes.push(biomeId);
            edges.push(edgeFactor);
          }
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    bary: new Float32Array(bary),
    biomes: new Float32Array(biomes),
    edges: new Float32Array(edges),
    count: positions.length / 2
  };
}

function uploadBuffer(gl, attrib, buffer, data, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(attrib);
  gl.vertexAttribPointer(attrib, size, gl.FLOAT, false, 0, 0);
}

let program;
let mesh;
let uEdgeLoc;
let uViewProjLoc;
let uHeightScaleLoc;
let uLightDirLoc;
let vertexCount = 0;

const camera = {
  radius: 2.8,
  yaw: Math.PI * 0.25,
  pitch: 0.35
};

let isDragging = false;
let lastX = 0;
let lastY = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  const sensitivity = 0.005;
  camera.yaw -= dx * sensitivity;
  camera.pitch = Math.min(Math.max(camera.pitch - dy * sensitivity, -1.2), 1.2);
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = 1.0 + e.deltaY * 0.001;
  camera.radius = Math.min(Math.max(camera.radius * zoomFactor, 1.4), 6.0);
}, { passive: false });

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}

function lookAt(eye, target, up) {
  const z = normalize([eye[0]-target[0], eye[1]-target[1], eye[2]-target[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);

  return [
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    - (x[0]*eye[0] + x[1]*eye[1] + x[2]*eye[2]),
    - (y[0]*eye[0] + y[1]*eye[1] + y[2]*eye[2]),
    - (z[0]*eye[0] + z[1]*eye[1] + z[2]*eye[2]),
    1
  ];
}

function perspective(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const rangeInv = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0
  ];
}

function mul4(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c*4 + r] =
        a[0*4 + r] * b[c*4 + 0] +
        a[1*4 + r] * b[c*4 + 1] +
        a[2*4 + r] * b[c*4 + 2] +
        a[3*4 + r] * b[c*4 + 3];
    }
  }
  return out;
}

function render() {
  resize();

  gl.clearColor(0.05, 0.06, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);
  gl.uniform1f(uEdgeLoc, 0.04);

  const aspect = canvas.width / canvas.height;
  const rad = camera.radius;
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);

  const eye = [
    rad * cp * cy,
    rad * sp,
    rad * cp * sy
  ];
  const target = [0, 0.25, 0];
  const up = [0, 1, 0];

  const view = lookAt(eye, target, up);
  const proj = perspective(50, aspect, 0.1, 20);
  const viewProj = mul4(proj, view);

  gl.uniformMatrix4fv(uViewProjLoc, false, viewProj);
  gl.uniform1f(uHeightScaleLoc, 1.0);

  const lightDir = normalize([-0.35, 0.85, 0.3]);
  gl.uniform3f(uLightDirLoc, lightDir[0], lightDir[1], lightDir[2]);

  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  requestAnimationFrame(render);
}

async function start() {
  const inlineFrag = `
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
`;

  let fragSource = inlineFrag;
  try {
    const resp = await fetch("frag.glsl");
    if (resp.ok) {
      fragSource = await resp.text();
    } else {
      console.warn("No se pudo cargar frag.glsl, usando shader inline (status: " + resp.status + ")");
    }
  } catch (e) {
    console.warn("Fetch de frag.glsl falló (probable CORS en file://), usando shader inline.");
  }

  program = createProgram(gl, vertexShaderSource, fragSource);
  if (!program) return;

  gl.useProgram(program);
  uEdgeLoc = gl.getUniformLocation(program, "uEdge");
  uViewProjLoc = gl.getUniformLocation(program, "uViewProj");
  uHeightScaleLoc = gl.getUniformLocation(program, "uHeightScale");
  uLightDirLoc = gl.getUniformLocation(program, "uLightDir");

  mesh = buildBoardMesh();
  vertexCount = mesh.count;

  const aPos = gl.getAttribLocation(program, "aPosition");
  const aColor = gl.getAttribLocation(program, "aColor");
  const aBary = gl.getAttribLocation(program, "aBary");
  const aBiome = gl.getAttribLocation(program, "aBiome");
  const aEdge = gl.getAttribLocation(program, "aEdge");

  uploadBuffer(gl, aPos, gl.createBuffer(), mesh.positions, 2);
  uploadBuffer(gl, aColor, gl.createBuffer(), mesh.colors, 3);
  uploadBuffer(gl, aBary, gl.createBuffer(), mesh.bary, 3);
  uploadBuffer(gl, aBiome, gl.createBuffer(), mesh.biomes, 1);
  uploadBuffer(gl, aEdge, gl.createBuffer(), mesh.edges, 1);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearDepth(1.0);
  gl.disable(gl.CULL_FACE);

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(render);
}

start().catch((err) => {
  console.error(err);
  alert("No se pudo inicializar el tablero");
});
