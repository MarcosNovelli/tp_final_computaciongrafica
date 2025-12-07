/**
 * ============================================================
 * render/gl.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene todas las funciones de ayuda para trabajar
 * con WebGL. Es un módulo de utilidades que encapsula las operaciones
 * comunes de WebGL, como:
 * - Inicialización del contexto WebGL
 * - Creación y compilación de shaders
 * - Creación y vinculación de programas
 * - Manejo de buffers
 * - Operaciones de limpieza y dibujado básicas
 * 
 * Este archivo NO contiene lógica de la aplicación específica,
 * solo funciones genéricas y reutilizables para WebGL.
 */

/**
 * ============================================================
 * INICIALIZACIÓN
 * ============================================================
 */

/**
 * Inicializa el contexto WebGL obteniendo el canvas del HTML.
 * 
 * RESPONSABILIDAD:
 * - Buscar el elemento canvas en el DOM
 * - Obtener el contexto WebGL del navegador
 * - Verificar que WebGL esté disponible
 * 
 * @param {string} canvasId - ID del elemento canvas en el HTML
 * @returns {{gl: WebGLRenderingContext, canvas: HTMLCanvasElement} | null}
 *          Objeto con el contexto WebGL y el canvas, o null si hay error
 */
function initWebGL(canvasId = 'glCanvas') {
  const canvas = document.getElementById(canvasId);
  
  if (!canvas) {
    console.error(`Error: No se encontró el elemento canvas con ID "${canvasId}"`);
    return null;
  }

  // Obtiene el contexto WebGL (versión 1.0, que es más compatible)
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    alert('Error: Tu navegador no soporta WebGL');
    return null;
  }

  console.log('✓ WebGL inicializado correctamente');
  return { gl, canvas };
}

/**
 * ============================================================
 * SHADERS
 * ============================================================
 */

/**
 * Crea y compila un shader del tipo especificado.
 * 
 * RESPONSABILIDAD:
 * - Crear un objeto shader en WebGL
 * - Compilar el código fuente del shader
 * - Verificar errores de compilación y reportarlos
 * - Retornar el shader compilado o null si hay error
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {number} type - Tipo de shader (gl.VERTEX_SHADER o gl.FRAGMENT_SHADER)
 * @param {string} source - Código fuente del shader en formato string
 * @returns {WebGLShader | null} - Shader compilado o null si hay error
 */
function createShader(gl, type, source) {
  // Crea un objeto shader del tipo especificado
  const shader = gl.createShader(type);
  
  // Asigna el código fuente al shader
  gl.shaderSource(shader, source);
  
  // Compila el shader
  gl.compileShader(shader);
  
  // Verifica si la compilación fue exitosa
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    console.error('Error compilando shader:', error);
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

/**
 * Crea un programa WebGL que combina un vertex shader y un fragment shader.
 * 
 * RESPONSABILIDAD:
 * - Crear y compilar ambos shaders (vertex y fragment)
 * - Crear un programa WebGL
 * - Adjuntar ambos shaders al programa
 * - Vincular el programa (conectar los shaders)
 * - Verificar errores de vinculación
 * - Retornar el programa listo para usar o null si hay error
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {string} vertexSource - Código fuente del vertex shader
 * @param {string} fragmentSource - Código fuente del fragment shader
 * @returns {WebGLProgram | null} - Programa WebGL o null si hay error
 */
function createProgram(gl, vertexSource, fragmentSource) {
  // Crea y compila ambos shaders usando la función createShader
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  
  if (!vertexShader || !fragmentShader) {
    return null;
  }
  
  // Crea un programa WebGL
  const program = gl.createProgram();
  
  // Adjunta los shaders al programa
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  
  // Vincula el programa (conecta los shaders)
  gl.linkProgram(program);
  
  // Verifica si la vinculación fue exitosa
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    console.error('Error vinculando programa:', error);
    gl.deleteProgram(program);
    return null;
  }
  
  console.log('✓ Programa WebGL creado y vinculado correctamente');
  return program;
}

