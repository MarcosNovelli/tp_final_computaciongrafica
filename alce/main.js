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
attribute vec2 aCellCenter;

uniform mat4 uViewProj;
uniform float uHeightScale;

varying vec3 vColor;
varying vec2 vPlanePos;
varying vec2 vLocalPos;
varying vec2 vCellCenter;
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

float heightField(float biome, vec2 worldPos, vec2 localPos, vec2 cellCenter, float edgeBlend) {
  vec2 range = biomeRange(biome);
  float macro = fbm(worldPos * 0.55);
  float mid = fbm(worldPos * 1.8);
  float seed = hash21(cellCenter * 19.17) * 6.2831;
  float fine = fbm(localPos * 5.0 + seed);
  float detail = fbm(localPos * 12.0 + seed * 1.37);
  float n = clamp(macro * 0.35 + mid * 0.35 + fine * 0.2 + detail * 0.1, 0.0, 1.0);
  float h = mix(range.x, range.y, n);
  return h * edgeBlend;
}

void main() {
  vPlanePos = aPosition;
  vLocalPos = aPosition - aCellCenter;
  vCellCenter = aCellCenter;
  vColor = aColor;
  vBary = aBary;
  vBiome = aBiome;
  vEdgeBlend = aEdge;

  float h = heightField(aBiome, aPosition, vLocalPos, aCellCenter, aEdge) * uHeightScale;
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
const HEX_SIZE = 10;
const HEX_SUBDIV = 6; // subdivisiones radiales por lado
const HEIGHT_SCALE = 1.0;

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
  const cellInfo = [];
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
  const centers = [];
  const radius = Math.hypot(cornerOffsets[0][0], cornerOffsets[0][1]);

  for (const cell of cells) {
    const cx = cell.center[0] * scale;
    const cy = cell.center[1] * scale;
    const color = terrainColors[cell.terrain];
    const biomeId = terrainOrder.indexOf(cell.terrain);
    cellInfo.push({ center: [cx, cy], biomeId });

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
            centers.push(cx, cy);
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
    centers: new Float32Array(centers),
    count: positions.length / 2,
    cells: cellInfo,
    hexRadius: radius,
    scale
  };
}

function uploadBuffer(gl, attrib, buffer, data, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(attrib);
  gl.vertexAttribPointer(attrib, size, gl.FLOAT, false, 0, 0);
  return buffer;
}

