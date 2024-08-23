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
import { INSTANCED, TILES } from "./constants";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Global loaders
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath( '/draco/' );
draco.preload();
loader.setDRACOLoader(draco);

const textureLoader = new THREE.TextureLoader();

// Global GUI
const gui = new GUI();
const stats = new Stats();
document.body.appendChild(stats.dom);

// Global textures
const envmap = textureLoader.load("/assets/envmap.png"); 
envmap.mapping = THREE.EquirectangularReflectionMapping;
envmap.colorSpace = THREE.SRGBColorSpace;

// Global materials
const water = new THREE.MeshStandardMaterial();
const minorErdtree = new THREE.MeshStandardMaterial();
const fire = new THREE.MeshStandardMaterial();
const grace = new THREE.MeshStandardMaterial();

const moveDirection = new THREE.Vector3();
const raycaster = new THREE.Raycaster()

export function createScene() {
    // Create scene
    const scene = new THREE.Scene();
    const camera = createCamera();
    const renderer = createRenderer(scene, camera);

    renderer.info.autoReset = false;

    setupMaterials();
    setupLighting(scene);
    setupEnvironment(scene);
    setupInstancing(scene);

    const controls = createControls(camera, renderer);

    const composer = setupPostProcessing(scene, camera, renderer);

    renderer.domElement.addEventListener("dblclick", e => {
        onDoubleClick(e, camera, scene, controls, renderer);
    });

    const clock = new THREE.Clock();
    const clock2 = new THREE.Clock();

    const dt = 1000 / 60;
    let timeTarget = 0;

    let frameTimes = 0;
    let frames = 0;
    let loaded = false;
    setTimeout(() => {
        loaded = true;
    }, 2000);

    const velocity = new THREE.Vector3();
    const desiredVelocity = new THREE.Vector3();
    let factor = 0;
    let move = true;
    // Animation loop
    function animate() {
        stats.begin();
        if(Date.now() >= timeTarget){
            const delta = clock.getDelta();

            desiredVelocity.copy(moveDirection);
            desiredVelocity.applyEuler(camera.rotation);
            desiredVelocity.multiplyScalar(delta * 15);

            if (move !== (moveDirection.length() === 0)) {
                factor = 0;
            }

            factor = Math.min(factor + delta * 3, 1);

            velocity.lerp(desiredVelocity, factor);

            controls.update(delta);
            controls.target.add(velocity);
            camera.position.add(velocity);

            // renderer.render(scene, camera);
            composer.render();

            timeTarget += dt;
            if(Date.now() >= timeTarget){
                timeTarget = Date.now();
            }
            move = moveDirection.length() === 0;
        }

        const delta = clock2.getDelta();
        if (frames < 100 && loaded) {
            frames++;
            frameTimes += delta;
        
            if (frames >= 100) {
                renderer.shadowMap.enabled = false;
                if (frameTimes / frames > 0.025) { // less than 40 fps average
                    lowerAOPass();
                }
            }
        }

        // console.log(renderer.info.render.calls);
        stats.end();
        renderer.info.reset()
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

    return camera;
}

// Create and configure camera and sword controls
function createControls(camera, renderer) {
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(5.1, 22.1, 22.1);
    controls.target.set(5, 22, 22);
    controls.update();
    
    const params = {
        enableDamping: true,
        dampingFactor: 0.3,
        minDistance: 0,
        maxDistance: 0.01,
        panSpeed: 1,
        rotateSpeed: 1,
    }

    controls.enablePan = false;

    controls.enableDamping = params.enableDamping;
    controls.dampingFactor = params.dampingFactor;
    controls.minDistance = params.minDistance;
    controls.maxDistance = params.maxDistance;
    controls.panSpeed = params.panSpeed;
    controls.rotateSpeed = params.rotateSpeed;

    const controlsGui = gui.addFolder("Controls");
    controlsGui.add(params, "enableDamping").onChange((value) => controls.enableDamping = value);
    controlsGui.add(params, "dampingFactor", 0.0, 2).onChange((value) => controls.dampingFactor = value);
    controlsGui.add(params, "minDistance", 0, 5).onChange((value) => controls.minDistance = value);
    controlsGui.add(params, "maxDistance", 30, 250).onChange((value) => controls.maxDistance = value);
    controlsGui.add(params, "panSpeed", 0.5, 5).onChange((value) => controls.panSpeed = value);
    controlsGui.add(params, "rotateSpeed", 0.5, 5).onChange((value) => controls.rotateSpeed = value);
    controlsGui.close();

    window.addEventListener("keydown", e => {
        if (e.key === "w" || e.key === "ArrowUp") {
            moveDirection.z = -1;
        }
        else if (e.key === "s" || e.key === "ArrowDown") {
            moveDirection.z = 1;
        }
        else if (e.key === "a" || e.key === "ArrowLeft") {
            moveDirection.x = -1;
        }
        else if (e.key === "d" || e.key === "ArrowRight") {
            moveDirection.x = 1;
        }
    });
    window.addEventListener("keyup", e => {
        if (e.key === "w" || e.key === "ArrowUp") {
            moveDirection.z = 0;
        }
        else if (e.key === "s" || e.key === "ArrowDown") {
            moveDirection.z = 0;
        }
        else if (e.key === "a" || e.key === "ArrowLeft") {
            moveDirection.x = 0;
        }
        else if (e.key === "d" || e.key === "ArrowRight") {
            moveDirection.x = 0;
        }
    });

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMappingExposure = 1.16;
    renderer.setClearColor(0x000000);

    return renderer;
}

// Set"s the renderers size to current window size
function resizeRenderer(renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lowerAOPass = () => {};

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
    composer.addPass(bloomPass);

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
        rings: 1.,
        samples: 2,
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
        strength: 0.2,
        radius: 1,
    };
    
    bloomPass.threshold = paramsBloom.threshold;
    bloomPass.strength = paramsBloom.strength;
    bloomPass.radius = paramsBloom.radius;
    
    const bloomFolder = gui.addFolder("bloom");
    bloomFolder.add(paramsBloom, "threshold", 0.0, 1.0).onChange(function (value) { bloomPass.threshold = Number(value); });
    bloomFolder.add(paramsBloom, "strength", 0.0, 3.0).onChange(function (value) { bloomPass.strength = Number(value); });
    bloomFolder.add(paramsBloom, "radius", 0.0, 1.0).step(0.01).onChange(function (value) { bloomPass.radius = Number(value); });

    lowerAOPass = () => {
        aoParameters.samples = 8;
        gtaoPass.updateGtaoMaterial(aoParameters);
    }
    
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

// Create and configure lighting in the scene
function setupLighting(scene) {
    const ambLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambLight);

    const paramsD = {
        x: 18,
        y: 40,
        z: 10,
        color: 0xffffff,
    };

    const dirLight = new THREE.DirectionalLight(paramsD.color, 1);
    dirLight.castShadow = true;
    dirLight.shadow.radius = 25;
    dirLight.shadow.blurSamples = 25;
    dirLight.shadow.bias = -.0001;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
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
    dirLightGui.addColor(paramsD, "color").onChange(function(value) { dirLight.color  = new THREE.Color(value); });

    const hemiLight = new THREE.HemisphereLight(0xe5e7ff, 0xd2b156, 1.75);
    hemiLight.frustumCulled = false;
    scene.add(hemiLight);

    const paramsH = {
        sky: 0x7c7a90,
        ground: 0x5f5b4f,
        intensity: 7,
    };

    hemiLight.color = new THREE.Color(paramsH.sky);
    hemiLight.groundColor = new THREE.Color(paramsH.ground);
    hemiLight.intensity = paramsH.intensity;

    const lightGui = gui.addFolder("Hemisphere Light");
    lightGui.close();
    lightGui.addColor(paramsH, "sky").onChange(function(value) { hemiLight.color  = new THREE.Color(value); });
    lightGui.addColor(paramsH, "ground").onChange(function(value) { hemiLight.groundColor  = new THREE.Color(value); });
    lightGui.add(hemiLight, "intensity", 0, 7);
}

