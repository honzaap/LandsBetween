/*
 *  Things that handle all the 3D stuff
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global GLTF loader
const loader = new GLTFLoader();

// Array of functions that are called in given order every frame
const logicHandlers = [];

export function createScene() {
    // Create scene
    const scene = new THREE.Scene();
    const camera = createCamera();
    const renderer = createRenderer(scene, camera);

    setupLighting(scene);

    setupEnvironment(scene);

    const controls = createControls(camera, renderer);

    //const {composer} = setupPostProcessing(scene, camera, renderer);

    const clock = new THREE.Clock();

    const dt = 1000 / 60;
    let timeTarget = 0;

    // Animation loop
    function animate() {
        if(Date.now() >= timeTarget){
            const delta = clock.getDelta();

            for(const handler of logicHandlers) {
                handler({delta, scene});
            }

            controls.update();

            renderer.render(scene, camera);


            timeTarget += dt;
            if(Date.now() >= timeTarget){
                timeTarget = Date.now();
            }
        }
        requestAnimationFrame(animate);
    }
    animate();

    // Resize renderer when window size changes
    window.onresize = () => {
        resizeRenderer(renderer);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };

    return { scene };
}

// Create and cofigure camera and return it
function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        65,
        window.innerWidth / window.innerHeight,
        0.1,
        400,
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    return camera;
}

// Create and configure camera and sword controls
function createControls(camera, renderer) {
    const controls = new OrbitControls(camera, renderer.domElement);

    return controls;
}

// Create and configure renderer and return it
function createRenderer(scene, camera) {
    const renderer = new THREE.WebGLRenderer({
        powerPreference: "high-performance",
        antialias: false,
        depth: true,
        canvas: document.querySelector("#canvas"),
    });

    renderer.localClippingEnabled = true;
    renderer.gammaInput = true;
    renderer.gammaOutput = true;
    
    resizeRenderer(renderer);

    renderer.render(scene, camera);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true; //?
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setPixelRatio(Math.max(window.devicePixelRatio, 1.5));
    renderer.toneMappingExposure = 1.16;
    renderer.setClearColor(0x000000);

    return renderer;
}

// Set's the renderers size to current window size
function resizeRenderer(renderer) {
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Configure postprocessing and return composer
function setupPostProcessing(scene, camera, renderer) {
}

// Set shadows on given object to given settings
function setShadow(obj, cast = false, receive = false) {
    obj.castShadow = cast;
    obj.receiveShadow = receive;
    if (obj?.children != null) {
        for (const child of obj.children) {
            setShadow(child, cast, receive);
        }
    }
}

// function generateLightOnEmission(obj) {
//     if(obj.material?.emissiveIntensity > 1) {
//         obj.material.emissiveIntensity = 1;
//         const pointLight = new THREE.PointLight(0xffffff, 7.2, 0, 2);
//         pointLight.position.y = -1.4;
//         pointLight.castShadow = false;
//         obj.add(pointLight); // TODO: Causes LAG?
//     }
//     if(obj.material?.opacity < 1) {
//         obj.castShadow = false;
//         obj.receiveShadow = false;
//         obj.material.emissive = new THREE.Color(0xbeb979);
//         obj.material.emissiveIntensity = 0.8;
//         obj.material.opacity = 1;
//         obj.material.depthWrite = false;
//     }
//     if (obj?.children != null) {
//         for (const child of obj.children) {
//             generateLightOnEmission(child);
//         }
//     }
// }

// Create and configure lighting in the scene
function setupLighting(scene) {
    const ambLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.castShadow = true;
    dirLight.shadow.bias = -0.001;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.userData.isUsed = false;
    dirLight.position.set(-18, 9, -10);
    dirLight.target.position.set(20, -5, 0);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 30;
    dirLight.shadow.camera.left = -38;
    dirLight.shadow.camera.right = 0;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -8;
    dirLight.frustumCulled = false;
    scene.add(dirLight);
}

// Create and setup anything environment-related
function setupEnvironment(scene) {
    scene.background = new THREE.Color(0x000000);
    //scene.fog = new THREE.Fog(scene.background, 40, 65);
    const tiles = ["tiles_limgrave.glb", "tiles_weeping.glb", "tiles_caelid.glb"];
    const props = ["props_limgrave.glb", "props_weeping.glb", "props_caelid.glb"];
    const legacyDungeons = ["legacy_dungeons.glb"];

    for (const tile of tiles) {
        loader.load(`./assets/${tile}`, (gltf) => {
            scene.add(gltf.scene);
        });
    }

    for (const prop of props) {
        loader.load(`./assets/${prop}`, (gltf) => {
            scene.add(gltf.scene);
        });
    }

    for (const dungeon of legacyDungeons) {
        loader.load(`./assets/${dungeon}`, (gltf) => {
            scene.add(gltf.scene);
        });
    }
}

// Render the scene
function render(scene, composer, bloomComposer) {
    composer.render();
}

