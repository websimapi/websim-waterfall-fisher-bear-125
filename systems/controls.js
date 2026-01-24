import * as THREE from 'three';
import { BEAR_X_LIMIT, nudgeBearZ } from '../entities/bear.js';
import { BEAR_Z_MIN, BEAR_Z_MAX } from '../entities/bear.js';
import { getOrbitControls, initOrbitControls } from '../scene.js';
import { toggleDevTools, resetDevTools } from './dev.js';
import { bear, gameState } from './game.js';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let keysPressed = {};
let isDragging = false;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2);
const _dragPoint = new THREE.Vector3();
let controlsActive = true;

export function setControlsActive(active) {
    controlsActive = active;
    isDragging = false;
    keysPressed = {};
}

function onPointerDown(event) {
    if (!controlsActive || gameState.current !== 'PLAYING' || event.target.tagName === 'BUTTON') return;
    isDragging = true;
    bear.userData.isMovingWithKeys = false;
    onPointerMove(event);
}

function onPointerMove(event) {
    if (!controlsActive || !isDragging || gameState.current !== 'PLAYING' || !bear) return;

    updatePointer(event);
    raycaster.setFromCamera(pointer, window.camera);
    if (raycaster.ray.intersectPlane(dragPlane, _dragPoint)) {
        bear.userData.targetX = THREE.MathUtils.clamp(_dragPoint.x, -BEAR_X_LIMIT, BEAR_X_LIMIT);
        bear.userData.zTarget = THREE.MathUtils.clamp(_dragPoint.z, BEAR_Z_MIN, BEAR_Z_MAX);
        bear.userData.isMovingWithKeys = false;
    }
}

function onPointerUp(event) {
    isDragging = false;
    if (!controlsActive || gameState.current !== 'PLAYING' || !bear) return;
    updatePointer(event);
    raycaster.setFromCamera(pointer, window.camera);
    if (raycaster.ray.intersectPlane(dragPlane, _dragPoint)) {
        const dz = _dragPoint.z - bear.position.z; 
        const mag = THREE.MathUtils.clamp(Math.abs(dz) / 2.0, 0, 1);
        const delta = (dz > 0 ? 1 : -1) * (0.06 + 0.12 * mag);
        nudgeBearZ(bear, delta);
    }
}

function updatePointer(event) {
    const eventCoord = event.changedTouches ? event.changedTouches[0] : event;
    pointer.x = (eventCoord.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(eventCoord.clientY / window.innerHeight) * 2 + 1;
}

function handleKeyDown(event) {
    if (!controlsActive || gameState.current !== 'PLAYING' || !bear) return;
    keysPressed[event.key] = true;
    if (event.key === 'a' || event.key === 'ArrowLeft' || event.key === 'd' || event.key === 'ArrowRight') {
        bear.userData.isMovingWithKeys = true;
    }
}

function handleKeyUp(event) {
    keysPressed[event.key] = false;
}

function updateBearMovement() {
    if (!controlsActive || !bear || gameState.current !== 'PLAYING' || !bear.userData.isMovingWithKeys) return;
    let moveDirection = 0;
    if (keysPressed['a'] || keysPressed['ArrowLeft']) moveDirection = -1;
    else if (keysPressed['d'] || keysPressed['ArrowRight']) moveDirection = 1;
    
    if (moveDirection !== 0) {
        bear.userData.targetX = THREE.MathUtils.clamp(bear.position.x + moveDirection * 0.2, -BEAR_X_LIMIT, BEAR_X_LIMIT);
    }
}

function handleGlobalKeyUp(event) {
    if (event.key === '`' || event.key === '~') {
        resetDevTools(getOrbitControls());
    }
}

function handleDevButtonClick() {
    toggleDevTools(initOrbitControls());
}

export function initControls(sceneRef, cameraRef) {
    window.scene = sceneRef; 
    window.camera = cameraRef; 

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keyup', handleGlobalKeyUp, true);

    const devButton = document.getElementById('dev-console-button');
    if (devButton) devButton.addEventListener('click', handleDevButtonClick);

    setInterval(updateBearMovement, 16);
}