function jsHash21(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function jsNoise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = jsHash21(ix, iy);
  const b = jsHash21(ix + 1, iy);
  const c = jsHash21(ix, iy + 1);
  const d = jsHash21(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

function jsFbm(x, y) {
  let v = 0;
  let f = 1;
  let a = 1;
  for (let i = 0; i < 4; i++) {
    v += jsNoise2(x * f, y * f) * a;
    f *= 2.2;
    a *= 0.55;
  }
  return v;
}

function jsBiomeRange(biome) {
  if (biome < 0.5) return [0.2, 0.3];
  if (biome < 1.5) return [-0.05, 0.05];
  return [0.05, 0.15];
}

function jsHeightField(biome, worldPos, localPos, cellCenter, edgeBlend) {
  const range = jsBiomeRange(biome);
  const macro = jsFbm(worldPos[0] * 0.55, worldPos[1] * 0.55);
  const mid = jsFbm(worldPos[0] * 1.8, worldPos[1] * 1.8);
  const seed = jsHash21(cellCenter[0] * 19.17, cellCenter[1] * 19.17) * 6.2831;
  const fine = jsFbm(localPos[0] * 5 + seed, localPos[1] * 5 + seed);
  const detail = jsFbm(localPos[0] * 12 + seed * 1.37, localPos[1] * 12 + seed * 1.37);
  const n = Math.min(Math.max(macro * 0.35 + mid * 0.35 + fine * 0.2 + detail * 0.1, 0), 1);
  return (range[0] + (range[1] - range[0]) * n) * edgeBlend;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

let program;
let mesh;
let uEdgeLoc;
let uViewProjLoc;
let uHeightScaleLoc;
let uLightDirLoc;
let vertexCount = 0;
let terrainAttribs = {};
let terrainBuffers = {};

let treeProgram;
let treeViewProjLoc;
let treeLightDirLoc;
let treeVertexCount = 0;
let treeAttribs = {};
let treeBuffers = {};

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

function rotateY(vec, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    vec[0] * c - vec[2] * s,
    vec[1],
    vec[0] * s + vec[2] * c
  ];
}

function transformY(vec, angle, offset, scale = 1) {
  const r = rotateY([vec[0] * scale, vec[1] * scale, vec[2] * scale], angle);
  return [r[0] + offset[0], r[1] + offset[1], r[2] + offset[2]];
}

function normalFromPoints(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return normalize(cross(ab, ac));
}

function pushTriangle(outPos, outNorm, outCol, a, b, c, color) {
  const n = normalFromPoints(a, b, c);
  outPos.push(...a, ...b, ...c);
  outNorm.push(...n, ...n, ...n);
  outCol.push(...color, ...color, ...color);
}

function pushQuad(outPos, outNorm, outCol, a, b, c, d, color) {
  pushTriangle(outPos, outNorm, outCol, a, b, c, color);
  pushTriangle(outPos, outNorm, outCol, a, c, d, color);
}

function addFallbackTree(basePos, angle, scale, outPos, outNorm, outCol) {
  const trunkHeight = 0.18 * scale;
  const trunkWidth = 0.05 * scale;
  const leafHeight = 0.32 * scale;
  const leafRadius = 0.16 * scale;

  const trunkColor = [0.36, 0.24, 0.14];
  const leafColor = [0.12, 0.44, 0.18];

  const y0 = 0;
  const y1 = trunkHeight;
  const hw = trunkWidth * 0.5;
  const hd = trunkWidth * 0.5;

  const front = [
    [-hw, y0, hd],
    [ hw, y0, hd],
    [ hw, y1, hd],
    [-hw, y1, hd]
  ];
  const back = [
    [-hw, y0, -hd],
    [-hw, y1, -hd],
    [ hw, y1, -hd],
    [ hw, y0, -hd]
  ];
  const left = [
    [-hw, y0, -hd],
    [-hw, y0,  hd],
    [-hw, y1,  hd],
    [-hw, y1, -hd]
  ];
  const right = [
    [ hw, y0, -hd],
    [ hw, y1, -hd],
    [ hw, y1,  hd],
    [ hw, y0,  hd]
  ];
  const top = [
    [-hw, y1, -hd],
    [-hw, y1,  hd],
    [ hw, y1,  hd],
    [ hw, y1, -hd]
  ];

  const transformFace = (face) => face.map((v) => transformY(v, angle, basePos));
  pushQuad(outPos, outNorm, outCol, ...transformFace(front), trunkColor);
  pushQuad(outPos, outNorm, outCol, ...transformFace(back), trunkColor);
  pushQuad(outPos, outNorm, outCol, ...transformFace(left), trunkColor);
  pushQuad(outPos, outNorm, outCol, ...transformFace(right), trunkColor);
  pushQuad(outPos, outNorm, outCol, ...transformFace(top), trunkColor);

  const leafBase = y1;
  const tip = transformY([0, leafBase + leafHeight, 0], angle, basePos);
  const b0 = transformY([-leafRadius, leafBase, -leafRadius], angle, basePos);
  const b1 = transformY([ leafRadius, leafBase, -leafRadius], angle, basePos);
  const b2 = transformY([ leafRadius, leafBase,  leafRadius], angle, basePos);
  const b3 = transformY([-leafRadius, leafBase,  leafRadius], angle, basePos);

  pushTriangle(outPos, outNorm, outCol, b0, b1, tip, leafColor);
  pushTriangle(outPos, outNorm, outCol, b1, b2, tip, leafColor);
  pushTriangle(outPos, outNorm, outCol, b2, b3, tip, leafColor);
  pushTriangle(outPos, outNorm, outCol, b3, b0, tip, leafColor);
  pushQuad(outPos, outNorm, outCol, b0, b1, b2, b3, leafColor);
}

function parseOBJ(text) {
  const verts = [];
  const norms = [];
  let minY = Infinity;
  let maxY = -Infinity;
  let maxRadius = 0;

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      verts.push([x, y, z]);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      maxRadius = Math.max(maxRadius, Math.hypot(x, z));
    } else if (line.startsWith("vn ")) {
      const parts = line.split(/\s+/);
      norms.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    }
  }

  const height = maxY - minY || 1;
  const trunkColor = [0.36, 0.24, 0.14];
  const leafColor = [0.12, 0.44, 0.18];

  const outPos = [];
  const outNorm = [];
  const outCol = [];

  const getVert = (token) => {
    const parts = token.split("/");
    let vi = parseInt(parts[0], 10);
    if (Number.isNaN(vi)) return null;
    if (vi < 0) vi = verts.length + vi + 1;
    vi -= 1;
    const pos = verts[vi];

    let ni = parts.length > 2 && parts[2] !== "" ? parseInt(parts[2], 10) : null;
    if (ni !== null) {
      if (ni < 0) ni = norms.length + ni + 1;
      ni -= 1;
    }
    const norm = ni !== null && norms[ni] ? norms[ni] : [0, 1, 0];
    return { pos, norm };
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("f ")) continue;
    const parts = line.split(/\s+/).slice(1);
    if (parts.length < 3) continue;

    const v0Tok = parts[0];
    for (let i = 1; i + 1 < parts.length; i++) {
      const v1Tok = parts[i];
      const v2Tok = parts[i + 1];
      const v0 = getVert(v0Tok);
      const v1 = getVert(v1Tok);
      const v2 = getVert(v2Tok);
      if (!v0 || !v1 || !v2) continue;

      const vertsTri = [v0, v1, v2];
      for (const v of vertsTri) {
        const yNorm = (v.pos[1] - minY) / height;
        const t = smoothstep(0.32, 0.6, yNorm);
        const color = [
          trunkColor[0] + (leafColor[0] - trunkColor[0]) * t,
          trunkColor[1] + (leafColor[1] - trunkColor[1]) * t,
          trunkColor[2] + (leafColor[2] - trunkColor[2]) * t
        ];
        outPos.push(v.pos[0], v.pos[1], v.pos[2]);
        outNorm.push(v.norm[0], v.norm[1], v.norm[2]);
        outCol.push(color[0], color[1], color[2]);
      }
    }
  }

  return {
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNorm),
    colors: new Float32Array(outCol),
    minY,
    height,
    radius: maxRadius
  };
}

