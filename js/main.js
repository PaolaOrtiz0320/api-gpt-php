import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';  // Agregado para cargar FBX
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Estado global ---
let camera, scene, renderer, clock, mixer;
let controls;
let currentState = 'MENU';

// --- Animaciones personaje (Boxing) ---
let actions = {};
let activeAction = null;

// --- Gaze/VR ---
let reticle, raycaster, interactableGroup;
let currentGazeTarget = null;
let gazeDwellTime = 0;
const DWELL_TIME_THRESHOLD = 2.0;

// UI HTML
const uiMenu   = document.getElementById('menu-ui');
const uiGame   = document.getElementById('game-ui');
const btnToEnv1 = document.getElementById('btn-to-env1');
const btnToEnv2 = document.getElementById('btn-to-env2');
const btnToMenu = document.getElementById('btn-to-menu');
const btnToOther = document.getElementById('btn-to-other');
const container  = document.getElementById('app-container');

// Navbar
const navMenu = document.getElementById('nav-menu');
const navE1   = document.getElementById('nav-e1');
const navE2   = document.getElementById('nav-e2');

// Footer año
document.getElementById('year').textContent = new Date().getFullYear();

// --- Init ---
function init() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;

  // Botón VR en #vr-slot
  const vrBtn = VRButton.createButton(renderer);
  const vrSlot = document.getElementById('vr-slot');
  if (vrSlot) vrSlot.appendChild(vrBtn);
  container.appendChild(renderer.domElement);

  // Raycaster + grupo de interactuables
  raycaster = new THREE.Raycaster();
  interactableGroup = new THREE.Group();
  scene.add(interactableGroup);

  // Retícula
  const reticleGeo = new THREE.CircleGeometry(0.002, 16);
  const reticleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, fog: false, depthTest: false, transparent: true, opacity: 0.75
  });
  reticle = new THREE.Mesh(reticleGeo, reticleMat);
  reticle.position.z = -0.5;
  reticle.renderOrder = 999;
  camera.add(reticle);

  renderer.xr.addEventListener('sessionstart', updateUIVisibility);
  renderer.xr.addEventListener('sessionend', updateUIVisibility);

  // Botones overlay
  btnToEnv1.onclick = () => switchScene('ESCENARIO_1');
  btnToEnv2.onclick = () => switchScene('ESCENARIO_2');
  btnToMenu.onclick = () => switchScene('MENU');

  // Navbar
  navMenu.onclick = () => switchScene('MENU');
  navE1.onclick   = () => switchScene('ESCENARIO_1');
  navE2.onclick   = () => switchScene('ESCENARIO_2');

  window.addEventListener('resize', onWindowResize);
  renderer.setAnimationLoop(animate);

  switchScene('MENU');
}

// --- Animación ---
function animate() {
  const delta = clock.getDelta();

  if (currentState === 'ESCENARIO_1' || currentState === 'ESCENARIO_2') {
    if (controls) controls.update();
  }
  if (currentState === 'ESCENARIO_2' && mixer) mixer.update(delta);

  handleGazeInteraction(delta);
  renderer.render(scene, camera);
}

// --- Cambio de escena ---
function switchScene(newState) {
  currentState = newState;

  // Limpieza
  scene.clear();
  interactableGroup.clear();
  if (mixer) mixer = null;
  actions = {};
  activeAction = null;
  if (controls) { controls.dispose(); controls = null; }

  // Persistentes
  scene.add(camera);
  scene.add(interactableGroup);

  currentGazeTarget = null;
  gazeDwellTime = 0;

  // Escenas
  if (newState === 'MENU') {
    setupMenu();
    createVRMenu();
  } else if (newState === 'ESCENARIO_1') {
    setupEscenario1();
    createVRGameUI();
  } else if (newState === 'ESCENARIO_2') {
    setupEscenario2();
    createVRGameUI();
  }

  updateUIVisibility();
}

// --- Escenas ---
function setupMenu() {
  scene.background = new THREE.Color(0x11151b);
  camera.position.set(0, 0, 0.1);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0x88ccff, 0.8);
  dir.position.set(3, 5, 2);
  scene.add(dir);

  const geometry = new THREE.IcosahedronGeometry(0.5, 1);
  const material = new THREE.MeshStandardMaterial({
    metalness: 0.6, roughness: 0.2, color: 0x67b7ff, emissive: 0x0a2f66, emissiveIntensity: 0.25
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, -2);
  scene.add(mesh);
}

function setupEscenario1() {
  scene.background = new THREE.Color(0x0d2338);
  scene.fog = new THREE.Fog(0x0d2338, 0, 60);

  const hemi = new THREE.HemisphereLight(0x9ad7ff, 0x001e2e, 1.4);
  hemi.position.set(2, 1, 1);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 2.2);
  dir.position.set(-5, 25, -1);
  scene.add(dir);

  camera.position.set(0, 20, 0);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.enablePan = false;

  // GLB del mapa
  const loader = new GLTFLoader();
  const mapaUrl = new URL('../models/Fnafmovie_map.glb', import.meta.url);
  loader.load(mapaUrl.href, (gltf) => {
    gltf.scene.rotation.y = -Math.PI / 2;
    scene.add(gltf.scene);
  }, undefined, (e) => console.error('Error cargando mapa GLB:', e));
}

