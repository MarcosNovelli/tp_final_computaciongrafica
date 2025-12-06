// Vertex shader: posiciones 2D y tipo de terreno.
const vertexSrc = `
  attribute vec2 aPosition;
  attribute float aTerrainType;
  varying float vTerrainType;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vTerrainType = aTerrainType;
  }
`;

// Fragment shader: colorea segun el tipo de terreno.
const fragmentSrc = `
  precision mediump float;
  varying float vTerrainType;
  void main() {
    vec3 color;
    if (vTerrainType < 0.5) {
      color = vec3(0.7, 0.3, 0.2);   // arcilla
    } else if (vTerrainType < 1.5) {
      color = vec3(0.9, 0.8, 0.3);   // trigo
    } else {
      color = vec3(0.5, 0.5, 0.6);   // piedra
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

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

// Genera los vertices de un hexagono regular en 2D usando TRIANGLE_FAN.
// PASO 2: un hexagono 2D
function createHexVertices2D(centerX, centerY, radius, terrainType) {
  const positions = [];
  const terrainTypes = [];
  positions.push(centerX, centerY);
  terrainTypes.push(terrainType);
  const sides = 6;
  for (let i = 0; i <= sides; i++) {
    const angle = (Math.PI / 3) * i;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    positions.push(x, y);
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
  const count = hexFan.positions.length / 2;
  for (let i = 1; i < count - 1; i++) {
    // centro
    triPositions.push(hexFan.positions[0], hexFan.positions[1]);
    triTerrain.push(hexFan.terrainTypes[0]);
    // borde i
    triPositions.push(hexFan.positions[2 * i], hexFan.positions[2 * i + 1]);
    triTerrain.push(hexFan.terrainTypes[i]);
    // borde i+1
    triPositions.push(hexFan.positions[2 * (i + 1)], hexFan.positions[2 * (i + 1) + 1]);
    triTerrain.push(hexFan.terrainTypes[i + 1]);
  }
  return {
    positions: new Float32Array(triPositions),
    terrainTypes: new Float32Array(triTerrain),
  };
}

// Carga buffers y dibuja geometria ya preparada.
function drawGeometry(gl, locations, positions, terrainTypes, mode) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

  const terrainBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, terrainBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, terrainTypes, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(locations.terrainType);
  gl.vertexAttribPointer(locations.terrainType, 1, gl.FLOAT, false, 0, 0);

  gl.drawArrays(mode, 0, positions.length / 2);
}

function main() {
  const canvas = document.getElementById('glcanvas');
  const gl = canvas.getContext('webgl');
  if (!gl) {
    alert('WebGL no esta disponible en este navegador.');
    return;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.08, 0.1, 0.12, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const program = createProgram(gl, vertexSrc, fragmentSrc);
  if (!program) {
    alert('No se pudo crear el programa de WebGL.');
    return;
  }
  gl.useProgram(program);

  const locations = {
    position: gl.getAttribLocation(program, 'aPosition'),
    terrainType: gl.getAttribLocation(program, 'aTerrainType'),
  };

  // PASO 1: triangulo minimo (ejemplo base)
  // Descomentar este bloque para probar solo un triangulo.
  /*
  const triPositions = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.0,  0.5,
  ]);
  const triTerrain = new Float32Array([0, 0, 0]); // todo arcilla
  drawGeometry(gl, locations, triPositions, triTerrain, gl.TRIANGLES);
  return;
  */

  // PASO 2: un solo hexagono centrado
  // Descomentar para ver un unico hexagono usando TRIANGLE_FAN.
  /*
  const singleHexFan = createHexVertices2D(0.0, 0.0, 0.5, 0);
  drawGeometry(gl, locations, singleHexFan.positions, singleHexFan.terrainTypes, gl.TRIANGLE_FAN);
  return;
  */

  // PASO 3: tres hexagonos con tipos de terreno distintos
  const hexData = [
    createHexVertices2D(-0.7, 0.0, 0.25, 0), // arcilla
    createHexVertices2D( 0.0, 0.0, 0.25, 1), // trigo
    createHexVertices2D( 0.7, 0.0, 0.25, 2), // piedra
  ];

  const combinedPositions = [];
  const combinedTerrain = [];
  hexData.forEach((hex) => {
    const triHex = hexFanToTriangles(hex);
    combinedPositions.push(...triHex.positions);
    combinedTerrain.push(...triHex.terrainTypes);
  });

  drawGeometry(
    gl,
    locations,
    new Float32Array(combinedPositions),
    new Float32Array(combinedTerrain),
    gl.TRIANGLES
  );
}

// Ejecutar la escena al cargar.
main();
