/**
 * ============================================================
 * render/geometry.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones para generar geometría 3D.
 */

/**
 * Calcula la normal de un triángulo usando producto cruzado.
 */
function calculateTriangleNormal(v1, v2, v3) {
  const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
  const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
  
  const nx = edge1[1] * edge2[2] - edge1[2] * edge2[1];
  const ny = edge1[2] * edge2[0] - edge1[0] * edge2[2];
  const nz = edge1[0] * edge2[1] - edge1[1] * edge2[0];
  
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length === 0) return [0, 1, 0];
  
  return [nx / length, ny / length, nz / length];
}

/**
 * Crea los datos de un prisma hexagonal 3D (columna hexagonal) con normales.
 */
function createHexagonPrismData(radius = HEX_RADIUS_WORLD, height = 1.0) {
  const positions = [];
  const normals = [];
  const numVertices = 6;
  const angleStep = (2 * Math.PI) / numVertices;
  const angleOffset = 0;
  
  const bottomVertices = [];
  const topVertices = [];
  
  for (let i = 0; i < numVertices; i++) {
    const angle = i * angleStep + angleOffset;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    
    bottomVertices.push([x, 0.0, z]);
    topVertices.push([x, height, z]);
  }
  
  // TAPA INFERIOR
  const bottomCenter = [0.0, 0.0, 0.0];
  const bottomNormal = [0, -1, 0];
  
  for (let i = 0; i < numVertices; i++) {
    const v1 = bottomCenter;
    const v2 = bottomVertices[i];
    const v3 = bottomVertices[(i + 1) % numVertices];
    
    positions.push(v1[0], v1[1], v1[2]);
    positions.push(v2[0], v2[1], v2[2]);
    positions.push(v3[0], v3[1], v3[2]);
    
    normals.push(bottomNormal[0], bottomNormal[1], bottomNormal[2]);
    normals.push(bottomNormal[0], bottomNormal[1], bottomNormal[2]);
    normals.push(bottomNormal[0], bottomNormal[1], bottomNormal[2]);
  }
  
  // TAPA SUPERIOR
  const topCenter = [0.0, height, 0.0];
  const topNormal = [0, 1, 0];
  
  for (let i = 0; i < numVertices; i++) {
    const v1 = topCenter;
    const v2 = topVertices[(i + 1) % numVertices];
    const v3 = topVertices[i];
    
    positions.push(v1[0], v1[1], v1[2]);
    positions.push(v2[0], v2[1], v2[2]);
    positions.push(v3[0], v3[1], v3[2]);
    
    normals.push(topNormal[0], topNormal[1], topNormal[2]);
    normals.push(topNormal[0], topNormal[1], topNormal[2]);
    normals.push(topNormal[0], topNormal[1], topNormal[2]);
  }
  
  // CARAS LATERALES
  for (let i = 0; i < numVertices; i++) {
    const nextI = (i + 1) % numVertices;
    
    const bottom1 = bottomVertices[i];
    const bottom2 = bottomVertices[nextI];
    const top1 = topVertices[i];
    const top2 = topVertices[nextI];
    
    // Primer triángulo
    positions.push(bottom1[0], bottom1[1], bottom1[2]);
    positions.push(bottom2[0], bottom2[1], bottom2[2]);
    positions.push(top1[0], top1[1], top1[2]);
    
    const normal1 = calculateTriangleNormal(bottom1, bottom2, top1);
    normals.push(normal1[0], normal1[1], normal1[2]);
    normals.push(normal1[0], normal1[1], normal1[2]);
    normals.push(normal1[0], normal1[1], normal1[2]);
    
    // Segundo triángulo
    positions.push(top1[0], top1[1], top1[2]);
    positions.push(bottom2[0], bottom2[1], bottom2[2]);
    positions.push(top2[0], top2[1], top2[2]);
    
    const normal2 = calculateTriangleNormal(top1, bottom2, top2);
    normals.push(normal2[0], normal2[1], normal2[2]);
    normals.push(normal2[0], normal2[1], normal2[2]);
    normals.push(normal2[0], normal2[1], normal2[2]);
  }
  
  console.log(`✓ Prisma hexagonal generado con normales: radio=${radius}, altura=${height}`);
  
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals)
  };
}

