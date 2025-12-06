import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.geometry = new THREE.PlaneGeometry(200, 200, 100, 100);
    this.geometry.rotateX(-Math.PI / 2);

    this.noise2D = createNoise2D();
    this.generateTerrain();
    
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.2
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    
    // Water plane
    const waterGeo = new THREE.PlaneGeometry(200, 200);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0077be,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.1
    });
    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.position.y = -2; // Water level
    this.scene.add(this.water);
  }

  generateTerrain() {
    const posAttribute = this.geometry.attributes.position;
    const colors = [];
    const color = new THREE.Color();

    for (let i = 0; i < posAttribute.count; i++) {
      const x = posAttribute.getX(i);
      const z = posAttribute.getZ(i);
      
      // Combine multiple layers of noise (octaves)
      let y = 0;
      y += this.noise2D(x * 0.01, z * 0.01) * 10;
      y += this.noise2D(x * 0.05, z * 0.05) * 2;
      y += this.noise2D(x * 0.1, z * 0.1) * 0.5;

      posAttribute.setY(i, y);

      // Color based on height
      if (y < -2) {
        color.setHex(0xe0cda8); // Sand (underwater/shore)
      } else if (y < 2) {
        color.setHex(0x2d8f38); // Grass
      } else if (y < 8) {
        color.setHex(0x6e583b); // Rock
      } else {
        color.setHex(0xffffff); // Snow
      }
      
      colors.push(color.r, color.g, color.b);
    }

    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.computeVertexNormals();
  }
}
