// Minimal WebGL viewer: sets up pointer-lock camera controls and feeds uniforms to the raymarching shader.
// Global variables
let gl;
let program;
let canvas;

// Camera state (edit here to tune feel)
const camera = {
    pos: [0, 10, 0], // World position
    yaw: 0,         // Horizontal angle in radians
    pitch: 0,       // Vertical angle in radians (clamped below)
    speed: 5.0,     // Walk/fly speed units per second
    fov: 0.5        // Scale factor for FOV passed to shader; higher = wider view
};

// Input state
const keys = {};
const mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false };

async function init() {
    canvas = document.getElementById('canvas');
    gl = canvas.getContext('webgl');

    if (!gl) {
        alert('WebGL not supported');
        return;
    }

    // Resize canvas to fill the viewport
    window.addEventListener('resize', resize);
    resize();

    // Input listeners
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    
    canvas.addEventListener('mousedown', () => {
        canvas.requestPointerLock();
        mouse.down = true;
    });
    
    document.addEventListener('pointerlockchange', () => {
        mouse.down = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', e => {
        if (mouse.down) {
            camera.yaw -= e.movementX * 0.002;
            camera.pitch -= e.movementY * 0.002; // Look up/down
            
            // Clamp pitch
            camera.pitch = Math.max(-1.5, Math.min(1.5, camera.pitch));
        }
    });

    // Load shaders
    const vsSource = await fetch('vert.glsl').then(r => r.text());
    const fsSource = await fetch('frag.glsl').then(r => r.text());

    program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    // Setup quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Start loop
    requestAnimationFrame(loop);
}

let lastTime = 0;

function loop(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    update(dt);
    render(time / 1000);

    requestAnimationFrame(loop);
}

function update(dt) {
    if (!mouse.down) return; // Only move when captured

    const speed = keys['ShiftLeft'] ? camera.speed * 4 : camera.speed; // Hold Shift to sprint
    const moveSpeed = speed * dt;

    const forward = [
        Math.sin(camera.yaw) * Math.cos(camera.pitch),
        Math.sin(camera.pitch),
        Math.cos(camera.yaw) * Math.cos(camera.pitch)
    ];
    
    // Flat forward for movement (ignore pitch for walking, keep for flying)
    // For flying, we use the camera forward vector directly.
    
    const right = [
        Math.cos(camera.yaw),
        0,
        -Math.sin(camera.yaw)
    ];

    if (keys['KeyW']) {
        camera.pos[0] -= Math.sin(camera.yaw) * moveSpeed;
        camera.pos[2] -= Math.cos(camera.yaw) * moveSpeed;
        camera.pos[1] += Math.sin(camera.pitch) * moveSpeed;
    }
    if (keys['KeyS']) {
        camera.pos[0] += Math.sin(camera.yaw) * moveSpeed;
        camera.pos[2] += Math.cos(camera.yaw) * moveSpeed;
        camera.pos[1] -= Math.sin(camera.pitch) * moveSpeed;
    }
    if (keys['KeyA']) {
        camera.pos[0] -= right[0] * moveSpeed;
        camera.pos[2] -= right[2] * moveSpeed;
    }
    if (keys['KeyD']) {
        camera.pos[0] += right[0] * moveSpeed;
        camera.pos[2] += right[2] * moveSpeed;
    }
}

function render(time) {
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Uniform locations (resolved each frame for simplicity)
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uCamPos = gl.getUniformLocation(program, 'uCamPos');
    const uCamDir = gl.getUniformLocation(program, 'uCamDir');
    const uCamUp = gl.getUniformLocation(program, 'uCamUp');
    const uFov = gl.getUniformLocation(program, 'uFov');

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, time);
    gl.uniform3fv(uCamPos, camera.pos);
    
    const forward = [
        Math.sin(camera.yaw) * Math.cos(camera.pitch),
        Math.sin(camera.pitch),
        Math.cos(camera.yaw) * Math.cos(camera.pitch)
    ];
    
    // Build camera direction; Z is flipped to look toward negative Z for a conventional forward
    gl.uniform3f(uCamDir, -Math.sin(camera.yaw) * Math.cos(camera.pitch), Math.sin(camera.pitch), -Math.cos(camera.yaw) * Math.cos(camera.pitch));
    
    gl.uniform3f(uCamUp, 0, 1, 0);
    gl.uniform1f(uFov, camera.fov);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function createProgram(gl, vsSource, fsSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
    }
    return prog;
}

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

init();
