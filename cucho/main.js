// Carga el texto de un shader desde un archivo.
async function loadShaderSource(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url}: ${response.statusText}`);
  }
  return response.text();
}

// Compila un shader y muestra errores en consola.
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Fallo al compilar shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Linkea un programa y muestra errores en consola.
function createProgram(gl, vertSrc, fragSrc) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vertexShader || !fragmentShader) {
    return null;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Fallo al linkear programa:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// Utilidades de matrices 4x4.
function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function identityMat4() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function multiplyMat4(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    const ai0 = a[i];
    const ai1 = a[i + 4];
    const ai2 = a[i + 8];
    const ai3 = a[i + 12];
    out[i]      = ai0 * b[0]  + ai1 * b[1]  + ai2 * b[2]  + ai3 * b[3];
    out[i + 4]  = ai0 * b[4]  + ai1 * b[5]  + ai2 * b[6]  + ai3 * b[7];
    out[i + 8]  = ai0 * b[8]  + ai1 * b[9]  + ai2 * b[10] + ai3 * b[11];
    out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
  }
  return out;
}

function perspective(fovRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

function lookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let zLen = Math.hypot(zx, zy, zz);
  const z0 = zx / zLen;
  const z1 = zy / zLen;
  const z2 = zz / zLen;

  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  let xLen = Math.hypot(x0, x1, x2);
  x0 /= xLen;
  x1 /= xLen;
  x2 /= xLen;

  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;

  return new Float32Array([
    x0, y0, z0, 0,
    x1, y1, z1, 0,
    x2, y2, z2, 0,
    -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]),
    -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
    -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
    1,
  ]);
}

function rotationX(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
}

function rotationY(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

// Genera los vertices de un hexagono regular en 2D usando TRIANGLE_FAN.
// PASO 2: un hexagono 2D (ahora con z = 0 para pipeline 3D)
function createHexVertices2D(centerX, centerY, radius, terrainType) {
  const positions = [];
  const terrainTypes = [];
  positions.push(centerX, centerY, 0);
  terrainTypes.push(terrainType);
  const sides = 6;
  for (let i = 0; i <= sides; i++) {
    const angle = (Math.PI / 3) * i;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    positions.push(x, y, 0);
    terrainTypes.push(terrainType);
  }
  return {
    positions: new Float32Array(positions),
    terrainTypes: new Float32Array(terrainTypes),
  };
}

// Convierte un TRIANGLE_FAN de hexagono en una lista de triangulos.
function hexFanToTriangles(hexFan) {
  const triPositions = [];
  const triTerrain = [];
  const count = hexFan.positions.length / 3;
  for (let i = 1; i < count - 1; i++) {
    // centro
    triPositions.push(hexFan.positions[0], hexFan.positions[1], hexFan.positions[2]);
    triTerrain.push(hexFan.terrainTypes[0]);
    // borde i
    triPositions.push(
      hexFan.positions[3 * i],
      hexFan.positions[3 * i + 1],
      hexFan.positions[3 * i + 2]
    );
    triTerrain.push(hexFan.terrainTypes[i]);
    // borde i+1
    triPositions.push(
      hexFan.positions[3 * (i + 1)],
      hexFan.positions[3 * (i + 1) + 1],
      hexFan.positions[3 * (i + 1) + 2]
    );
    triTerrain.push(hexFan.terrainTypes[i + 1]);
  }
  return {
    positions: new Float32Array(triPositions),
    terrainTypes: new Float32Array(triTerrain),
  };
}

// Carga buffers y dibuja geometria ya preparada.
async function main() {
  const canvas = document.getElementById('glcanvas');
  const gl = canvas.getContext('webgl');
  if (!gl) {
    alert('WebGL no esta disponible en este navegador.');
    return;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.08, 0.1, 0.12, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  let vertexSrc;
  let fragmentSrc;
  try {
    [vertexSrc, fragmentSrc] = await Promise.all([
      loadShaderSource('vertex.glsl'),
      loadShaderSource('fragment.glsl'),
    ]);
  } catch (err) {
    console.error(err);
    alert('No se pudieron cargar los shaders. Revise la consola.');
    return;
  }

  const program = createProgram(gl, vertexSrc, fragmentSrc);
  if (!program) {
    alert('No se pudo crear el programa de WebGL.');
    return;
  }
  gl.useProgram(program);

  const locations = {
    position: gl.getAttribLocation(program, 'aPosition'),
    terrainType: gl.getAttribLocation(program, 'aTerrainType'),
    uModel: gl.getUniformLocation(program, 'uModel'),
    uView: gl.getUniformLocation(program, 'uView'),
    uProj: gl.getUniformLocation(program, 'uProj'),
  };



  // Tres hexagonos con tipos de terreno distintos
  // centerX, centerY, radius, type
  const hexData = [
    createHexVertices2D(-0.4, 0.23, 0.25, 0), // arcilla
    createHexVertices2D( 0.0, 0.0, 0.25, 1), // trigo
    createHexVertices2D( 0.4, 0.23, 0.25, 2), // piedra
    createHexVertices2D( 0.0, 0.46, 0.25, 2), // piedra -- de mas para formar grilla

  ];

  const combinedPositions = [];
  const combinedTerrain = [];
  hexData.forEach((hex) => {
    const triHex = hexFanToTriangles(hex);
    combinedPositions.push(...triHex.positions);
    combinedTerrain.push(...triHex.terrainTypes);
  });

  // Buffers estaticos.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(combinedPositions), gl.STATIC_DRAW);

  const terrainBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(combinedTerrain), gl.STATIC_DRAW);

  const vertexCount = combinedPositions.length / 3;

  // Estado para interaccion.
  const state = {
    rotX: degToRad(-20),
    rotY: degToRad(0),
    cameraDist: 3,
  };

  function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height;
    const proj = perspective(degToRad(45), aspect, 0.1, 100);
    const view = lookAt([0, 0, state.cameraDist], [0, 0, 0], [0, 1, 0]);

    // model = Ry * Rx
    const model = multiplyMat4(rotationY(state.rotY), rotationX(state.rotX));

    gl.uniformMatrix4fv(locations.uModel, false, model);
    gl.uniformMatrix4fv(locations.uView, false, view);
    gl.uniformMatrix4fv(locations.uProj, false, proj);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffer);
    gl.enableVertexAttribArray(locations.terrainType);
    gl.vertexAttribPointer(locations.terrainType, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }

  // Controles: rotacion con flechas, zoom con rueda.
  window.addEventListener('keydown', (ev) => {
    const delta = degToRad(5);
    switch (ev.key) {
      case 'ArrowLeft':
        state.rotY -= delta;
        break;
      case 'ArrowRight':
        state.rotY += delta;
        break;
      case 'ArrowUp':
        state.rotX -= delta;
        break;
      case 'ArrowDown':
        state.rotX += delta;
        break;
      case 'r':
      case 'R':
        state.rotX = degToRad(-20);
        state.rotY = 0;
        state.cameraDist = 3;
        break;
      default:
        return;
    }
    render();
  });

  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const zoomFactor = 1 + ev.deltaY * 0.001;
    state.cameraDist = Math.min(10, Math.max(1.2, state.cameraDist * zoomFactor));
    render();
  });

  render();
}

// Ejecutar la escena al cargar.
main().catch((err) => {
  console.error(err);
  alert('Ocurrio un error inicializando la escena.');
});
