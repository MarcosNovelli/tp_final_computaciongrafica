/**
 * ============================================================
 * shaders/shaders.js
 * ============================================================
 * 
 * RESPONSABILIDAD:
 * Este archivo contiene el código fuente de los shaders (vertex y fragment).
 */

/**
 * VERTEX SHADER 3D
 */
const vertexShaderSource = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform mat4 u_model;
  uniform mat4 u_view;
  uniform mat4 u_projection;
  uniform mat4 u_normalMatrix;
  
  varying vec3 v_normal;
  varying vec3 v_position;
  varying vec3 vWorldPosition;
  
  void main() {
    vec4 worldPosition = u_model * vec4(a_position, 1.0);
    v_position = worldPosition.xyz;
    vWorldPosition = worldPosition.xyz;
    
    v_normal = mat3(u_normalMatrix) * a_normal;
    
    gl_Position = u_projection * u_view * worldPosition;
  }
`;

/**
 * FRAGMENT SHADER
 */
const fragmentShaderSource = `
  precision mediump float;
  
  uniform vec3 u_color;
  uniform float uIsWater;
  uniform float uNoLighting;
  uniform vec3 uCameraPosition;
  
  varying vec3 v_normal;
  varying vec3 v_position;
  varying vec3 vWorldPosition;
  
  void main() {
    vec3 N = normalize(v_normal);
    
    vec3 L = normalize(vec3(0.6, 1.0, 0.4));
    
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    
    if (uIsWater > 0.5) {
      vec3 base = u_color;
      
      float lambert = max(dot(N, L), 0.0);
      lambert = 0.4 + lambert * 0.5;
      
      vec3 R = reflect(-L, N);
      float specAngle = max(dot(R, V), 0.0);
      float spec = pow(specAngle, 48.0) * 0.2;
      
      gl_FragColor = vec4(base * (0.5 + lambert * 0.7) + spec, 1.0);
      return;
    }
    
    vec3 base = u_color;
    
    float lambert = max(dot(N, L), 0.0);
    
    vec3 finalColor = base * (0.5 + lambert * 1.0);
    
    gl_FragColor = vec4(finalColor,1.0);
}
`;