// Create and setup anything environment-related
function setupEnvironment(scene) {
    scene.background = new THREE.Color(0x50638e);
    scene.fog = new THREE.Fog(0x97aaaf, 90, 140);

    const sceneGui = gui.addFolder("Scene");
    sceneGui.close();

    const params = {
        background: 0x50638e,
        fog: 0xb0b0b0,
        start: 90,
        end: 140,
    }

    sceneGui.addColor(params, "background").onChange(function(value) { scene.background  = new THREE.Color(value); });
    sceneGui.addColor(params, "fog").onChange(function(value) { scene.fog = new THREE.Fog(params.fog, params.start, params.end); });
    sceneGui.add(params, "start", 50, 250).onChange(function(value) { scene.fog = new THREE.Fog(params.fog, params.start, params.end); });
    sceneGui.add(params, "end", 80, 350).onChange(function(value) { scene.fog = new THREE.Fog(params.fog, params.start, params.end); });

    for (const tile of TILES) {
        loader.load(`./assets/${tile}.glb`, (gltf) => {
            scene.add(gltf.scene);
            setShadow(gltf.scene, false, true);
            modifyMaterials(gltf.scene, scene);
            console.log(gltf.scene);
            for (const obj of gltf.scene.children[0].children) {
                if (obj.material.name === "Limgrave - Sand") {
                    setShadow(obj, false, false);
                    // obj.material.color = new THREE.Color(0x719D4E)
                }
            }
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
                child.material = minorErdtree;
                break;
            case "Water":
                child.receiveShadow = false;
                child.castShadow = false;
                child.material = water;
                break;
            case "Fire":
                child.material = fire;
                break;
            case "Grace Light":
                child.material = grace;
                break;
        }

        modifyMaterials(child);
    }
}

function setupMaterials() {
    water.envMap = envmap;
    water.transparent = true;
    water.depthWrite = true;
    water.needsUpdate = true;
    water.specularIntensity = 0;

    // Remove direct specular
    water.onBeforeCompile = shader => {
        shader.fragmentShader = 
          shader.fragmentShader.replace(
            'vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;',
            'vec3 totalSpecular = reflectedLight.indirectSpecular;'
          )
      };

    const paramsWater = {
        opacity: 0.6,
        color: 0x46d3dd,
        metalness: 0.853,
        roughness: 0.11,
       
    };

    water.opacity = paramsWater.opacity;
    water.color = new THREE.Color(paramsWater.color);
    water.metalness = paramsWater.metalness;
    water.roughness = paramsWater.roughness;
    
    const waterFolder = gui.addFolder("water");
    waterFolder.add(paramsWater, "opacity", 0.0, 3.0).onChange(function (value) { water.opacity = Number(value); });
    waterFolder.addColor(paramsWater, "color").onChange(function(value) { water.color  = new THREE.Color(value); });
    waterFolder.add(paramsWater, "metalness", 0.0, 1.0).onChange(function (value) { water.metalness = Number(value); });
    waterFolder.add(paramsWater, "roughness", 0.0, 1.0).onChange(function (value) { water.roughness = Number(value); });
    waterFolder.close();

    minorErdtree.color = new THREE.Color(0xFFFEB6);
    minorErdtree.emissive = new THREE.Color(0xffa51d);
    minorErdtree.emissiveIntensity = 5;

    fire.color = new THREE.Color(0x170a02);
    fire.emissive = new THREE.Color(0xff813b);
    fire.emissiveIntensity = 4;

    grace.color = new THREE.Color(0xfad57b);
    grace.emissive = new THREE.Color(0xe7b962);
    grace.emissiveIntensity = 2;
}

function setupInstancing(scene) {
    for (const instance_name of INSTANCED) {
        loader.load(`/assets/instanced/${instance_name}.glb`, (instance) => {
            loader.load(`/assets/instanced_data/${instance_name}.glb`, (data) => {
                const mesh = instance.scene.children[0];
                const transforms = data.scene.children;
                const iMesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, transforms.length);
                
                for (let i = 0; i < transforms.length; i++) {
                    iMesh.setMatrixAt(i, transforms[i].matrixWorld);
                }
                setShadow(iMesh, true, false);
                scene.add(iMesh);
            });
        });
    }
}

function onDoubleClick(event, camera, scene, controls, renderer) {
    const mouse = new THREE.Vector2();
    mouse.set(
        (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
        -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        const targetPosition = intersects[0].point;
        targetPosition.lerp(camera.position, 0.2);
    
        const direction = new THREE.Vector3();
        direction.subVectors(targetPosition, camera.position).normalize();
    
        const targetQuaternion = new THREE.Quaternion();
        targetQuaternion.setFromUnitVectors(camera.getWorldDirection(new THREE.Vector3()), direction);
    
        gsap.to(camera.quaternion, {
            duration: 0.75,
            x: targetQuaternion.x,
            y: targetQuaternion.y,
            z: targetQuaternion.z,
            w: targetQuaternion.w,
            ease: "power1.inOut",
            onUpdate: function () {
                camera.quaternion.normalize();
            }
        });
    
        gsap.to(controls.target, {
            duration: 1.35,
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z,
            ease: "power1.inOut",
            onUpdate: function () {
                controls.update();
            }
        });
    }
}