async function loadMapleModel() {
  try {
    const resp = await fetch("MapleTree.obj");
    if (!resp.ok) throw new Error("status " + resp.status);
    const text = await resp.text();
    const model = parseOBJ(text);
    console.log("MapleTree.obj cargado, vertices:", model.positions.length / 3);
    return model;
  } catch (err) {
    console.warn("No se pudo cargar MapleTree.obj, se usará árbol simple.", err);
    return null;
  }
}

function addModelInstance(model, basePos, angle, scale, outPos, outNorm, outCol) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const yOffset = basePos[1] - model.minY * scale;

  for (let i = 0; i < model.positions.length; i += 3) {
    const px = model.positions[i] * scale;
    const py = model.positions[i + 1] * scale;
    const pz = model.positions[i + 2] * scale;
    const rx = px * c - pz * s;
    const rz = px * s + pz * c;
    outPos.push(basePos[0] + rx, yOffset + py, basePos[2] + rz);

    const nx = model.normals[i];
    const ny = model.normals[i + 1];
    const nz = model.normals[i + 2];
    const rnx = nx * c - nz * s;
    const rnz = nx * s + nz * c;
    outNorm.push(rnx, ny, rnz);

    outCol.push(model.colors[i], model.colors[i + 1], model.colors[i + 2]);
  }
}

