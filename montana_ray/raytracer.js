
class RayTracer {
    constructor(gl, meshVS, meshFS) {
        this.prog = InitShaderProgram(meshVS, meshFS);

        this.uResolution = gl.getUniformLocation(this.prog, 'uResolution');
        this.uTanHalfFov = gl.getUniformLocation(this.prog, 'uTanHalfFov');
        this.uCamRot = gl.getUniformLocation(this.prog, 'uCamRot');
        this.uCamPos = gl.getUniformLocation(this.prog, 'uCamPos');
        this.uLightDir = gl.getUniformLocation(this.prog, 'uLightDir');
        this.uEpsilon = gl.getUniformLocation(this.prog, 'uEpsilon');
        this.uTime = gl.getUniformLocation(this.prog, 'uTime');
        this.uBiome = gl.getUniformLocation(this.prog, 'uBiome');
        this.uGridRadius = gl.getUniformLocation(this.prog, 'uGridRadius');
        this.uSeed = gl.getUniformLocation(this.prog, 'uSeed'); // New Seed Uniform

        this.aPos = gl.getAttribLocation(this.prog, 'pos');

        this.fullscreenBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
        const quad = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

        this._tanHalfFov = Math.tan((55.0 * Math.PI / 180.0) * 0.5); // Montana uses 55 fov
        this._epsilon = 0.0005;
        this._lightdir = [-0.4, 0.9, 0.25]; // Default until UI sets a value
        this.startTime = Date.now();
        this.seed = Math.random() * 100.0; // Generate random seed on load
    }

    draw(rotX, rotY, radius, target, biome, gridRadius) {
        gl.useProgram(this.prog);

        const wasDepthEnabled = gl.isEnabled(gl.DEPTH_TEST);
        if (wasDepthEnabled) gl.disable(gl.DEPTH_TEST);

        gl.uniform2f(this.uResolution, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(this.uTanHalfFov, this._tanHalfFov);
        gl.uniform1f(this.uEpsilon, this._epsilon);
        gl.uniform3fv(this.uLightDir, this._lightdir);
        gl.uniform1f(this.uTime, (Date.now() - this.startTime) * 0.001);
        gl.uniform1f(this.uBiome, biome);
        gl.uniform1f(this.uGridRadius, gridRadius);
        gl.uniform1f(this.uSeed, this.seed); // Pass seed

        // Camera Calculation mirroring Montana's logic
        // camera.yaw = rotY, camera.pitch = rotX, camera.radius = radius
        // The original logic:
        // cp = cos(pitch), sp = sin(pitch)
        // cy = cos(yaw), sy = sin(yaw)
        // eye = [r*cp*cy, r*sp+1.0, r*cp*sy]
        // view = lookAt(eye, target, [0,1,0])

        // However, the shader expects uCamRot (mat3) and uCamPos (vec3)
        // uCamPos is simply 'eye'.
        // uCamRot needs to be the Upper-Left 3x3 of the Inverse View Matrix (Camera -> World rotation)
        // If View = R_view * T_view, then World = T_world * R_world.
        // R_world = transpose(R_view). 
        // So we compute the View Matrix orientation and take its transpose (or just the basis vectors).

        const pitch = rotX;
        const yaw = rotY;

        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);

        const eye = [
            radius * cp * cy,
            radius * sp + 4.0, // Raised camera base height to avoid clipping into mountains
            radius * cp * sy
        ];

        // LookAt logic implementation to get Basis Vectors (World Space)
        // Z axis (forward) should be normalize(target - eye) for standard camera, 
        // BUT Raytracing usually expects Camera to World convention where -Z is forward.
        // Let's stick to standard GL lookAt convention: Z = normalize(eye - target)
        // X = cross(up, Z)
        // Y = cross(Z, X)
        // R_view rows are X, Y, Z.
        // R_world cols are X, Y, Z.

        const up = [0, 1, 0];
        const f = [ // forward vector (target - eye)
            target[0] - eye[0],
            target[1] - eye[1],
            target[2] - eye[2]
        ];

        // Normalize Z (which is -forward)
        let z = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
        const lenZ = Math.hypot(z[0], z[1], z[2]);
        z = [z[0] / lenZ, z[1] / lenZ, z[2] / lenZ];

        // X = cross(up, z)
        let x = [
            up[1] * z[2] - up[2] * z[1],
            up[2] * z[0] - up[0] * z[2],
            up[0] * z[1] - up[1] * z[0]
        ];
        const lenX = Math.hypot(x[0], x[1], x[2]);
        if (lenX > 0.0001) {
            x = [x[0] / lenX, x[1] / lenX, x[2] / lenX];
        } else {
            x = [1, 0, 0];
        }

        // Y = cross(z, x)
        let y = [
            z[1] * x[2] - z[2] * x[1],
            z[2] * x[0] - z[0] * x[2],
            z[0] * x[1] - z[1] * x[0]
        ];

        // R_world has columns X, Y, Z
        const R = new Float32Array([
            x[0], x[1], x[2],
            y[0], y[1], y[2],
            z[0], z[1], z[2]
        ]);

        // But wait, in the shader: rayDir = uCamRot * rayDirCam
        // rayDirCam points towards -1 in Z.
        // So Z column of uCamRot should be the "Back" vector (positive Z in camera space).
        // Yes, our 'z' variable is (eye - target), which is Backward. Correct.

        gl.uniformMatrix3fv(this.uCamRot, false, R);
        gl.uniform3fv(this.uCamPos, eye);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.fullscreenBuffer);
        gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.aPos);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        if (wasDepthEnabled) gl.enable(gl.DEPTH_TEST);
    }

    setEpsilon(val) {
        this._epsilon = val;
    }

    setLightDirFromAngles(azimuthDeg, elevationDeg) {
        const az = azimuthDeg * Math.PI / 180;
        const el = elevationDeg * Math.PI / 180;
        const x = Math.cos(el) * Math.cos(az);
        const y = Math.sin(el);
        const z = Math.cos(el) * Math.sin(az);
        this._lightdir = [x, y, z];
    }
}
