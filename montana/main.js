const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl");
if (!gl) { alert("WebGL no disponible"); throw new Error("WebGL no disponible"); }

async function loadShaderSource(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.text();
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    throw new Error("Shader error");
  }
  return sh;
}
function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    throw new Error("Link error");
  }
  return p;
}

function perspective(fov, aspect, near, far) {
  const f = 1.0 / Math.tan((fov * Math.PI / 180) / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0
  ];
}
function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function lookAt(eye, target, up) {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return [
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
    -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
    -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
    1
  ];
}
function mul4(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function buildGrid(size) {
  const verts = [];
  const step = 1 / size;
  for (let z = 0; z <= size; z++) {
    for (let x = 0; x <= size; x++) {
      const u = x * step - 0.5;
      const v = z * step - 0.5;
      verts.push(u * 5.0, v * 5.0);
    }
  }
  const indices = [];
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const i = z * (size + 1) + x;
      indices.push(i, i + 1, i + size + 1);
      indices.push(i + 1, i + size + 2, i + size + 1);
    }
  }
  return {
    positions: new Float32Array(verts),
    indices: new Uint16Array(indices),
    count: indices.length
  };
}

let program;
let buffers;
let attribLoc;
let uniformLocs;
let mesh;
let currentBiome = 0.0;
const camera = { radius: 7.0, yaw: Math.PI * 0.42, pitch: 0.32, target: [0, 1.1, 0] };
let dragging = false, lastX = 0, lastY = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function setupControls() {
  canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener("mouseup", () => { dragging = false; });
  canvas.addEventListener("mouseleave", () => { dragging = false; });
  canvas.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    const sens = 0.005;
    camera.yaw -= dx * sens;
    camera.pitch = Math.min(Math.max(camera.pitch - dy * sens, -1.2), 1.2);
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoom = 1.0 + e.deltaY * 0.0015;
    camera.radius = Math.min(Math.max(camera.radius * zoom, 2.5), 15.0);
  }, { passive: false });

  const biomeSelect = document.getElementById("biomeSelect");
  if (biomeSelect) {
    biomeSelect.addEventListener("change", (e) => {
      currentBiome = parseFloat(e.target.value);
    });
  }
}

async function init() {
  const [vertexSrc, fragmentSrc] = await Promise.all([
    loadShaderSource("./vertex.glsl"),
    loadShaderSource("./fragment.glsl")
  ]);

  program = createProgram(gl, vertexSrc, fragmentSrc);
  gl.useProgram(program);

  attribLoc = { pos: gl.getAttribLocation(program, "aPos") };
  uniformLocs = {
    viewProj: gl.getUniformLocation(program, "uViewProj"),
    lightDir: gl.getUniformLocation(program, "uLightDir"),
    cameraPos: gl.getUniformLocation(program, "uCameraPos"),
    heightScale: gl.getUniformLocation(program, "uHeightScale"),
    time: gl.getUniformLocation(program, "uTime"),
    hexRadius: gl.getUniformLocation(program, "uHexRadius"),
    biome: gl.getUniformLocation(program, "uBiome")
  };

  mesh = buildGrid(240);

  buffers = {
    vao: gl.createVertexArray ? gl.createVertexArray() : null,
    vbo: gl.createBuffer(),
    ebo: gl.createBuffer()
  };

  if (buffers.vao && gl.bindVertexArray) gl.bindVertexArray(buffers.vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(attribLoc.pos);
  gl.vertexAttribPointer(attribLoc.pos, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.2, 0.23, 0.27, 1.0);

  setupControls();
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
}

function draw(timeMs) {
  resize();
  const t = timeMs * 0.001;

  const aspect = canvas.width / canvas.height;
  const proj = perspective(55, aspect, 0.1, 80);
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
  const eye = [
    camera.radius * cp * cy,
    camera.radius * sp + 1.0,
    camera.radius * cp * sy
  ];
  const view = lookAt(eye, camera.target, [0, 1, 0]);
  const viewProj = mul4(new Float32Array(proj), new Float32Array(view));

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniformMatrix4fv(uniformLocs.viewProj, false, viewProj);
  gl.uniform3f(uniformLocs.lightDir, -0.4, 0.9, 0.25);
  gl.uniform3f(uniformLocs.cameraPos, eye[0], eye[1], eye[2]);
  gl.uniform1f(uniformLocs.heightScale, 2.8);
  gl.uniform1f(uniformLocs.time, t);
  gl.uniform1f(uniformLocs.hexRadius, 2.35);
  gl.uniform1f(uniformLocs.biome, currentBiome);

  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  requestAnimationFrame(draw);
}

init().catch((err) => console.error(err));
