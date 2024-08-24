import { createScene, switchControls } from './scene.js';
import './style.scss'

// Create 3D environment
createScene();

// HTML elements
const loader = document.getElementById("progress");
const loadContainer = document.getElementById("loader");
const controlsFps = document.getElementById("fps");
const controlsOrbit = document.getElementById("orbit");

export function loadProgress(progress) {
    loader.style.width = `${progress * 100}%`;
}

export function loadComplete() {
    loadContainer.classList.add("hide");
}

controlsFps.onchange = () => {
    if (controlsFps.checked) switchControls("fps");
}

controlsOrbit.onchange = () => {
    if (controlsOrbit.checked) switchControls("orbit");
}