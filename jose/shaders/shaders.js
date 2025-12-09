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
    // Luces más ricas para dar sensación plástica y un sombreado suave
    const vec3 lightDir = normalize(vec3(0.6, 1.0, 0.4));
    
    if (uNoLighting > 0.5) {
      gl_FragColor = vec4(u_color, 1.0);
      return;
    }
    
    vec3 N = normalize(v_normal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    vec3 L = lightDir;
    
    vec3 base = u_color;
    
    // Difuso estilo half-lambert para sombras suaves
    float lambert = max(dot(N, L), 0.0);
    float halfLambert = lambert * 0.5 + 0.5; // evita sombras negras muy duras
    
    // Oclusión rápida: caras verticales reciben menos luz y la base del prisma se oscurece un poco
    float normalOcclusion = smoothstep(-0.3, 0.4, N.y);
    float heightOcclusion = clamp(0.78 + vWorldPosition.y * 0.04, 0.6, 1.1);
    float occlusion = clamp(normalOcclusion * heightOcclusion, 0.55, 1.0);
    
    // Especular suave para efecto plástico; más fuerte en el agua
    vec3 H = normalize(L + V);
    float shininess = mix(22.0, 64.0, step(0.5, uIsWater));
    float specStrength = mix(0.18, 0.35, step(0.5, uIsWater));
    float spec = pow(max(dot(N, H), 0.0), shininess) * specStrength;
    
    // Borde sutil para contorno plástico
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.4);
    vec3 rimColor = mix(base, vec3(1.0), 0.35);
    rim *= mix(0.18, 0.28, step(0.5, uIsWater));
    
    vec3 diffuse = base * (0.35 + halfLambert * 1.05) * occlusion;
    vec3 finalColor = diffuse + spec + rim * rimColor;
    
    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
  }
`;