/**
 * ============================================================
 * BUFFERS
 * ============================================================
 */

/**
 * Crea un buffer WebGL y carga datos en él.
 * 
 * RESPONSABILIDAD:
 * - Crear un nuevo buffer en la GPU
 * - Activar el buffer (seleccionarlo)
 * - Cargar los datos en el buffer
 * - Configurar el buffer como estático (datos no cambiarán)
 * 
 * Un buffer es una región de memoria en la GPU donde almacenamos
 * datos de vértices (como posiciones, colores, normales, etc.).
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {Float32Array | Array<number>} data - Datos de los vértices
 * @param {number} usage - Uso del buffer (gl.STATIC_DRAW por defecto)
 * @returns {WebGLBuffer} - Buffer creado y cargado con los datos
 */
function createBuffer(gl, data, usage = gl.STATIC_DRAW) {
  // Crea un nuevo buffer
  const buffer = gl.createBuffer();
  
  // Activa el buffer (lo selecciona como el buffer activo)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  
  // Carga los datos en el buffer
  // Si data no es un TypedArray, lo convierte a Float32Array
  const typedData = data instanceof Float32Array ? data : new Float32Array(data);
  gl.bufferData(gl.ARRAY_BUFFER, typedData, usage);
  
  return buffer;
}

/**
 * ============================================================
 * LIMPIEZA Y DIBUJADO
 * ============================================================
 */

/**
 * Limpia el canvas con un color específico.
 * 
 * RESPONSABILIDAD:
 * - Establecer el color de limpieza
 * - Limpiar el buffer de color del canvas
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {number} r - Componente rojo (0.0 a 1.0)
 * @param {number} g - Componente verde (0.0 a 1.0)
 * @param {number} b - Componente azul (0.0 a 1.0)
 * @param {number} a - Componente alpha/transparencia (0.0 a 1.0)
 */
function clearCanvas(gl, r = 0.1, g = 0.1, b = 0.15, a = 1.0) {
  gl.clearColor(r, g, b, a);
  // Limpia tanto el buffer de color como el de profundidad (para 3D)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

/**
 * Configura un atributo de vértice para que lea datos de un buffer.
 * 
 * RESPONSABILIDAD:
 * - Obtener la ubicación del atributo en el shader
 * - Activar el buffer que contiene los datos
 * - Habilitar el atributo
 * - Especificar cómo leer los datos del buffer (formato, stride, offset)
 * 
 * @param {WebGLRenderingContext} gl - Contexto WebGL
 * @param {WebGLProgram} program - Programa de shaders
 * @param {string} attributeName - Nombre del atributo en el shader (ej: 'a_position')
 * @param {WebGLBuffer} buffer - Buffer que contiene los datos
 * @param {number} size - Número de componentes por vértice (ej: 2 para x,y)
 * @param {number} type - Tipo de dato (gl.FLOAT por defecto)
 * @param {boolean} normalize - Si normalizar los valores (false por defecto)
 * @param {number} stride - Bytes entre vértices (0 = compacto)
 * @param {number} offset - Bytes desde el inicio del buffer (0 por defecto)
 */
function setupAttribute(
  gl,
  program,
  attributeName,
  buffer,
  size,
  type = gl.FLOAT,
  normalize = false,
  stride = 0,
  offset = 0
) {
  // Obtiene la ubicación del atributo en el shader
  const location = gl.getAttribLocation(program, attributeName);
  
  if (location === -1) {
    console.warn(`Advertencia: Atributo "${attributeName}" no encontrado en el shader`);
    return;
  }
  
  // Activa el buffer de vértices
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  
  // Habilita el atributo
  gl.enableVertexAttribArray(location);
  
  // Especifica cómo leer los datos del buffer
  gl.vertexAttribPointer(location, size, type, normalize, stride, offset);
}

