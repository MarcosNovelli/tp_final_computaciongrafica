
var rayTracer;
var canvas, gl;

// Camera state from Montana
// camera: { radius: 7.0, yaw: Math.PI * 0.42, pitch: 0.32, target: [0, 1.1, 0] };
var camRadius = 7.0;
var camYaw = Math.PI * 0.42;
var camPitch = 0.32;
var camTarget = [0, 1.1, 0];
var lightAzimuthDeg = -35;
var lightElevationDeg = 55;

async function InitWebGL() {
    canvas = document.getElementById("canvas");
    canvas.oncontextmenu = function () { return false; };
    gl = canvas.getContext("webgl", { antialias: false, depth: false }); // Depth not needed for fullscreen quad
    if (!gl) { alert("WebGL not supported"); return; }

    const ext = gl.getExtension("OES_texture_float");
    // Standard derivatives for normal calculation in shader if we use them, 
    // but here we might do finite differences in raymarching.

    const [meshVS, meshFS] = await Promise.all([
        fetch('vert.glsl').then(r => r.text()),
        fetch('frag.glsl').then(r => r.text()),
    ]);

    rayTracer = new RayTracer(gl, meshVS, meshFS);
    rayTracer.setLightDirFromAngles(lightAzimuthDeg, lightElevationDeg);

    UpdateCanvasSize();

    // Controls
    let dragging = false;
    let lastX = 0, lastY = 0;

    canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener("mouseup", () => { dragging = false; });
    canvas.addEventListener("mouseleave", () => { dragging = false; });
    canvas.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        const sens = 0.005;
        camYaw -= dx * sens;
        camPitch = Math.min(Math.max(camPitch - dy * sens, -1.2), 1.2);
        requestAnimationFrame(DrawScene);
    });
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const zoom = 1.0 + e.deltaY * 0.0015;
        camRadius = Math.min(Math.max(camRadius * zoom, 2.5), 25.0); // Increased max radius for raytracing view
        requestAnimationFrame(DrawScene);
    }, { passive: false });

    const biomeSelect = document.getElementById("biomeSelect");
    if (biomeSelect) {
        biomeSelect.addEventListener("change", (e) => {
            currentBiome = parseFloat(e.target.value);
            requestAnimationFrame(DrawScene);
        });
    }

    const btnLess = document.getElementById("btnLess");
    const btnMore = document.getElementById("btnMore");
    const gridSizeVal = document.getElementById("gridSizeVal");

    if (btnLess && btnMore && gridSizeVal) {
        btnLess.addEventListener("click", () => {
            if (gridRadius > 0) {
                gridRadius--;
                gridSizeVal.innerText = gridRadius;
                requestAnimationFrame(DrawScene);
            }
        });
        btnMore.addEventListener("click", () => {
            if (gridRadius < 10) { // Limit max size
                gridRadius++;
                gridSizeVal.innerText = gridRadius;
                requestAnimationFrame(DrawScene);
            }
        });
    }

    // Light controls
    const azSlider = document.getElementById("lightAzimuth");
    const elSlider = document.getElementById("lightElevation");
    const azVal = document.getElementById("lightAzimuthVal");
    const elVal = document.getElementById("lightElevationVal");

    function updateLight() {
        azVal.innerText = `${lightAzimuthDeg}°`;
        elVal.innerText = `${lightElevationDeg}°`;
        if (rayTracer) {
            rayTracer.setLightDirFromAngles(lightAzimuthDeg, lightElevationDeg);
            requestAnimationFrame(DrawScene);
        }
    }

    if (azSlider && elSlider && azVal && elVal) {
        azSlider.value = lightAzimuthDeg;
        elSlider.value = lightElevationDeg;
        azSlider.addEventListener("input", (e) => {
            lightAzimuthDeg = parseFloat(e.target.value);
            updateLight();
        });
        elSlider.addEventListener("input", (e) => {
            lightElevationDeg = parseFloat(e.target.value);
            updateLight();
        });
        updateLight();
    }

    DrawScene();

    // Animation loop for time-based effects
    function loop() {
        DrawScene();
        requestAnimationFrame(loop);
    }
    loop();
}

var currentBiome = 0.0;
var gridRadius = 0;

function UpdateCanvasSize() {
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = pixelRatio * canvas.clientWidth;
    canvas.height = pixelRatio * canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function DrawScene() {
    if (!rayTracer) return;
    rayTracer.draw(camPitch, camYaw, camRadius, camTarget, currentBiome, gridRadius);
}

function InitShaderProgram(vsSource, fsSource) {
    const vs = CompileShader(gl.VERTEX_SHADER, vsSource);
    const fs = CompileShader(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        alert('Link Error: ' + gl.getProgramInfoLog(prog));
        return null;
    }
    return prog;
}

function CompileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('Shader Compile Error: ' + gl.getShaderInfoLog(shader));
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

window.onload = InitWebGL;
window.onresize = function () { UpdateCanvasSize(); DrawScene(); };
