/*
 *  Things that handle all the 3D stuff
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Global GLTF loader
const loader = new GLTFLoader();

// Array of functions that are called in given order every frame
const logicHandlers = [];

// Global GUI
const gui = new GUI();

export function createScene() {
    // Create scene
    const scene = new THREE.Scene();
    const camera = createCamera();
    const renderer = createRenderer(scene, camera);

    setupLighting(scene);

    setupEnvironment(scene);

    const controls = createControls(camera, renderer);

    const composer = setupPostProcessing(scene, camera, renderer);

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

            // renderer.render(scene, camera);
            composer.render();

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

// Set"s the renderers size to current window size
function resizeRenderer(renderer) {
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Configure postprocessing and return composer
function setupPostProcessing(scene, camera, renderer) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const gtaoPass = new GTAOPass(scene, camera, width, height);
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    composer.addPass(gtaoPass);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    // composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const aoParameters = {
        enabled: true,
        radius: 0.05,
        distanceExponent: 4.,
        thickness: 1.,
        scale: 1.1,
        samples: 16,
        distanceFallOff: 0.75,
        screenSpaceRadius: false,
    };
    const pdParameters = {
        lumaPhi: 10.,
        depthPhi: 2.,
        normalPhi: 3.,
        radius: 2.,
        radiusExponent: 1.,
        rings: 2.,
        samples: 16,
    };
    const aoGui = gui.addFolder("Ambient Occlusion");
    gtaoPass.updateGtaoMaterial(aoParameters);
    gtaoPass.updatePdMaterial(pdParameters);
    aoGui.add(gtaoPass, "enabled").onChange((value) => gtaoPass.enabled = value);
    aoGui.add(gtaoPass, "blendIntensity").min(0).max(1).step(0.01);
    aoGui.add(aoParameters, "radius").min(0.01).max(1).step(0.01).onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
    aoGui.add(aoParameters, "distanceExponent").min(1).max(4).step(0.01).onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
    aoGui.add(aoParameters, "thickness").min(0.01).max(10).step(0.01).onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
    aoGui.add(aoParameters, "distanceFallOff").min(0).max(1).step(0.01).onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
    aoGui.add(aoParameters, "scale").min(0.01).max(2.0).step(0.01).onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
    aoGui.add(aoParameters, "samples").min(2).max(32).step(1).onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
    aoGui.add(aoParameters, "screenSpaceRadius").onChange(() => gtaoPass.updateGtaoMaterial(aoParameters));
    aoGui.add(pdParameters, "lumaPhi").min(0).max(20).step(0.01).onChange(() => gtaoPass.updatePdMaterial(pdParameters));
    aoGui.add(pdParameters, "depthPhi").min(0.01).max(20).step(0.01).onChange(() => gtaoPass.updatePdMaterial(pdParameters));
    aoGui.add(pdParameters, "normalPhi").min(0.01).max(20).step(0.01).onChange(() => gtaoPass.updatePdMaterial(pdParameters));
    aoGui.add(pdParameters, "radius").min(0).max(32).step(1).onChange(() => gtaoPass.updatePdMaterial(pdParameters));
    aoGui.add(pdParameters, "radiusExponent").min(0.1).max(4.).step(0.1).onChange(() => gtaoPass.updatePdMaterial(pdParameters));
    aoGui.add(pdParameters, "rings").min(1).max(16).step(0.125).onChange(() => gtaoPass.updatePdMaterial(pdParameters));
    aoGui.add(pdParameters, "samples").min(2).max(32).step(1).onChange(() => gtaoPass.updatePdMaterial(pdParameters));
    aoGui.close();

    const paramsBloom = {
        threshold: 1,
        strength: 0.3,
        radius: 1,
    };
    
    bloomPass.threshold = paramsBloom.threshold;
    bloomPass.strength = paramsBloom.strength;
    bloomPass.radius = paramsBloom.radius;
    
    const bloomFolder = gui.addFolder("bloom");
    bloomFolder.add(paramsBloom, "threshold", 0.0, 1.0).onChange(function (value) { bloomPass.threshold = Number(value); });
    bloomFolder.add(paramsBloom, "strength", 0.0, 3.0).onChange(function (value) { bloomPass.strength = Number(value); });
    bloomFolder.add(paramsBloom, "radius", 0.0, 1.0).step(0.01).onChange(function (value) { bloomPass.radius = Number(value); });
    
    return composer;
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
    const ambLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambLight);

    const paramsD = {
        x: 18,
        y: 40,
        z: 10,
    };

    const dirLight = new THREE.DirectionalLight(0xffffff,1);
    dirLight.castShadow = true;
    dirLight.shadow.radius = 25;
    dirLight.shadow.blurSamples = 25;
    dirLight.shadow.bias = 0;
    dirLight.shadow.mapSize.width = 2048; // Will need to change this to fit the whole map once it"s finished
    dirLight.shadow.mapSize.height = 2048; // Will need to change this to fit the whole map once it"s finished
    dirLight.position.set(18, 40, 10);
    dirLight.target.position.set(-20, 0, -20);
    dirLight.shadow.camera.near = 0.2;       
    dirLight.shadow.camera.far = 65;
    dirLight.shadow.camera.left = -42;
    dirLight.shadow.camera.bottom = -31;
    dirLight.shadow.camera.right = 31;
    dirLight.shadow.camera.top = 49;
    dirLight.frustumCulled = false;
    scene.add(dirLight);
    scene.add(new THREE.DirectionalLightHelper(dirLight));

    const dirLightGui = gui.addFolder("Directional Light");
    dirLightGui.close();
    dirLightGui.add(paramsD, "x", -80, 80).onChange(function(value) { dirLight.position.x = value; });
    dirLightGui.add(paramsD, "y", -80, 80).onChange(function(value) { dirLight.position.y = value; });
    dirLightGui.add(paramsD, "z", -80, 80).onChange(function(value) { dirLight.position.z = value; });

    const hemiLight = new THREE.HemisphereLight(0xe5e7ff, 0xd2b156, 1.75);
    hemiLight.frustumCulled = false;
    scene.add(hemiLight);

    const paramsH = {
        sky: 0xe5e7ff,
        ground: 0xd2b156,
        intensity: 1.75
    };

    const lightGui = gui.addFolder("Hemisphere Light");
    lightGui.close();
    lightGui.addColor(paramsH, "sky").onChange(function(value) { hemiLight.color  = new THREE.Color(value); });
    lightGui.addColor(paramsH, "ground").onChange(function(value) { hemiLight.groundColor  = new THREE.Color(value); });
    lightGui.add(hemiLight, "intensity", 0, 7);
}

// Create and setup anything environment-related
function setupEnvironment(scene) {
    scene.background = new THREE.Color(0x50638e);
    //scene.fog = new THREE.Fog(scene.background, 40, 65);
    const tiles = ["tiles_limgrave.glb", "tiles_weeping.glb", "tiles_caelid.glb", "tiles_liurnia.glb", "tiles_global.glb"];
    const props = ["props_limgrave.glb", "props_weeping.glb", "props_caelid.glb", "props_liurnia.glb"];
    const legacyDungeons = ["legacy_dungeons.glb"];

    for (const tile of tiles) {
        loader.load(`./assets/${tile}`, (gltf) => {
            scene.add(gltf.scene);
            setShadow(gltf.scene, false, true);
            modifyMaterials(gltf.scene, scene);
        });
    }

    for (const prop of props) {
        loader.load(`./assets/${prop}`, (gltf) => {
            scene.add(gltf.scene);
            setShadow(gltf.scene, false, false);
            modifyMaterials(gltf.scene, scene);
        });
    }

    for (const dungeon of legacyDungeons) {
        loader.load(`./assets/${dungeon}`, (gltf) => {
            scene.add(gltf.scene);
            setShadow(gltf.scene, false, false);
            modifyMaterials(gltf.scene, scene);
        });
    }
}

// Render the scene
function render(scene, composer, bloomComposer) {
    composer.render();
}

function modifyMaterials(object, scene) {
    if (!object.children) return;
    for (const child of object.children) {

        switch (child.material?.name) {
            case "Erdtree Minor Leaves":
                child.material.color = new THREE.Color(0xFFFEB6);
                break;
            case "Water":
                console.log(child.material);
                child.material.blending = THREE.AdditiveBlending;
                child.material.opacity = 2;
                child.material.color = new THREE.Color(0x2E86B4);
                child.material.metalness = 0.65;
                child.material.roughness = 0.25;
                break;
        }

        modifyMaterials(child);
    }
}