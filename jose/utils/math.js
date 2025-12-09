/**
 * ============================================================
 * utils/math.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene funciones matemáticas para matrices, vectores y transformaciones 3D.
 */

/**
 * Multiplica dos matrices 4x4.
 */
function multiplyMat4(a, b) {
  // Column-major multiplication (a * b) compatible with WebGL uniforms.
  const out = new Float32Array(16);

  const a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3];
  const a10 = a[4],  a11 = a[5],  a12 = a[6],  a13 = a[7];
  const a20 = a[8],  a21 = a[9],  a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0]  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[1]  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[2]  = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[3]  = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4]  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[5]  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[6]  = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[7]  = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8]  = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[9]  = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[10] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[11] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[15] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

  return out;
}

/**
 * Crea una matriz de identidad 4x4.
 */
function identityMat4() {
  const out = new Float32Array(16);
  out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
  return out;
}

/**
 * Crea una matriz de proyección en perspectiva.
 */
function perspective(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov * Math.PI / 360.0);
  const rangeInv = 1.0 / (near - far);
  
  const out = new Float32Array(16);
  
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (near + far) * rangeInv;
  out[11] = -1;
  out[14] = near * far * rangeInv * 2;
  out[15] = 0;
  
  return out;
}

/**
 * Normaliza un vector 3D.
 */
function normalizeVec3(v) {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (length === 0) return [0, 0, 0];
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Producto cruzado entre dos vectores 3D.
 */
function crossVec3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

/**
 * Crea una matriz de vista usando lookAt (mirar hacia un punto).
 */
function lookAt(eye, center, up) {
  const f = normalizeVec3([
    center[0] - eye[0],
    center[1] - eye[1],
    center[2] - eye[2]
  ]);
  
  const s = normalizeVec3(crossVec3(f, up));
  const u = crossVec3(s, f);
  
  const out = new Float32Array(16);
  
  out[0] = s[0];
  out[1] = u[0];
  out[2] = -f[0];
  out[3] = 0;
  
  out[4] = s[1];
  out[5] = u[1];
  out[6] = -f[1];
  out[7] = 0;
  
  out[8] = s[2];
  out[9] = u[2];
  out[10] = -f[2];
  out[11] = 0;
  
  out[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
  out[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
  out[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
  out[15] = 1;
  
  return out;
}

/**
 * Crea una matriz de traslación 4x4.
 */
function translateMat4(x, y, z) {
  const out = identityMat4();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

/**
 * Crea una matriz de escala 4x4.
 */
function scaleMat4(x, y, z) {
  const out = new Float32Array(16);
  out[0] = x;
  out[5] = y;
  out[10] = z;
  out[15] = 1;
  return out;
}

/**
 * Transpone una matriz 4x4.
 */
function transposeMat4(m) {
  const out = new Float32Array(16);
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = m[j * 4 + i];
    }
  }
  
  return out;
}

/**
 * Calcula la inversa de una matriz 4x4.
 */
function invertMat4(m) {
  const out = new Float32Array(16);
  const inv = new Float32Array(16);
  
  for (let i = 0; i < 16; i++) {
    inv[i] = m[i];
  }
  
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = (i === j) ? 1.0 : 0.0;
    }
  }
  
  for (let i = 0; i < 4; i++) {
    let pivot = i;
    let maxVal = Math.abs(inv[i * 4 + i]);
    
    for (let j = i + 1; j < 4; j++) {
      const val = Math.abs(inv[j * 4 + i]);
      if (val > maxVal) {
        maxVal = val;
        pivot = j;
      }
    }
    
    if (maxVal < 0.0001) {
      console.warn('Matriz no invertible, retornando identidad');
      return identityMat4();
    }
    
    if (pivot !== i) {
      for (let j = 0; j < 4; j++) {
        let temp = inv[i * 4 + j];
        inv[i * 4 + j] = inv[pivot * 4 + j];
        inv[pivot * 4 + j] = temp;
        
        temp = out[i * 4 + j];
        out[i * 4 + j] = out[pivot * 4 + j];
        out[pivot * 4 + j] = temp;
      }
    }
    
    const pivotVal = inv[i * 4 + i];
    for (let j = 0; j < 4; j++) {
      inv[i * 4 + j] /= pivotVal;
      out[i * 4 + j] /= pivotVal;
    }
    
    for (let j = 0; j < 4; j++) {
      if (j !== i) {
        const factor = inv[j * 4 + i];
        for (let k = 0; k < 4; k++) {
          inv[j * 4 + k] -= inv[i * 4 + k] * factor;
          out[j * 4 + k] -= out[i * 4 + k] * factor;
        }
      }
    }
  }
  
  return out;
}

/**
 * Calcula la matriz normal (inversa transpuesta de la matriz modelo).
 */
function calculateNormalMatrix(modelMatrix) {
  const inverseModel = invertMat4(modelMatrix);
  const normalMatrix = transposeMat4(inverseModel);
  return normalMatrix;
}

/**
 * Genera un número aleatorio en un rango [min, max].
 */
function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Limita un valor al rango [0, 1].
 */
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