function buildTreeMesh(cellInfo, hexRadius, baseModel) {
  const positions = [];
  const normals = [];
  const colors = [];
  const forestId = terrainOrder.indexOf("bosque");

  for (const cell of cellInfo) {
    if (cell.biomeId !== forestId) continue;

    const baseSeed = jsHash21(cell.center[0] * 37.17, cell.center[1] * 91.7);
    const usingModel = !!baseModel;
    const treeCount = usingModel ? 1 + Math.floor(baseSeed * 1.2) : 2 + Math.floor(baseSeed * 2.0);

    for (let i = 0; i < treeCount; i++) {
      const seedRot = jsHash21(cell.center[0] + i * 1.37, cell.center[1] - i * 2.17);
      const seedOff = jsHash21(cell.center[0] * 3.11 + i * 5.31, cell.center[1] * 4.71 - i * 1.87);
      const seedSize = jsHash21(cell.center[0] * 12.3 + i * 7.1, cell.center[1] * 6.7 - i * 3.3);

      const angle = seedRot * Math.PI * 2;
      const offsetRadius = (0.18 + 0.35 * seedOff) * hexRadius;
      const offset = [
        Math.cos(angle) * offsetRadius,
        Math.sin(angle) * offsetRadius
      ];

      const distFromCenter = Math.hypot(offset[0], offset[1]);
      const edgeBlend = 1.0 - Math.min(distFromCenter / hexRadius, 1.0);

      const worldPos = [cell.center[0] + offset[0], cell.center[1] + offset[1]];
      const localPos = [offset[0], offset[1]];
      const baseHeight = jsHeightField(cell.biomeId, worldPos, localPos, cell.center, edgeBlend) * HEIGHT_SCALE;
      const base = [worldPos[0], baseHeight, worldPos[1]];

      if (usingModel) {
        const targetHeight = hexRadius * (0.3 + 0.6 * seedSize);
        const scale = targetHeight / Math.max(baseModel.height, 0.001);
        addModelInstance(baseModel, base, angle, scale, positions, normals, colors);
      } else {
        const treeScale = 0.45 + 0.35 * seedSize;
        addFallbackTree(base, angle, treeScale, positions, normals, colors);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    count: positions.length / 3
  };
}

function bindTerrainAttributes() {
  if (!terrainBuffers.position) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffers.position);
  gl.enableVertexAttribArray(terrainAttribs.position);
  gl.vertexAttribPointer(terrainAttribs.position, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffers.color);
  gl.enableVertexAttribArray(terrainAttribs.color);
  gl.vertexAttribPointer(terrainAttribs.color, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffers.bary);
  gl.enableVertexAttribArray(terrainAttribs.bary);
  gl.vertexAttribPointer(terrainAttribs.bary, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffers.biome);
  gl.enableVertexAttribArray(terrainAttribs.biome);
  gl.vertexAttribPointer(terrainAttribs.biome, 1, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffers.edge);
  gl.enableVertexAttribArray(terrainAttribs.edge);
  gl.vertexAttribPointer(terrainAttribs.edge, 1, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffers.center);
  gl.enableVertexAttribArray(terrainAttribs.center);
  gl.vertexAttribPointer(terrainAttribs.center, 2, gl.FLOAT, false, 0, 0);
}

function bindTreeAttributes() {
  if (!treeBuffers.position) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, treeBuffers.position);
  gl.enableVertexAttribArray(treeAttribs.position);
  gl.vertexAttribPointer(treeAttribs.position, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, treeBuffers.normal);
  gl.enableVertexAttribArray(treeAttribs.normal);
  gl.vertexAttribPointer(treeAttribs.normal, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, treeBuffers.color);
  gl.enableVertexAttribArray(treeAttribs.color);
  gl.vertexAttribPointer(treeAttribs.color, 3, gl.FLOAT, false, 0, 0);
}

function render() {
  resize();

  gl.clearColor(0.05, 0.06, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);
  bindTerrainAttributes();
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
  gl.uniform1f(uHeightScaleLoc, HEIGHT_SCALE);

  const lightDir = normalize([-0.35, 0.85, 0.3]);
  gl.uniform3f(uLightDirLoc, lightDir[0], lightDir[1], lightDir[2]);

  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

  if (treeProgram && treeVertexCount > 0) {
    gl.useProgram(treeProgram);
    bindTreeAttributes();
    gl.uniformMatrix4fv(treeViewProjLoc, false, viewProj);
    gl.uniform3f(treeLightDirLoc, lightDir[0], lightDir[1], lightDir[2]);
    gl.drawArrays(gl.TRIANGLES, 0, treeVertexCount);
  }
  requestAnimationFrame(render);
}