function setupEscenario2() {
  scene.background = new THREE.Color(0x081a28);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.4));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
  dirLight.position.set(1, 2, 3);
  scene.add(dirLight);

  const floorGeo = new THREE.PlaneGeometry(120, 120);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f2d3f, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  camera.position.set(2, 2, 5);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(3, 1, -3);
  controls.enableDamping = true;

  // Cargar modelo FBX (Paladin) y su animación Boxing
  const loader = new FBXLoader();
  const urlModel = '../models/Paladin_WProp_J_Nordstrom.fbx';  // Cambia esta ruta por la de tu modelo Paladin
  const urlAnim = '../models/Boxing.fbx';  // Cambia esta ruta por la de tu animación Boxing

  loader.load(urlModel, (object) => {
    object.scale.set(0.01, 0.01, 0.01);  // Ajusta el tamaño del modelo
    object.position.set(0, 0, -3);      // Coloca al frente de la cámara
    object.rotation.y = Math.PI * 0.75;
    object.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    scene.add(object);

    mixer = new THREE.AnimationMixer(object);
    
    // Cargar y reproducir la animación
    loader.load(urlAnim, (animObj) => {
      animObj.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
    }, undefined, (err) => console.error('Error cargando animación Boxing:', err));

  }, undefined, (err) => console.error('Error cargando modelo Paladin:', err));
}

// Botones VR (malla con canvas)
function createButtonMesh(text, name, yPos) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 128;

  const grd = ctx.createLinearGradient(0,0,0,128);
  grd.addColorStop(0, '#5ab8ff');
  grd.addColorStop(1, '#2f8fff');
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,512,128);

  ctx.fillStyle = 'white';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(1, 0.25);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(0, yPos, -2);
  mesh.renderOrder = 998;
  return mesh;
}

function createVRMenu() {
  const btn1 = createButtonMesh('Ir al Mapa (Entorno 1)', 'btn-to-env1', 0.5);
  const btn2 = createButtonMesh('Ir al Personaje (Entorno 2)', 'btn-to-env2', 0.25);
  interactableGroup.add(btn1, btn2);
}

function createVRGameUI() {
  const btnMenu = createButtonMesh('Volver al Menú', 'btn-to-menu', 0.5);
  interactableGroup.add(btnMenu);

  let text, name;
  if (currentState === 'ESCENARIO_1') {
    text = 'Ir al Personaje (E2)';
    name = 'btn-to-env2';
  } else {
    text = 'Ir al Mapa (E1)';
    name = 'btn-to-env1';
  }
  const btnOther = createButtonMesh(text, name, 0.25);
  interactableGroup.add(btnOther);
}

// Visibilidad UI
function updateUIVisibility() {
  const isVR = renderer.xr.isPresenting;
  if (reticle) reticle.visible = isVR;
  interactableGroup.visible = isVR;

  uiMenu.style.display = (isVR || currentState !== 'MENU') ? 'none' : 'flex';
  uiGame.style.display = (isVR || currentState === 'MENU') ? 'none' : 'flex';

  if (!isVR) {
    if (currentState === 'ESCENARIO_1') {
      btnToOther.innerText = 'Ir al Personaje (E2)';
      btnToOther.onclick = () => switchScene('ESCENARIO_2');
    } else if (currentState === 'ESCENARIO_2') {
      btnToOther.innerText = 'Ir al Mapa (E1)';
      btnToOther.onclick = () => switchScene('ESCENARIO_1');
    }
  }
}

// Interacción por mirada
function handleGazeInteraction(delta) {
  if (!renderer.xr.isPresenting) return;

  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const intersects = raycaster.intersectObjects(interactableGroup.children);

  let target = null;
  if (intersects.length > 0) target = intersects[0].object;

  if (target !== currentGazeTarget) {
    currentGazeTarget = target;
    gazeDwellTime = 0;
  }

  interactableGroup.children.forEach(ch => ch.scale.set(1,1,1));

  if (currentGazeTarget) {
    currentGazeTarget.scale.set(1.15, 1.15, 1.15);
    gazeDwellTime += delta;
    if (gazeDwellTime >= DWELL_TIME_THRESHOLD) {
      onGazeSelect(currentGazeTarget);
      gazeDwellTime = 0;
    }
  }
}

function onGazeSelect(obj) {
  if (!obj) return;
  switch (obj.name) {
    case 'btn-to-env1': switchScene('ESCENARIO_1'); break;
    case 'btn-to-env2': switchScene('ESCENARIO_2'); break;
    case 'btn-to-menu': switchScene('MENU'); break;
  }
}

// Resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();

