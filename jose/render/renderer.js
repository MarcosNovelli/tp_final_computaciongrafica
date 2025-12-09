/**
 * ============================================================
 * render/renderer.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones para renderizar objetos 3D en WebGL.
 */

/**
 * Dibuja un prisma hexagonal en una posición específica con una altura y color determinados.
 */
function drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, y, z, height, color, viewMatrix, projectionMatrix, isWater = false, cameraPos = null) {
  const visualHeight = height * HEIGHT_UNIT;
  
  const scaleMatrix = scaleMat4(1.0, visualHeight, 1.0);
  const translationMatrix = translateMat4(x, 0, z);
  const modelMatrix = multiplyMat4(translationMatrix, scaleMatrix);
  const normalMatrix = calculateNormalMatrix(modelMatrix);
  
  const modelLocation = gl.getUniformLocation(program, 'u_model');
  const viewLocation = gl.getUniformLocation(program, 'u_view');
  const projectionLocation = gl.getUniformLocation(program, 'u_projection');
  const normalMatrixLocation = gl.getUniformLocation(program, 'u_normalMatrix');
  const colorLocation = gl.getUniformLocation(program, 'u_color');
  const isWaterLocation = gl.getUniformLocation(program, 'uIsWater');
  const cameraPosLocation = gl.getUniformLocation(program, 'uCameraPosition');
  
  gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
  gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
  gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
  
  gl.uniform3f(colorLocation, color[0], color[1], color[2]);
  gl.uniform1f(isWaterLocation, isWater ? 1.0 : 0.0);
  
  if (cameraPosLocation) {
    if (cameraPos) {
      gl.uniform3f(cameraPosLocation, cameraPos[0], cameraPos[1], cameraPos[2]);
    } else {
      gl.uniform3f(cameraPosLocation, 5.0, 8.0, 5.0);
    }
  }
  
  setupAttribute(gl, program, 'a_position', positionBuffer, 3);
  setupAttribute(gl, program, 'a_normal', normalBuffer, 3);
  
  gl.drawArrays(gl.TRIANGLES, 0, 72);
}

/**
 * Dibuja una grilla de prismas hexagonales en 3D con alturas variables por celda.
 */
function drawHexGrid(gl, program, positionBuffer, normalBuffer, canvas, cells, hexRadius, viewMatrix, projectionMatrix, cameraPos = null) {
  clearCanvas(gl, 0.0, 0.0, 0.0, 1.0);
  gl.useProgram(program);
  
  let finalViewMatrix = viewMatrix;
  let finalProjectionMatrix = projectionMatrix;
  let finalCameraPos = cameraPos;
  
  if (!finalViewMatrix || !finalProjectionMatrix) {
    const terrainSize = GRID_RADIUS * hexRadius * Math.sqrt(3) * 2;
    const cameraDistance = terrainSize * 0.85;
    
    const eye = [cameraDistance * 0.7, cameraDistance * 0.8, cameraDistance * 0.7];
    const center = [0, 0, 0];
    const up = [0, 1, 0];
    
    finalViewMatrix = lookAt(eye, center, up);
    
    if (!finalCameraPos) {
      finalCameraPos = eye;
    }
    
    const aspect = canvas.width / canvas.height;
    finalProjectionMatrix = perspective(60, aspect, 0.1, 100.0);
  }
  
  const cameraPosLocation = gl.getUniformLocation(program, 'uCameraPosition');
  if (cameraPosLocation) {
    if (finalCameraPos) {
      gl.uniform3f(cameraPosLocation, finalCameraPos[0], finalCameraPos[1], finalCameraPos[2]);
    } else {
      gl.uniform3f(cameraPosLocation, 5.0, 8.0, 5.0);
    }
  }
  
  // Dibujar terreno primero
  for (const cell of cells) {
    if (!cell.isWater) {
      const x = cell.worldX;
      const z = cell.worldZ;
      drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, 0, z, cell.height, cell.color, finalViewMatrix, finalProjectionMatrix, false, finalCameraPos);
    }
  }
  
  // Dibujar agua después
  let waterCellCount = 0;
  for (const cell of cells) {
    if (cell.isWater) {
      waterCellCount++;
      const x = cell.worldX;
      const z = cell.worldZ;
      drawHexagonAt(gl, program, positionBuffer, normalBuffer, x, 0, z, cell.height, cell.color, finalViewMatrix, finalProjectionMatrix, true, finalCameraPos);
    }
  }
  
  const terrainCellCount = cells.length - waterCellCount;
  console.log(`✓ Grilla 3D dibujada: ${terrainCellCount} prismas de terreno + ${waterCellCount} prismas de agua (total: ${cells.length})`);
}

/**
 * Dibuja un mesh genérico usando índices (ELEMENT_ARRAY_BUFFER).
 */
function drawMesh(gl, program, positionBuffer, normalBuffer, indexBuffer, indexCount, modelMatrix, viewMatrix, projectionMatrix, color, indexOffset = 0) {
  const normalMatrix = calculateNormalMatrix(modelMatrix);
  
  const modelLocation = gl.getUniformLocation(program, 'u_model');
  const viewLocation = gl.getUniformLocation(program, 'u_view');
  const projectionLocation = gl.getUniformLocation(program, 'u_projection');
  const normalMatrixLocation = gl.getUniformLocation(program, 'u_normalMatrix');
  const colorLocation = gl.getUniformLocation(program, 'u_color');
  const isWaterLocation = gl.getUniformLocation(program, 'uIsWater');
  const noLightingLocation = gl.getUniformLocation(program, 'uNoLighting');
  
  gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
  gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
  gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
  
  gl.uniform3f(colorLocation, color[0], color[1], color[2]);
  gl.uniform1f(isWaterLocation, 0.0);
  
  if (noLightingLocation) {
    gl.uniform1f(noLightingLocation, 0.0);
  }
  
  setupAttribute(gl, program, 'a_position', positionBuffer, 3);
  setupAttribute(gl, program, 'a_normal', normalBuffer, 3);
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, indexOffset);
}

/**
 * Dibuja un árbol completo (tronco + copa) con colores diferentes.
 */
function drawTree(gl, program, treeMesh, modelMatrix, viewMatrix, projectionMatrix) {
  drawTreeWithColor(gl, program, treeMesh, modelMatrix, viewMatrix, projectionMatrix, TREE_CROWN_COLOR_GRASS);
}

/**
 * Dibuja un árbol completo con color de copa personalizable.
 */
function drawTreeWithColor(gl, program, treeMesh, modelMatrix, viewMatrix, projectionMatrix, crownColor) {
  // Dibujar el tronco (marrón)
  drawMesh(
    gl, program,
    treeMesh.positionBuffer,
    treeMesh.normalBuffer,
    treeMesh.indexBuffer,
    treeMesh.trunkIndexCount,
    modelMatrix,
    viewMatrix,
    projectionMatrix,
    TREE_TRUNK_COLOR,
    0
  );
  
  // Dibujar la copa (color personalizado)
  drawMesh(
    gl, program,
    treeMesh.positionBuffer,
    treeMesh.normalBuffer,
    treeMesh.indexBuffer,
    treeMesh.crownIndexCount,
    modelMatrix,
    viewMatrix,
    projectionMatrix,
    crownColor,
    treeMesh.crownIndexOffset * 2
  );
}