async function start() {
  const inlineFrag = `
precision mediump float;

varying vec3 vColor;
varying vec2 vPlanePos;
varying vec2 vLocalPos;
varying vec2 vCellCenter;
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

vec2 biomeRange(float biome) {
  if (biome < 0.5)      return vec2(0.2, 0.3);
  else if (biome < 1.5) return vec2(-0.05, 0.05);
  else                  return vec2(0.05, 0.15);
}

float heightField(float biome, vec2 worldPos, vec2 localPos, vec2 cellCenter, float edgeBlend) {
  vec2 range = biomeRange(biome);
  float macro = fbm(worldPos * 0.55);
  float mid = fbm(worldPos * 1.8);
  float seed = hash21(cellCenter * 19.17) * 6.2831;
  float fine = fbm(localPos * 5.0 + seed);
  float detail = fbm(localPos * 12.0 + seed * 1.37);
  float n = clamp(macro * 0.35 + mid * 0.35 + fine * 0.2 + detail * 0.1, 0.0, 1.0);
  float h = mix(range.x, range.y, n);
  return h * edgeBlend;
}

void main() {
  float edge = 1.0 - smoothstep(uEdge * 0.35, uEdge, vBary.x);

  float biome = floor(vBiome + 0.5);
  vec3 albedo = vColor;
  vec2 p = vPlanePos;
  vec2 l = vLocalPos;
  vec2 c = vCellCenter;
  float height = heightField(biome, p, l, c, vEdgeBlend) * uHeightScale;

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
  float hX = heightField(biome, p + vec2(eps, 0.0), l + vec2(eps, 0.0), c, vEdgeBlend) * uHeightScale;
  float hY = heightField(biome, p + vec2(0.0, eps), l + vec2(0.0, eps), c, vEdgeBlend) * uHeightScale;
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
  const aCellCenter = gl.getAttribLocation(program, "aCellCenter");

  terrainAttribs = {
    position: aPos,
    color: aColor,
    bary: aBary,
    biome: aBiome,
    edge: aEdge,
    center: aCellCenter
  };

  terrainBuffers = {
    position: uploadBuffer(gl, aPos, gl.createBuffer(), mesh.positions, 2),
    color: uploadBuffer(gl, aColor, gl.createBuffer(), mesh.colors, 3),
    bary: uploadBuffer(gl, aBary, gl.createBuffer(), mesh.bary, 3),
    biome: uploadBuffer(gl, aBiome, gl.createBuffer(), mesh.biomes, 1),
    edge: uploadBuffer(gl, aEdge, gl.createBuffer(), mesh.edges, 1),
    center: uploadBuffer(gl, aCellCenter, gl.createBuffer(), mesh.centers, 2)
  };

  const mapleModel = await loadMapleModel();

  const treeVS = `
precision mediump float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uViewProj;
uniform vec3 uLightDir;
varying vec3 vColor;
varying float vLight;
void main() {
  vec3 n = normalize(aNormal);
  vLight = max(dot(n, normalize(uLightDir)), 0.1);
  vColor = aColor;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

  const treeFS = `
precision mediump float;
varying vec3 vColor;
varying float vLight;
void main() {
  gl_FragColor = vec4(vColor * (0.35 + 0.65 * vLight), 1.0);
}
`;

  const treeMesh = buildTreeMesh(mesh.cells, mesh.hexRadius, mapleModel);
  treeVertexCount = treeMesh.count;

  if (treeVertexCount > 0) {
    treeProgram = createProgram(gl, treeVS, treeFS);
    if (treeProgram) {
      gl.useProgram(treeProgram);
      treeViewProjLoc = gl.getUniformLocation(treeProgram, "uViewProj");
      treeLightDirLoc = gl.getUniformLocation(treeProgram, "uLightDir");
      treeAttribs = {
        position: gl.getAttribLocation(treeProgram, "aPosition"),
        normal: gl.getAttribLocation(treeProgram, "aNormal"),
        color: gl.getAttribLocation(treeProgram, "aColor")
      };
      treeBuffers = {
        position: uploadBuffer(gl, treeAttribs.position, gl.createBuffer(), treeMesh.positions, 3),
        normal: uploadBuffer(gl, treeAttribs.normal, gl.createBuffer(), treeMesh.normals, 3),
        color: uploadBuffer(gl, treeAttribs.color, gl.createBuffer(), treeMesh.colors, 3)
      };
    } else {
      treeVertexCount = 0;
    }
    gl.useProgram(program);
  }

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
