/**
 * ============================================================
 * main.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo es el punto de entrada principal de la aplicación.
 * Su responsabilidad es:
 * - Orquestar la inicialización y el dibujado
 * - Coordinar el flujo principal de la aplicación
 * - Manejar controles de cámara y renderizado de escena
 * 
 * NOTA: Las funciones auxiliares han sido extraídas a módulos separados:
 * - Constantes: utils/config.js
 * - Utilidades matemáticas: utils/math.js
 * - Utilidades hexagonales: utils/hex.js
 * - Shaders: shaders/shaders.js
 * - Geometría: render/geometry.js
 * - Renderizado: render/renderer.js
 * - Creación de objetos: world/objects.js
 */

/**
 * ============================================================
 * FUNCIÓN PRINCIPAL
 * ============================================================
 */

/**
 * Función principal que inicializa la aplicación y dibuja una grilla de prismas hexagonales.
 */
async function main() {
  console.log('Iniciando aplicación WebGL...');
  
  // Paso 1: Inicializar WebGL (función de render/gl.js)
  const webgl = initWebGL('glCanvas');
  if (!webgl) {
    return;
  }
  const { gl } = webgl;
  
  // Habilita el depth testing para renderizado 3D correcto
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Paso 2: Crear programa de shaders (función de render/gl.js)
  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    console.error('Error: No se pudo crear el programa de shaders');
    return;
  }
  
  // Paso 3: Inicializar generador de ruido compartido (para modo board)
  let sharedNoiseGenerator = null;
  
  try {
    let noise2D = null;
    let SimplexNoiseModule = null;
    
    if (typeof window !== 'undefined' && window.SimplexNoise) {
      SimplexNoiseModule = window.SimplexNoise;
    } else if (typeof SimplexNoise !== 'undefined') {
      SimplexNoiseModule = SimplexNoise;
    } else if (typeof window !== 'undefined' && typeof window.createNoise2D === 'function') {
      noise2D = window.createNoise2D();
    }
    
    if (SimplexNoiseModule && !noise2D) {
      if (typeof SimplexNoiseModule.createNoise2D === 'function') {
        noise2D = SimplexNoiseModule.createNoise2D();
      } else if (typeof SimplexNoiseModule === 'function') {
        const simplex = new SimplexNoiseModule();
        noise2D = simplex.noise2D.bind(simplex);
      }
    }
    
    if (noise2D && typeof noise2D === 'function') {
      sharedNoiseGenerator = { noise2D: noise2D };
      console.log('✓ Generador de ruido compartido inicializado');
    }
  } catch (error) {
    console.warn('⚠ No se pudo crear generador de ruido compartido, cada tile creará el suyo');
  }
  
  // Paso 4: Seleccionar modo de visualización
  let cells, treeInstances, sheepInstances, wheatInstances, activeBiome;
  let board = null;
  
  if (VIEW_MODE === "board") {
    // MODO TABLERO: Crear múltiples tiles con diferentes biomas
    const sqrt3 = Math.sqrt(3);
    const tileRadius = HEX_RADIUS_WORLD * sqrt3 * GRID_RADIUS + HEX_RADIUS_WORLD;
    
    const ADJUSTMENT_FACTOR = 0.99;
    const HORIZONTAL_SPACING = 2 * tileRadius * ADJUSTMENT_FACTOR;
    const VERTICAL_SPACING = tileRadius * sqrt3 * ADJUSTMENT_FACTOR;
    const HORIZONTAL_OFFSET = tileRadius * ADJUSTMENT_FACTOR;
    
    const tilesConfig = [
      // Línea central de 5 tiles (fila 0)
      { x: 0, z: 0},
      { x: HORIZONTAL_SPACING, z: 0 },
      { x: HORIZONTAL_SPACING * 2, z: 0 },
      { x: HORIZONTAL_SPACING * 3, z: 0 },
      { x: HORIZONTAL_SPACING * 4, z: 0 },

      // Línea inferior de 4 tiles (fila 1, desplazada)
      { x: HORIZONTAL_OFFSET, z: VERTICAL_SPACING},
      { x: HORIZONTAL_OFFSET + HORIZONTAL_SPACING, z: VERTICAL_SPACING },
      { x: HORIZONTAL_OFFSET + HORIZONTAL_SPACING * 2, z: VERTICAL_SPACING },
      { x: HORIZONTAL_OFFSET + HORIZONTAL_SPACING * 3, z: VERTICAL_SPACING },
      
      // Línea superior de 4 tiles (fila -1, desplazada)
      { x: HORIZONTAL_OFFSET, z: -VERTICAL_SPACING},
      { x: HORIZONTAL_OFFSET + HORIZONTAL_SPACING, z: -VERTICAL_SPACING },
      { x: HORIZONTAL_OFFSET + HORIZONTAL_SPACING * 2, z: -VERTICAL_SPACING },
      { x: HORIZONTAL_OFFSET + HORIZONTAL_SPACING * 3, z: -VERTICAL_SPACING },
      
      // Línea inferior más baja de 3 tiles (fila 2)
      { x: HORIZONTAL_SPACING, z: VERTICAL_SPACING * 2},
      { x: HORIZONTAL_SPACING * 2, z: VERTICAL_SPACING * 2 },
      { x: HORIZONTAL_SPACING * 3, z: VERTICAL_SPACING * 2 },
    
      // Línea superior más alta de 3 tiles (fila -2)
      { x: HORIZONTAL_SPACING, z: -VERTICAL_SPACING * 2},
      { x: HORIZONTAL_SPACING * 2, z: -VERTICAL_SPACING * 2 },
      { x: HORIZONTAL_SPACING * 3, z: -VERTICAL_SPACING * 2 },
    ];
    
    console.log(`✓ Modo: Tablero (${tilesConfig.length} tiles manuales)`);
    
    board = createBoard(tilesConfig, sharedNoiseGenerator);
    board.generate();
    
    cells = board.getAllCells();
    const allObjects = board.getAllObjectInstances();
    treeInstances = allObjects.treeInstances;
    sheepInstances = allObjects.sheepInstances;
    wheatInstances = allObjects.wheatInstances;
    
    activeBiome = { name: "Board" };
    
    console.log(`✓ Tablero generado: ${cells.length} celdas totales, ${treeInstances.length} árboles, ${sheepInstances.length} ovejas, ${wheatInstances.length} trigo`);
  } else {
    // MODO BIOMA ÚNICO: Lógica existente (un solo tile)
    console.log(`✓ Modo: Bioma Único`);
    
    activeBiome = getActiveBiome();
    console.log(`✓ Bioma activo: ${activeBiome.name || "Unknown"}`);
    
    cells = createCells(activeBiome, sharedNoiseGenerator);
    
    treeInstances = createTreeInstances(cells, activeBiome);
    wheatInstances = createWheatInstances(cells, activeBiome);
    sheepInstances = createSheepInstances(cells, activeBiome);
  }
  
  // Paso 5: Crear datos del prisma hexagonal base
  const baseHeight = 0.5;
  const prismData = createHexagonPrismData(HEX_RADIUS_WORLD, baseHeight);
  
  // Paso 6: Crear buffers separados para posiciones y normales
  const positionBuffer = createBuffer(gl, prismData.positions);
  const normalBuffer = createBuffer(gl, prismData.normals);
  
  // Paso 7: Crear mesh del árbol programáticamente
  const treeMesh = createTreeMesh(gl);
  
  // Paso 7b: Crear mesh de trigo programáticamente
  const wheatMesh = createWheatMesh(gl, HEX_RADIUS_WORLD, 60);
  
  // Paso 8: Cargar modelo OBJ de oveja con su material MTL
  let sheepMesh = null;
  
  try {
    console.log('Cargando modelo de oveja...');
    const sheepData = await loadObjWithMtl(gl, "objects/Sheep.obj", "objects/Sheep.mtl");
    if (!sheepData || !sheepData.white || !sheepData.black) {
      throw new Error('El modelo de oveja no se cargó correctamente (estructura de datos inválida)');
    }
    sheepMesh = {
      white: sheepData.white,
      black: sheepData.black
    };
    console.log(`✓ Modelo de oveja cargado: White=${sheepData.white.indexCount / 3} triángulos, Black=${sheepData.black.indexCount / 3} triángulos`);
  } catch (error) {
    console.error(`❌ ERROR al cargar el modelo de oveja: ${error.message}`);
    console.warn('  Continuando sin ovejas...');
    sheepMesh = null;
  }
  
  // Paso 9: Ajustar tamaño del canvas a pantalla completa
  function resizeCanvas() {
    webgl.canvas.width = window.innerWidth;
    webgl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, webgl.canvas.width, webgl.canvas.height);
    const newAspect = webgl.canvas.width / webgl.canvas.height;
    return perspective(60, newAspect, 0.1, 100.0);
  }
  resizeCanvas();
  
  // Actualizar el título de la pestaña del navegador
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    pageTitle.textContent = activeBiome.name || 'Bioma';
  }
  
  // Actualizar el título visible en pantalla
  const biomeTitle = document.getElementById('biomeTitle');
  if (biomeTitle) {
    if (VIEW_MODE === "board") {
      biomeTitle.style.display = 'none';
    } else {
      biomeTitle.style.display = 'block';
      biomeTitle.textContent = (activeBiome.name || 'Bioma') + ' Biome';
    }
  }
  
  // Paso 10: Preparar matrices de vista y proyección
  let terrainSize;
  let cameraEye, cameraCenter, cameraUp;
  
  if (VIEW_MODE === "board") {
    const boardSize = board ? board.getBoardSize() : { 
      width: 2 * 2 * GRID_RADIUS * HEX_RADIUS_WORLD * Math.sqrt(3) * 2,
      height: 2 * 2 * GRID_RADIUS * HEX_RADIUS_WORLD * Math.sqrt(3) * 2
    };
    terrainSize = Math.max(boardSize.width, boardSize.height) + GRID_RADIUS * HEX_RADIUS_WORLD * 2;
    
    const cameraDistance = terrainSize * 1.2;
    cameraEye = [cameraDistance * 0.6, cameraDistance * 1.0, cameraDistance * 0.6];
    cameraCenter = [0, 0, 0];
    cameraUp = [0, 1, 0];
  } else {
    terrainSize = GRID_RADIUS * HEX_RADIUS_WORLD * Math.sqrt(3) * 2;
    const cameraDistance = terrainSize * 0.85;
    cameraEye = [cameraDistance * 0.7, cameraDistance * 0.8, cameraDistance * 0.7];
    cameraCenter = [0, 0, 0];
    cameraUp = [0, 1, 0];
  }
  
  // Estado de la cámara para Board Mode
  let currentCameraEye = [...cameraEye];
  let currentCameraCenter = [...cameraCenter];
  
  const aspect = webgl.canvas.width / webgl.canvas.height;
  let viewMatrix = lookAt(currentCameraEye, currentCameraCenter, cameraUp);
  let projectionMatrix = perspective(60, aspect, 0.1, 100.0);
  
  // ============================================================
  // CONTROLES DE CÁMARA PARA BOARD MODE
  // ============================================================
  
  if (VIEW_MODE === "board") {
    const CAMERA_MOVE_SPEED = 0.5;
    const CAMERA_ZOOM_SPEED = 0.1;
    const CAMERA_ZOOM_MIN = 2.0;
    const CAMERA_ZOOM_MAX = 200.0;
    
    const keysPressed = {};
    
    window.addEventListener('keydown', (e) => {
      keysPressed[e.key.toLowerCase()] = true;
      keysPressed[e.code] = true;
      if (e.key === '+' || e.key === '-' || e.key === '=') {
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      keysPressed[e.key.toLowerCase()] = false;
      keysPressed[e.code] = false;
    });
    
    webgl.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const viewDir = [
        currentCameraCenter[0] - currentCameraEye[0],
        currentCameraCenter[1] - currentCameraEye[1],
        currentCameraCenter[2] - currentCameraEye[2]
      ];
      
      const currentDistance = Math.sqrt(
        viewDir[0] * viewDir[0] + 
        viewDir[1] * viewDir[1] + 
        viewDir[2] * viewDir[2]
      );
      
      const viewDirNorm = [
        viewDir[0] / currentDistance,
        viewDir[1] / currentDistance,
        viewDir[2] / currentDistance
      ];
      
      let newDistance = currentDistance;
      if (e.deltaY > 0) {
        newDistance = currentDistance * (1.0 + CAMERA_ZOOM_SPEED);
      } else {
        newDistance = currentDistance * (1.0 - CAMERA_ZOOM_SPEED);
      }
      
      newDistance = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, newDistance));
      
      currentCameraEye[0] = currentCameraCenter[0] - viewDirNorm[0] * newDistance;
      currentCameraEye[1] = currentCameraCenter[1] - viewDirNorm[1] * newDistance;
      currentCameraEye[2] = currentCameraCenter[2] - viewDirNorm[2] * newDistance;
      
      viewMatrix = lookAt(currentCameraEye, currentCameraCenter, cameraUp);
      renderScene();
    }, { passive: false });
    
    function updateCamera() {
      let moved = false;
      const forward = [currentCameraCenter[0] - currentCameraEye[0], 0, currentCameraCenter[2] - currentCameraEye[2]];
      const forwardLength = Math.sqrt(forward[0] * forward[0] + forward[2] * forward[2]);
      if (forwardLength > 0.001) {
        forward[0] /= forwardLength;
        forward[2] /= forwardLength;
      }
      
      const right = [-forward[2], 0, forward[0]];
      
      if (keysPressed['w'] || keysPressed['arrowup']) {
        currentCameraEye[0] += forward[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] += forward[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] += forward[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] += forward[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      if (keysPressed['s'] || keysPressed['arrowdown']) {
        currentCameraEye[0] -= forward[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] -= forward[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] -= forward[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] -= forward[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      
      if (keysPressed['a'] || keysPressed['arrowleft']) {
        currentCameraEye[0] -= right[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] -= right[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] -= right[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] -= right[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      if (keysPressed['d'] || keysPressed['arrowright']) {
        currentCameraEye[0] += right[0] * CAMERA_MOVE_SPEED;
        currentCameraEye[2] += right[2] * CAMERA_MOVE_SPEED;
        currentCameraCenter[0] += right[0] * CAMERA_MOVE_SPEED;
        currentCameraCenter[2] += right[2] * CAMERA_MOVE_SPEED;
        moved = true;
      }
      
      if (keysPressed['q']) {
        currentCameraEye[1] += CAMERA_MOVE_SPEED;
        currentCameraCenter[1] += CAMERA_MOVE_SPEED;
        moved = true;
      }
      if (keysPressed['e']) {
        currentCameraEye[1] -= CAMERA_MOVE_SPEED;
        currentCameraCenter[1] -= CAMERA_MOVE_SPEED;
        moved = true;
      }
      
      if (keysPressed['+'] || keysPressed['=']) {
        const viewDir = [
          currentCameraCenter[0] - currentCameraEye[0],
          currentCameraCenter[1] - currentCameraEye[1],
          currentCameraCenter[2] - currentCameraEye[2]
        ];
        const currentDistance = Math.sqrt(viewDir[0] * viewDir[0] + viewDir[1] * viewDir[1] + viewDir[2] * viewDir[2]);
        const viewDirNorm = [
          viewDir[0] / currentDistance,
          viewDir[1] / currentDistance,
          viewDir[2] / currentDistance
        ];
        const newDistance = Math.max(CAMERA_ZOOM_MIN, currentDistance * (1.0 - CAMERA_ZOOM_SPEED));
        currentCameraEye[0] = currentCameraCenter[0] - viewDirNorm[0] * newDistance;
        currentCameraEye[1] = currentCameraCenter[1] - viewDirNorm[1] * newDistance;
        currentCameraEye[2] = currentCameraCenter[2] - viewDirNorm[2] * newDistance;
        moved = true;
      }
      if (keysPressed['-'] || keysPressed['_']) {
        const viewDir = [
          currentCameraCenter[0] - currentCameraEye[0],
          currentCameraCenter[1] - currentCameraEye[1],
          currentCameraCenter[2] - currentCameraEye[2]
        ];
        const currentDistance = Math.sqrt(viewDir[0] * viewDir[0] + viewDir[1] * viewDir[1] + viewDir[2] * viewDir[2]);
        const viewDirNorm = [
          viewDir[0] / currentDistance,
          viewDir[1] / currentDistance,
          viewDir[2] / currentDistance
        ];
        const newDistance = Math.min(CAMERA_ZOOM_MAX, currentDistance * (1.0 + CAMERA_ZOOM_SPEED));
        currentCameraEye[0] = currentCameraCenter[0] - viewDirNorm[0] * newDistance;
        currentCameraEye[1] = currentCameraCenter[1] - viewDirNorm[1] * newDistance;
        currentCameraEye[2] = currentCameraCenter[2] - viewDirNorm[2] * newDistance;
        moved = true;
      }
      
      if (keysPressed['r']) {
        currentCameraEye = [...cameraEye];
        currentCameraCenter = [...cameraCenter];
        moved = true;
        keysPressed['r'] = false;
      }
      
      if (moved) {
        viewMatrix = lookAt(currentCameraEye, currentCameraCenter, cameraUp);
        renderScene();
      }
    }
    
    function cameraUpdateLoop() {
      updateCamera();
      requestAnimationFrame(cameraUpdateLoop);
    }
    cameraUpdateLoop();
    
    console.log('✓ Controles de cámara activados para Board Mode');
    console.log('  W/S/Arrows: Mover | Q/E: Elevar/Bajar | Rueda mouse/+/−: Zoom | R: Reset');
  }
  
  // Función para redibujar la escena
  function renderScene() {
    projectionMatrix = resizeCanvas();
    
    const cameraPosForShader = VIEW_MODE === "board" ? currentCameraEye : currentCameraEye;
    drawHexGrid(gl, program, positionBuffer, normalBuffer, webgl.canvas, cells, HEX_RADIUS_WORLD, viewMatrix, projectionMatrix, cameraPosForShader);
    
    // Dibujar árboles
    if (treeInstances.length > 0) {
      const treeCrownColor = (VIEW_MODE === "board" || activeBiome.name === "Forest") ? 
        (activeBiome.name === "Forest" ? TREE_CROWN_COLOR_FOREST : TREE_CROWN_COLOR_GRASS) : 
        TREE_CROWN_COLOR_GRASS;
      for (const tree of treeInstances) {
        drawTreeWithColor(gl, program, treeMesh, tree.modelMatrix, viewMatrix, projectionMatrix, treeCrownColor);
      }
    }
    
    // Dibujar trigo
    if (wheatMesh && wheatInstances.length > 0) {
      const WHEAT_COLOR = [0.95, 0.82, 0.22];
      
      const noLightingLocation = gl.getUniformLocation(program, 'uNoLighting');
      if (noLightingLocation) {
        gl.uniform1f(noLightingLocation, 1.0);
      }
      
      for (const wheat of wheatInstances) {
        drawMesh(
          gl, program,
          wheatMesh.positionBuffer,
          wheatMesh.normalBuffer,
          wheatMesh.indexBuffer,
          wheatMesh.indexCount,
          wheat.modelMatrix,
          viewMatrix,
          projectionMatrix,
          WHEAT_COLOR
        );
      }
      
      if (noLightingLocation) {
        gl.uniform1f(noLightingLocation, 0.0);
      }
    }
    
    // Dibujar ovejas
    if (sheepMesh && sheepInstances.length > 0) {
      for (const sheep of sheepInstances) {
        drawMesh(gl, program, sheepMesh.white.positionBuffer, sheepMesh.white.normalBuffer, sheepMesh.white.indexBuffer, sheepMesh.white.indexCount, sheep.modelMatrix, viewMatrix, projectionMatrix, [0.95, 0.95, 0.95], 0);
        drawMesh(gl, program, sheepMesh.black.positionBuffer, sheepMesh.black.normalBuffer, sheepMesh.black.indexBuffer, sheepMesh.black.indexCount, sheep.modelMatrix, viewMatrix, projectionMatrix, [0.2, 0.2, 0.2], 0);
      }
    }
  }
  
  // Agregar listener para redimensionar la ventana
  window.addEventListener('resize', renderScene);
  
  // Paso 11: Renderizar la escena inicial
  renderScene();
  
  console.log('✓ ¡Aplicación iniciada correctamente!');
}

// Ejecuta la función principal cuando la página y todos los scripts están cargados
if (document.readyState === 'loading') {
  window.addEventListener('load', main);
} else {
  setTimeout(main, 0);
}
