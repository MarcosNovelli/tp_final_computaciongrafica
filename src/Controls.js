import * as THREE from 'three';

export class FlightControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;

        this.speed = 20.0;
        this.turnSpeed = 1.0;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;

        this.pitch = 0;
        this.yaw = 0;

        this.initListeners();
    }

    initListeners() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Simple mouse look
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                this.yaw -= e.movementX * 0.002;
                this.pitch -= e.movementY * 0.002;
                this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
            }
        });

        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.moveForward = true; break;
            case 'KeyS': this.moveBackward = true; break;
            case 'KeyA': this.moveLeft = true; break;
            case 'KeyD': this.moveRight = true; break;
            case 'Space': this.moveUp = true; break;
            case 'ShiftLeft': this.moveDown = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.moveForward = false; break;
            case 'KeyS': this.moveBackward = false; break;
            case 'KeyA': this.moveLeft = false; break;
            case 'KeyD': this.moveRight = false; break;
            case 'Space': this.moveUp = false; break;
            case 'ShiftLeft': this.moveDown = false; break;
        }
    }

    update(dt) {
        const moveSpeed = this.speed * dt;

        // Rotation
        this.camera.rotation.set(0, 0, 0);
        this.camera.rotateY(this.yaw);
        this.camera.rotateX(this.pitch);

        // Movement
        if (this.moveForward) this.camera.translateZ(-moveSpeed);
        if (this.moveBackward) this.camera.translateZ(moveSpeed);
        if (this.moveLeft) this.camera.translateX(-moveSpeed);
        if (this.moveRight) this.camera.translateX(moveSpeed);
        if (this.moveUp) this.camera.translateY(moveSpeed);
        if (this.moveDown) this.camera.translateY(-moveSpeed);
    }
}
