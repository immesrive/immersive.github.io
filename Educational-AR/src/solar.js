/*****************************************************************
  Solar.js
******************************************************************/

import {Workbox} from 'workbox-window';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


/*****************************************************************
  Service Worker
******************************************************************/
if ("serviceWorker" in navigator) {
  const wb = new Workbox('sw.js');
  wb.register();
}


/*****************************************************************
  Varibles
******************************************************************/
//Scene Variables
let originPoint;
let placementPos = new THREE.Vector3();
let planets = [];
let planetOrigins = [];
let pivots = [];
let orbitLines = [];
let sunObj, sunPivot, moonObj, moonPivot, moonOrigin;
let continentObj = new THREE.Object3D();

//UI Elements
let uiOptions = [];
let planetOptions = [];
let uiPlanetIndex;
let anchorAlert, collisionAlert;
let textBox;
let planetOptionsVisible = false;
let uiOptionsVisible = false;
let atOrigin = true;

//AR Variable
let xrButton = document.getElementById('xr-button');
let xrSession = null;
let xrRefSpace = null;
let showSolarSystem = false;
let arActivated = false;
let reticle;
let gl = null;
let xrHitTestSource = null


/*****************************************************************
  JSON File
******************************************************************
=> This file contains all relevent information concerning all the objects in the scene
******************************************************************/
let jsonObj;
let request = new XMLHttpRequest();

request.open("GET", "./solarSystem.json", false);
request.send(null);
jsonObj = JSON.parse(request.responseText);


/*****************************************************************
  Renderer
******************************************************************/
let renderer = new THREE.WebGLRenderer({antialias: true});
renderer.autoClear = false;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


/*****************************************************************
  Scene
******************************************************************/
let scene = new THREE.Scene();
scene.background = null;

sunObj = new THREE.Object3D();
sunPivot = new THREE.Object3D();
moonObj = new THREE.Object3D();
moonPivot = new THREE.Object3D();
moonOrigin = new THREE.Object3D();


/*****************************************************************
  Camera
******************************************************************/
let camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 0.001, 10000000);
camera.matrixAutoUpdate = false;
scene.add(camera);


/*****************************************************************
  Lights
******************************************************************/
let sunLight = new THREE.PointLight( 0xfffee8, 1, 0, 0);
sunLight.position.set( 0, 0, 0);
sunLight.visible = false;

let cameraLight = new THREE.PointLight( 0xfffee8, 2, 0, 0);
cameraLight.visible = true;
camera.add(cameraLight);


/*****************************************************************
  Initialize
******************************************************************/
function init() {

  if (navigator.xr) {

    //Check XR Support
    checkSupportedState();

    //Load Solar Obj Models
    loadModels();

    //Load UI Objs
    loadUI();

    originPoint = new THREE.Object3D();
    originPoint.name = "origin";

  } else {
    alert("AR no go");
  }
}


/*****************************************************************
  Check AR Support
******************************************************************
=> Uses WebXR API to determin if AR can be ran on device
=> EventListener on screen to begin session
******************************************************************/
function checkSupportedState() {
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    let statusBox = document.getElementById('statusbox');
    if (supported) {

      xrButton.addEventListener('click', toggleAR);

    } else {
      statusBox.innerHTML = 'Houston we have a problem, your device is not compatible';
      xrButton.style.backgroundColor = '#cc0000';
      xrButton.innerHTML = 'Error';
    }
  });
}


/*****************************************************************
  Toggle AR
******************************************************************
=> Turn AR session on / off
******************************************************************/
async function toggleAR(){
  if (arActivated){
    console.log("AR is already activated");
    return;
  }
  return activateAR();
}


/*****************************************************************
  Load Solar Objs
******************************************************************
=> Load all GLTF files to the appropriate Objs
=> Place in proper position along X-axis
=> Apply Scaling based on JSON
=> Creates Hitbox for all Planets
=> Creates Orbit Lines
******************************************************************/
function loadModels() {

  let loader = new GLTFLoader();

  //Sun Loader
  loader.load(
    jsonObj.sun.file,
    gltf => loadSun( gltf ),
    xhr => onProgress(xhr),
    error => onError(error)
  );

  //Planets Loader
  for (let i=0; i < jsonObj.numPlanets; i++){
    loader.load(
      jsonObj.planets[i].file,
      gltf => loadPlanet( gltf ),
      xhr => onProgress(xhr),
      error => onError(error)
    );
  }

  //Earth's Moon Loader
  loader.load(
    jsonObj.planets[2].moon.file,
    gltf => loadMoon( gltf ),
    xhr => onProgress(xhr),
    error => onError(error)
  );
}

function loadSun(gltf) {
  sunObj = gltf.scene;

  //SunObj is scalled a 10th more due to its size
  sunObj.scale.set( jsonObj.sun.radius/jsonObj.sizeScale/10,
                    jsonObj.sun.radius/jsonObj.sizeScale/10,
                    jsonObj.sun.radius/jsonObj.sizeScale/10);
  sunObj.rotateZ(jsonObj.sun.rotationAngle);
  sunObj.name = jsonObj.sun.name;
  sunObj.add(sunLight);
  scene.add(sunPivot);
};

function loadPlanet(gltf) {
  let num;

  //Places planets in proper order
  switch (gltf.parser.options.path){
    case "./model/planets-glb/mercury/":
      num = 0;
      break;
    case "./model/planets-glb/venus/":
      num = 1;
      break;
    case "./model/planets-glb/earth/":
      num = 2;
      break;
    case "./model/planets-glb/mars/":
      num = 3;
      break;
    case "./model/planets-glb/jupiter/":
      num = 4;
      break;
    case "./model/planets-glb/saturn/":
      num = 5;
      break;
    case "./model/planets-glb/uranus/":
      num = 6;
      break;
    case "./model/planets-glb/neptune/":
      num = 7;
      break;
    case "./model/planets-glb/pluto/":
      num = 8;
      break;
    default:
      break;
  }

  //Add pivot to center
  pivots[num] = new THREE.Object3D();
  pivots[num].name = "pivotPoint";
  originPoint.add(pivots[num]);

  //Add scale based on Json
  planets[num] = gltf.scene
  planets[num].scale.set((jsonObj.planets[num].radius/jsonObj.sizeScale),
                          (jsonObj.planets[num].radius/jsonObj.sizeScale),
                          (jsonObj.planets[num].radius/jsonObj.sizeScale));
  planets[num].rotateZ(jsonObj.planets[num].rotationAngle);
  planets[num].name = jsonObj.planets[num].name;

  //Establish Origin / Hitbox
  let geometry = new THREE.SphereGeometry( 0.04 );
  let material = new THREE.MeshBasicMaterial( {color: 0x00ff00, opacity: 0, transparent: true} );

  if (num > 3){
    geometry = new THREE.SphereGeometry( 0.1 );
    material = new THREE.MeshBasicMaterial( {color: 0xff0000, opacity: 0, transparent: true});
  }

  planetOrigins[num] = new THREE.Mesh( geometry, material );
  planetOrigins[num].position.set(pivots[num].position.x + jsonObj.planets[num].distanceFromSun/jsonObj.distanceScale,
                            pivots[num].position.y,
                            pivots[num].position.z);

  planetOrigins[num].name = "planetOrigin";

  //Add planet to pivot
  planetOrigins[num].add(planets[num]);
  pivots[num].add(planetOrigins[num]);
  pivots[num].rotateZ(jsonObj.planets[num].orbitInclination);

  //Orbit Line
  let orbitMaterial = new THREE.LineBasicMaterial({ color:0xffffa1 });
  let orbitCircle = new THREE.CircleGeometry(jsonObj.planets[num].distanceFromSun/jsonObj.distanceScale, 100);
  orbitCircle.vertices.shift();
  orbitCircle.rotateX(Math.PI * 0.5);
  orbitCircle.rotateZ(jsonObj.planets[num].orbitInclination);

  orbitLines[num] = new THREE.LineLoop( orbitCircle, orbitMaterial);
  orbitLines[num].name = "oribitLine";
  originPoint.add(orbitLines[num]);

  //Add Moon
  //Note: Currently only for earth but could be altered to incoperate moons for any planet in the solar system
  if (jsonObj.planets[num].moon){

    planetOrigins[num].add(moonPivot);
    moonPivot.add(moonOrigin);

    moonObj.scale.set(jsonObj.planets[2].moon.radius/jsonObj.sizeScale,
                      jsonObj.planets[2].moon.radius/jsonObj.sizeScale,
                      jsonObj.planets[2].moon.radius/jsonObj.sizeScale);

    //Get the size of the planet to determin radius
    let planetBox = new THREE.Box3().setFromObject( planets[num] );
    let boxSize = new THREE.Vector3();
    planetBox.getSize(boxSize);
    moonOrigin.position.x = boxSize.x/2 + jsonObj.planets[2].moon.distanceFromEarth/jsonObj.distanceScale;

    moonOrigin.add(moonObj);
    moonObj.rotateZ(jsonObj.planets[2].moon.rotationAngle);
    moonObj.name = jsonObj.planets[2].moon.name;
    moonPivot.rotateZ(jsonObj.planets[2].moon.orbitInclination);
  }
};

//Load Moon Model
function loadMoon(gltf) {
  moonObj = gltf.scene;
};

function onProgress(xhr) {
  // console.log((xhr.loaded / xhr.total *100) + '% loaded');
}

function onError(error) {
  console.log(error);
}


/*****************************************************************
  UI
******************************************************************
=> Load and place all UI elements to their proper positions
=> Create and place Textbox
******************************************************************/
function loadUI(){
  uiPlanetIndex = jsonObj.planet_index;
  let alertGeometry = new THREE.PlaneGeometry(.15,.15, .05);
  var alertTexture = new THREE.TextureLoader().load("./model/UI-Textures/Anchor.png");

  let alertMaterial = new THREE.MeshBasicMaterial({map: alertTexture});
  anchorAlert = new THREE.Mesh(alertGeometry, alertMaterial);
  anchorAlert.position.x = 0.0;
  anchorAlert.position.y = .25;
  anchorAlert.position.z = -.50;
  camera.add(anchorAlert);

  let collisionGeometry = new THREE.PlaneGeometry(.1,.1, .05);
  var collisionTexture = new THREE.TextureLoader().load("./model/UI-Textures/Collision_Alert.png");

  let collisionMaterial = new THREE.MeshBasicMaterial({map: collisionTexture});
  collisionAlert = new THREE.Mesh(collisionGeometry, collisionMaterial);
  collisionAlert.position.x = 0.0;
  collisionAlert.position.y = .25;
  collisionAlert.position.z = 1.0;
  collisionAlert.visible = false;
  camera.add(collisionAlert);

  for (let i=0; i< jsonObj.ui_size ; i++){
    let uiGeometry = new THREE.PlaneGeometry( .05,.05,.05 );
    var uiTexture = new THREE.TextureLoader().load( jsonObj.ui[i].texture );
    //let uiTexture = new THREE.ImageUtils.loadTexture(jsonObj.ui[i].texture);
    let uiMaterial = new THREE.MeshBasicMaterial( {map: uiTexture} );     //UI box
    uiOptions[i] = new THREE.Mesh( uiGeometry, uiMaterial );
    uiOptions[i].name = jsonObj.ui[i].name;
    if (i == 0){
      uiOptions[i].position.x = jsonObj.ui[i].position.x;
    } else if (i==2){
      uiOptions[i].position.x = jsonObj.ui[i].position.x;
    } else {
      uiOptions[i].position.x = 1.0;
    }
    uiOptions[i].position.y += jsonObj.ui[i].position.y;
    uiOptions[i].position.z -= jsonObj.ui[i].position.z;
    camera.add(uiOptions[i]);
  }

  for(let i=0; i< jsonObj.ui[uiPlanetIndex].size ; i++){
    let uiGeometry = new THREE.PlaneGeometry( .07,.05,.05 );
    let uiTexture = new THREE.ImageUtils.loadTexture(jsonObj.ui[uiPlanetIndex].options[i].texture);
    let uiMaterial = new THREE.MeshBasicMaterial(  {map: uiTexture} );
    planetOptions[i]= new THREE.Mesh(uiGeometry, uiMaterial);
    planetOptions[i].name = jsonObj.ui[uiPlanetIndex].options[i].name;
    planetOptions[i].position.x = 1.0;
    planetOptions[i].position.y += jsonObj.ui[uiPlanetIndex].options[i].position.y;
    planetOptions[i].position.z -= jsonObj.ui[uiPlanetIndex].options[i].position.z;
    camera.add(planetOptions[i]);
  }

  //Setup Textbox
  let ctx = document.createElement('canvas').getContext('2d');
  let texture = new THREE.CanvasTexture(ctx.canvas);
  let boxMaterial = new THREE.MeshBasicMaterial({
    map: texture,
  });

  let boxGeometry = new THREE.PlaneGeometry( .061, .05);

  textBox = new THREE.Mesh(boxGeometry, boxMaterial);
  textBox.position.y -= 0.055;
  textBox.position.z -= 0.1;
  camera.add(textBox);

  textBox.name = "textBox";
  textBox.visible = false;
}


/*****************************************************************
  xrSession
******************************************************************
=> Create local session
=> Establish EventListeners
******************************************************************/
async function activateAR(){
  try{
    xrSession = await navigator.xr.requestSession('immersive-ar', {requiredFeatures: ['local', 'hit-test']});

    xrSession.addEventListener('select', touchSelectEvent);
    xrSession.addEventListener('end', onSessionEnd);

    let gl = renderer.getContext();
    await gl.makeXRCompatible();
    let layer = new XRWebGLLayer(xrSession, gl);
    xrSession.updateRenderState({ baseLayer: layer });

    xrSession.requestReferenceSpace('viewer').then((refSpace) => {
      xrRefSpace = refSpace;
      xrSession.requestHitTestSource({ space: xrRefSpace }).then((hitTestSource) => {
        xrHitTestSource = hitTestSource;
      });
    });

    xrRefSpace = await xrSession.requestReferenceSpace('local');

    xrSession.requestAnimationFrame(renderXR);
    arActivated = true;

  } catch (error){
    console.log("Catch: "+ error);
  }
}


/*****************************************************************
  End Session
*****************************************************************/
function onSessionEnd(){
  console.log("SESSION ENDED");

  //Move user to the quiz
  window.location.href = "./Quiz.html";

  arActivated = false;
  xrSession = null;
}


/*****************************************************************
  Render Frame
******************************************************************
=> Frame by Frame rendering
=> Show Reticle or Solar System
******************************************************************/
function renderXR(timestamp, xrFrame){

  if (!xrFrame || !xrSession || !arActivated){
    return;
  }

  let pose = xrFrame.getViewerPose(xrRefSpace);
  if (!pose){
    xrSession.requestAnimationFrame(renderXR);
    return;
  }

  //If solar system has not been placed, show a reticle to place it
  if (!showSolarSystem){

    createReticle();

    if (xrHitTestSource && pose){
      let hitTestResults = xrFrame.getHitTestResults(xrHitTestSource);
      if (hitTestResults.length > 0){
        console.log("raycast good");
        anchorAlert.position.z = 1.;
        let result = hitTestResults[0].getPose(xrRefSpace);

        let hitMatrix = new THREE.Matrix4();
        hitMatrix.fromArray(result.transform.matrix);

        reticle.position.setFromMatrixPosition(hitMatrix);

        //Get world position
        let reticlePos = new THREE.Vector3();
        let cameraPos = new THREE.Vector3();
        reticle.getWorldPosition(reticlePos);
        camera.getWorldPosition(cameraPos);

        let dir = new THREE.Vector3();
        dir.subVectors(cameraPos, reticlePos).normalize();
        let dist = reticlePos.distanceTo(cameraPos);

        //Limit distance to a range (0.5 - 0.8)
        if (dist > 0.8){
          dist -= 0.8;
          reticle.translateOnAxis(dir, dist);
        } else if (dist < 0.5){
          dist -= 0.5;
          reticle.translateOnAxis(dir, dist);
        }

        reticle.visible = true;
        originPoint.visible = false;

      } else {
        anchorAlert.position.z = -.5;
        console.log("keep Looking");
        reticle.visible = false;
      }
    }

  } else {
    if (reticle){
      reticle.visible = false;
      originPoint.visible = true;
    }

    animateScene();
  }

  let xrLayer = xrSession.renderState.baseLayer;
  renderer.setFramebuffer(xrLayer.framebuffer);

  for (let xrView of pose.views){
    let viewport = xrLayer.getViewport(xrView);
    renderView(xrView, viewport);
  }

  xrSession.requestAnimationFrame(renderXR);
}

function renderView(xrView, viewport){
  renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
  const viewMatrix = xrView.transform.inverse.matrix;

  //camera
  camera.projectionMatrix.fromArray(xrView.projectionMatrix);
  camera.matrix.fromArray(viewMatrix).getInverse(camera.matrix);
  camera.updateMatrixWorld(true);

  renderer.render(scene, camera)
}


/*****************************************************************
  Reticle
******************************************************************/
function createReticle(){
  if (reticle){
    reticle.add(sunObj);
    sunObj.position.y = 0.2;
    sunObj.children[0].material.opacity = 0.2;
    return;
  }

  reticle = new THREE.Object3D();

  let ringGeometry = new THREE.RingGeometry(0.07, 0.09, 24, 1);
  let ringMaterial = new THREE.MeshBasicMaterial({ color: 0xFF6600 });
  ringGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90)));
  let circle = new THREE.Mesh(ringGeometry, ringMaterial);
  circle.position.y = 0.03;

  sunObj.position.y = 0.2;
  sunObj.children[0].material.opacity = 0.2;

  reticle.add(circle);
  reticle.add(sunObj);
  reticle.name = 'reticle';
  scene.add(reticle);
}


/*****************************************************************
  Animate 3D scene
******************************************************************
=> Update position of each solar Obj based upon JSON
=> Move planet away / towards user when needed
=> Check if inside an Obj
******************************************************************/
function animateScene(){
  if (jsonObj.originReturn){
    returnToOrigin();
  } else {
    updateSun();
    updatePlanets();
    updateMoon();
  }
  checkInsideObject();
  if(collisionAlert.visible){
    collisionAlert.position.z = -.5;

  }else{
    collisionAlert.position.z = 1.0;
  }
}


/*****************************************************************
  Update Sun Position
******************************************************************/
function updateSun(){
  //Sun Rotation
  if (sunObj && jsonObj.sun.moveRotate){
    sunObj.rotateY(jsonObj.sun.rotation / jsonObj.rotationScale);
  }

  //Move Sun towards User
  if (jsonObj.sun.beingViewed && jsonObj.objTranslation.inTransit){
    sunTranslation();
  }
}


/*****************************************************************
  Update SolarSystem
******************************************************************
=> scale all solar objs based upon percentage change from the sun
=> Update planets and moon positions by a scaled factor
=> Run for 100 Frames
******************************************************************/
function sunTranslation(){
  if (jsonObj.objTranslation.timeStep > 0){

    let distance;
    let originPos = new THREE.Vector3();
    let planetPos = new THREE.Vector3();
    let moonPos = new THREE.Vector3()
    let cameraPos = new THREE.Vector3();
    let dir = new THREE.Vector3();

    originPoint.getWorldPosition(originPos);

    if (!jsonObj.objTranslation.switchObj){

      //Get Percentage Scale
      let desiredScale = 0.0003;
      let scaledPercent = (desiredScale - (jsonObj.sun.radius / jsonObj.sizeScale) / 10) / 100;
      scaledPercent /= ((jsonObj.sun.radius / jsonObj.sizeScale) / 10);

      //Update Planet/Moon Position
      for (let i=0; i<jsonObj.numPlanets; i++){
        scene.attach( planetOrigins[i]);
        planetOrigins[i].getWorldPosition(planetPos);
        dir.subVectors(planetPos, originPos).normalize();
        distance = (jsonObj.planets[i].distanceFromSun / jsonObj.distanceScale) * 10;
        planetOrigins[i].position.add(dir.multiplyScalar(distance));
        pivots[i].attach( planetOrigins[i]);

        //Scale Planet
        planets[i].scale.addScalar((jsonObj.planets[i].radius / jsonObj.sizeScale) * scaledPercent);

        //Update Moon
        //NOTE: Only applied to Earths moon
        if (jsonObj.planets[i].moon){
          scene.attach(moonOrigin);
          moonOrigin.getWorldPosition(moonPos);
          planetOrigins[i].getWorldPosition(planetPos);
          dir.subVectors(moonPos, planetPos).normalize();
          distance = (jsonObj.planets[i].moon.distanceFromEarth / jsonObj.distanceScale) * 30;
          moonOrigin.position.add(dir.multiplyScalar(distance));
          moonPivot.attach(moonOrigin);

          //Scale Moon
          moonObj.scale.addScalar((jsonObj.planets[i].moon.radius / jsonObj.sizeScale) * scaledPercent);
        }
      }

      //Scale Sun
      sunObj.scale.addScalar(((jsonObj.sun.radius / jsonObj.sizeScale) / 10) * scaledPercent);

      //Move Sun towards camera
      camera.getWorldPosition(cameraPos);
      dir.subVectors(cameraPos, originPos).normalize();
      let sunBox = new THREE.Box3().setFromObject(sunObj);
      distance = sunBox.distanceToPoint(cameraPos);
      distance -= 0.1; //Camera Buffer
      originPoint.translateOnAxis(dir, distance / jsonObj.objTranslation.timeStep);

      jsonObj.objTranslation.timeStep--;

    //Switching from solar obj to sun
    } else {

      for (let i=0; i<jsonObj.numPlanets; i++){
        if (jsonObj.planets[i].switchingFrom){
          switchTranslation(sunObj, jsonObj.sun.radius / jsonObj.sizeScale / 10, planets[i], jsonObj.planets[i].radius / jsonObj.sizeScale);
        }
        if (jsonObj.planets[i].moon){
          if (jsonObj.planets[i].moon.switchingFrom){
            switchTranslation(sunObj, jsonObj.sun.radius / jsonObj.sizeScale / 10, moonObj, jsonObj.planets[i].moon.radius / jsonObj.sizeScale);
          }
        }
      }

      jsonObj.objTranslation.timeStep--;
    }

  } else {

    if (jsonObj.objTranslation.switchObj){
      jsonObj.objTranslation.switchObj = false;
    }

    //Pop up the textBox
    textBox.visible = true;

    //Reset Values
    jsonObj.sun.switchingFrom = false;

    for (let i=0; i<jsonObj.numPlanets; i++){
      if (!jsonObj.pause){
        jsonObj.planets[i].moveOrbit = true;

        if (jsonObj.planets[i].moon){
          jsonObj.planets[i].moon.moveOrbit = true;
        }
      }

      if (jsonObj.planets[i].switchingFrom){
        jsonObj.planets[i].switchingFrom = false;
      }

      if (jsonObj.planets[i].moon){
        if (jsonObj.planets[i].moon.switchingFrom){
          jsonObj.planets[i].moon.switchingFrom = false;
        }
      }
    }

    jsonObj.objTranslation.inTransit = false;
    jsonObj.objTranslation.timeStep = 100;
  }
}


/*****************************************************************
  Update Planet Position
******************************************************************/
function updatePlanets(){
  //Planet Rotation (rad/day)
  for (let i=0; i<jsonObj.numPlanets; i++){
    if (planets[i] && jsonObj.planets[i].moveRotate){
      planets[i].rotateY(jsonObj.planets[i].rotation / jsonObj.rotationScale);
    }
  }

  for (let i=0; i<jsonObj.numPlanets; i++){
    //Move Planet Towards User
    if (jsonObj.planets[i].beingViewed && jsonObj.objTranslation.inTransit){
      planetTranslation(i);

    //Planet Orbit
    } else {
      if (pivots[i] && jsonObj.planets[i].moveOrbit){
        pivots[i].rotateY(jsonObj.planets[i].orbit / jsonObj.orbitScale);
      }
    }
  }
}


/*****************************************************************
  Update SolarSystem
******************************************************************
=> scale all solar objs based upon percentage change from the planet
=> Update planets and moon positions by a scaled factor
=> Run for 100 Frames
******************************************************************/
function planetTranslation(num){

  if (jsonObj.objTranslation.timeStep > 0){

    let distance;
    let cameraPos = new THREE.Vector3();
    let originPos = new THREE.Vector3();
    let planetPos = new THREE.Vector3();
    let moonPos = new THREE.Vector3();
    let dir = new THREE.Vector3();

    //Check to see if switching between solar objects
    if (!jsonObj.objTranslation.switchObj){

      let desiredScale = 0.0003;
      let scaledPercent = (desiredScale - (jsonObj.planets[num].radius / jsonObj.sizeScale)) / 100;
      scaledPercent /= (jsonObj.planets[num].radius / jsonObj.sizeScale);

      //Move Origin Position
      originPoint.getWorldPosition(originPos);
      planetOrigins[num].getWorldPosition(planetPos);
      dir.subVectors(originPos, planetPos).normalize();
      distance = (jsonObj.planets[num].distanceFromSun / jsonObj.distanceScale) * 10;
      originPoint.translateOnAxis(dir, distance);

      //Update Planet Position
      for (let i=0; i<jsonObj.numPlanets; i++){
        scene.attach( planetOrigins[i]);
        originPoint.getWorldPosition(originPos);
        planetOrigins[i].getWorldPosition(planetPos);
        dir.subVectors(planetPos, originPos).normalize();
        distance = (jsonObj.planets[i].distanceFromSun / jsonObj.distanceScale) * 10;
        planetOrigins[i].position.add(dir.multiplyScalar(distance));
        pivots[i].attach( planetOrigins[i]);

        planets[i].scale.addScalar((jsonObj.planets[i].radius / jsonObj.sizeScale) * scaledPercent);
      }

      //Update Earths Moon
      scene.attach(moonOrigin);
      moonOrigin.getWorldPosition(moonPos);
      planetOrigins[2].getWorldPosition(planetPos);
      dir.subVectors(moonPos, planetPos).normalize();
      distance = (jsonObj.planets[2].moon.distanceFromEarth / jsonObj.distanceScale) * 30;
      moonOrigin.position.add(dir.multiplyScalar(distance));
      moonPivot.attach(moonOrigin);

      moonObj.scale.addScalar((jsonObj.planets[2].moon.radius / jsonObj.sizeScale) * scaledPercent);

      sunObj.scale.addScalar((jsonObj.sun.radius / jsonObj.sizeScale) / 10 * scaledPercent);

      //Move Selected Planet Towards Camera
      camera.getWorldPosition(cameraPos);
      planetOrigins[num].getWorldPosition(planetPos);
      dir.subVectors(cameraPos, planetPos).normalize();
      let planetBox = new THREE.Box3().setFromObject(planets[num]);
      distance = planetBox.distanceToPoint(cameraPos);
      distance -= 0.1; //Camera Buffer
      originPoint.translateOnAxis(dir, distance / jsonObj.objTranslation.timeStep);

      jsonObj.objTranslation.timeStep--;

    //Switching between different solar objs
    } else {

      if (jsonObj.sun.switchingFrom){
        switchTranslation(planets[num], jsonObj.planets[num].radius / jsonObj.sizeScale, sunObj, jsonObj.sun.radius / jsonObj.sizeScale / 10);

      } else {
        for (let i=0; i<jsonObj.numPlanets; i++){
          if (jsonObj.planets[i].switchingFrom){
            switchTranslation(planets[num], jsonObj.planets[num].radius / jsonObj.sizeScale, planetOrigins[i], jsonObj.planets[i].radius / jsonObj.sizeScale);
          }
          if (jsonObj.planets[i].moon){
            if (jsonObj.planets[i].moon.switchingFrom){
              switchTranslation(planets[num], jsonObj.planets[num].radius / jsonObj.sizeScale, moonObj, jsonObj.planets[i].moon.radius / jsonObj.sizeScale);
            }
          }
        }
      }

      jsonObj.objTranslation.timeStep--;
    }

  } else {

    if (jsonObj.objTranslation.switchObj) {
      jsonObj.objTranslation.switchObj = false;
    }

    //Pop up the textBox
    textBox.visible = true;

    scene.attach(planetOrigins[num]);
    planetOrigins[num].add(sunPivot);
    sunPivot.position.set(0, 0, 0);
    sunPivot.attach(originPoint);

    //Reset Values
    jsonObj.sun.switchingFrom = false;

    for (let i=0; i<jsonObj.numPlanets; i++){
      if (!jsonObj.pause){
        jsonObj.planets[i].moveOrbit = true;

        if (jsonObj.planets[i].moon){
          jsonObj.planets[i].moon.moveOrbit = true;
        }
      }

      if (jsonObj.planets[i].switchingFrom){
        jsonObj.planets[i].switchingFrom = false;
      }

      if (jsonObj.planets[i].moon){
        if (jsonObj.planets[i].moon.switchingFrom){
          jsonObj.planets[i].moon.switchingFrom = false;
        }
      }
    }

    jsonObj.objTranslation.inTransit = false;
    jsonObj.objTranslation.timeStep = 100;
  }
}


function updateMoon(){
  //Moon Rotation
  if (moonObj && jsonObj.planets[2].moon.moveRotate){
    moonObj.rotateY(jsonObj.planets[2].moon.rotation / jsonObj.rotationScale);
  }

  //Move moon towards user
  if (jsonObj.planets[2].moon.beingViewed){
    if (jsonObj.objTranslation.inTransit){
      moonTraslation();

    //Orbit Moon around Earth while viewing Earth
    } else if (!jsonObj.objTranslation.inTransit && sunLight.visible && jsonObj.planets[2].moon.moveOrbit){
        moonPivot.rotateY(jsonObj.planets[2].moon.orbit / jsonObj.orbitScale);
    }

  //Moon Orbit
  } else {
    if (moonPivot && jsonObj.planets[2].moon.moveOrbit){
      moonPivot.rotateY(jsonObj.planets[2].moon.orbit / jsonObj.orbitScale);
    }
  }
}


/*****************************************************************
  Update SolarSystem
******************************************************************
=> scale all solar objs based upon percentage change from the moon
=> Update planets and moon positions by a scaled factor
=> Run for 100 Frames
******************************************************************/
//Note: Designed Only For Earths Moon
function moonTraslation(){

  if (jsonObj.objTranslation.timeStep > 0){

    let distance;
    let cameraPos = new THREE.Vector3();
    let originPos = new THREE.Vector3();
    let planetPos = new THREE.Vector3();
    let moonPos = new THREE.Vector3();
    let dir = new THREE.Vector3();

    if (!jsonObj.objTranslation.switchObj){

      let desiredScale = 0.0003;
      let scaledPercent = (desiredScale - (jsonObj.planets[2].moon.radius / jsonObj.sizeScale)) / 100;
      scaledPercent /= (jsonObj.planets[2].moon.radius / jsonObj.sizeScale);

      //Move Origin Position away from planet of moon
      originPoint.getWorldPosition(originPos);
      planetOrigins[2].getWorldPosition(planetPos);

      dir.subVectors(originPos, planetPos).normalize();
      distance = (jsonObj.planets[2].distanceFromSun / jsonObj.distanceScale) * 30;
      originPoint.translateOnAxis(dir, distance);

      //Update Planet Position Away From The Origin
      for (let i=0; i<jsonObj.numPlanets; i++){
        scene.attach( planetOrigins[i]);
        originPoint.getWorldPosition(originPos);
        planetOrigins[i].getWorldPosition(planetPos);
        dir.subVectors(planetPos, originPos).normalize();
        distance = (jsonObj.planets[i].distanceFromSun / jsonObj.distanceScale) * 10;
        planetOrigins[i].position.add(dir.multiplyScalar(distance));
        pivots[i].attach( planetOrigins[i]);

        // //Scale SolarSystem
        planets[i].scale.addScalar((jsonObj.planets[i].radius / jsonObj.sizeScale) * scaledPercent);
      }

      sunObj.scale.addScalar((jsonObj.sun.radius / jsonObj.sizeScale) / 10 * scaledPercent);

      //Update Earths Moon
      scene.attach(moonOrigin);
      moonOrigin.getWorldPosition(moonPos);
      planetOrigins[2].getWorldPosition(planetPos);
      dir.subVectors(moonPos, planetPos).normalize();
      distance = (jsonObj.planets[2].moon.distanceFromEarth / jsonObj.distanceScale) * 30;
      moonOrigin.position.add(dir.multiplyScalar(distance));
      moonPivot.attach(moonOrigin);

      moonObj.scale.addScalar((jsonObj.planets[2].moon.radius / jsonObj.sizeScale) * scaledPercent);

      //Move Selected Moon Towards Camera
      camera.getWorldPosition(cameraPos);
      moonOrigin.getWorldPosition(moonPos);

      dir.subVectors(cameraPos, moonPos).normalize();
      let moonBox = new THREE.Box3().setFromObject(moonObj);
      distance = moonBox.distanceToPoint(cameraPos);
      distance -= 0.1; //Camera Buffer

      originPoint.translateOnAxis(dir, distance / jsonObj.objTranslation.timeStep);

      jsonObj.objTranslation.timeStep--;

    //Swicthing between different solar objs
    } else {

      if (jsonObj.sun.switchingFrom){
        switchTranslation(moonObj, jsonObj.planets[2].moon.radius / jsonObj.sizeScale, sunObj, jsonObj.sun.radius / jsonObj.sizeScale / 10);

      } else {
        for (let i=0; i<jsonObj.numPlanets; i++){
          if (jsonObj.planets[i].switchingFrom){
            switchTranslation(moonObj, jsonObj.planets[2].moon.radius / jsonObj.sizeScale, planets[i], jsonObj.planets[i].radius / jsonObj.sizeScale);
          }
        }
      }

      jsonObj.objTranslation.timeStep--;
    }

  } else {

    if (jsonObj.objTranslation.switchObj) {
      jsonObj.objTranslation.switchObj = false;
    }

    //Pop up the textBox
    textBox.visible = true;

    //Earth pivots around the moon
    scene.attach(moonOrigin);
    moonOrigin.add(moonPivot);
    moonPivot.position.set(0, 0, 0);
    moonPivot.attach(planetOrigins[2]);

    //Sun Pivots around Earth
    planetOrigins[2].add(sunPivot);
    sunPivot.position.set(0, 0, 0);
    sunPivot.attach(originPoint);

    //Reset Values
    jsonObj.sun.switchingFrom = false;

    for (let i=0; i<jsonObj.numPlanets; i++){
      if (!jsonObj.pause){
        jsonObj.planets[i].moveOrbit = true;

        if (jsonObj.planets[i].moon){
          jsonObj.planets[i].moon.moveOrbit = true;
        }
      }

      if (jsonObj.planets[i].switchingFrom){
        jsonObj.planets[i].switchingFrom = false;
      }

      if (jsonObj.planets[i].moon){
        if (jsonObj.planets[i].moon.switchingFrom){
          jsonObj.planets[i].moon.switchingFrom = false;
        }
      }
    }

    jsonObj.objTranslation.inTransit = false;
    jsonObj.objTranslation.timeStep = 100;
  }
}


/*****************************************************************
  Update SolarSystem
******************************************************************
=> Switch from one obj to another
=> scale all solar objs based upon percentage change from the targetObj
=> Run for 100 Frames
******************************************************************/
function switchTranslation(target, targetScale, preObj, preObjScale){

  let planetNum;
  let preSunSize;
  let prePlanetSize = [];
  let preMoonSize;
  let targetPos = new THREE.Vector3();
  let cameraPos = new THREE.Vector3();
  let distance;
  let dir = new THREE.Vector3();
  let desiredScale = 0.0003;
  let scaledPercent;
  let preScalePercent;

  preScalePercent = desiredScale - preObjScale;
  preScalePercent /= 100;

  //This is the percentage change for the previous object
  preScalePercent /= preObjScale;

  //Get the preSunSize of the sun
  preSunSize = jsonObj.sun.radius / jsonObj.sizeScale / 10;
  preSunSize += ((jsonObj.sun.radius / jsonObj.sizeScale / 10) * preScalePercent) * 100;

  //Get the previous scale of all the planets
  for (let i=0; i<jsonObj.numPlanets; i++){
    prePlanetSize[i] = jsonObj.planets[i].radius / jsonObj.sizeScale;

    //Get the previous size of the moon
    //Note: applied only to Earths moon
    if (jsonObj.planets[i].moon){
      preMoonSize = jsonObj.planets[i].moon.radius / jsonObj.sizeScale;
    }

    prePlanetSize[i] += ((jsonObj.planets[i].radius / jsonObj.sizeScale) * preScalePercent) * 100;

    if (jsonObj.planets[i].moon){
      preMoonSize += ((jsonObj.planets[i].moon.radius / jsonObj.sizeScale) * preScalePercent) * 100;
    }
  }

  //Check what the target is
  if (target == sunObj ){
    scaledPercent = desiredScale - preSunSize;
    scaledPercent /= 100;

    //This is the percentage change that will be applied to the solar system
    scaledPercent /= preSunSize;

  //Note Only applied to Earths Moon
  } else if (target == moonObj){
    scaledPercent = desiredScale - preMoonSize;
    scaledPercent /= 100;

    //This is the percentage change that will be applied to the solar system
    scaledPercent /= preMoonSize;

  } else {

    for (let i=0; i<jsonObj.numPlanets; i++){
      if (target == planets[i]){
        planetNum = i;
        scaledPercent = desiredScale - prePlanetSize[i];
        scaledPercent /= 100;

        //This is the percentage change that will be applied to the solar system
        scaledPercent /= prePlanetSize[i];
      }
    }
  }

  //Sun
  if (target == sunObj) {
    sunObj.scale.addScalar(preSunSize * scaledPercent);
  }

  //Scale Planets
  for (let i=0; i<jsonObj.numPlanets; i++){
    planets[i].scale.addScalar(prePlanetSize[i] * scaledPercent);

    //Scale moon
    if (jsonObj.planets[i].moon){
      moonObj.scale.addScalar(preMoonSize * scaledPercent);
    }
  }

  //Move target towards camera
  let box = new THREE.Box3();
  camera.getWorldPosition(cameraPos);

  //Sun
  if (target == sunObj){
    originPoint.getWorldPosition(targetPos);
    box.setFromObject(sunObj);
  }

  //Planet
  if (planetNum || target == planets[0]) {
    planetOrigins[planetNum].getWorldPosition(targetPos);
    box.setFromObject(planets[planetNum]);
  }


  //Moon
  if (target == moonObj){
    moonOrigin.getWorldPosition(targetPos);
    box.setFromObject(moonObj);
  }


  dir.subVectors(cameraPos, targetPos).normalize();
  distance = box.distanceToPoint(cameraPos);
  distance -= 0.1; //Camera Buffer
  originPoint.translateOnAxis(dir, distance / jsonObj.objTranslation.timeStep);
}


/*****************************************************************
  Update SolarSystem
******************************************************************
=> Return Everything back to original view
=> scale all solar objs based upon JSON
=> Update planets and moon positions by JSON value
=> Run for 100 Frames
******************************************************************/
function returnToOrigin(){
  if (jsonObj.objTranslation.timeStep > 0){

    let distance;
    let reduceScale;
    let dir = new THREE.Vector3();
    let originPos = new THREE.Vector3();
    let planetPos = new THREE.Vector3();
    let moonPos = new THREE.Vector3();
    atOrigin = true;

    originPoint.getWorldPosition(originPos);

    //Planets
    for (let i=0; i<jsonObj.numPlanets; i++){
      //Rotate Planets
      if (planets[i] && jsonObj.planets[i].moveRotate){
        planets[i].rotateY(jsonObj.planets[i].rotation / jsonObj.rotationScale);
      }

      if (jsonObj.objTranslation.timeStep == 1){
        //Snap to propper position in final timeStep
        scene.attach( planetOrigins[i]);
        planetOrigins[i].getWorldPosition(planetPos);

        //Direction
        dir.subVectors(planetPos, originPos).normalize();

        //Distance
        distance = planetPos.distanceTo(originPos) - (jsonObj.planets[i].distanceFromSun / jsonObj.distanceScale);
        planetOrigins[i].position.sub(dir.multiplyScalar(distance));
        pivots[i].attach( planetOrigins[i]);

      } else {
        scene.attach( planetOrigins[i]);
        planetOrigins[i].getWorldPosition(planetPos);

        //Direction
        dir.subVectors(planetPos, originPos).normalize();

        //Distance
        distance = planetPos.distanceTo(originPos) - (jsonObj.planets[i].distanceFromSun / jsonObj.distanceScale);
        distance /= jsonObj.objTranslation.timeStep;
        planetOrigins[i].position.sub(dir.multiplyScalar(distance));
        pivots[i].attach( planetOrigins[i]);
      }

      reduceScale = (planets[i].scale.x - jsonObj.planets[i].radius/jsonObj.sizeScale) / jsonObj.objTranslation.timeStep;
      planets[i].scale.subScalar(reduceScale);
    }

    //Sun
    //Rotate Sun
    if (sunObj && jsonObj.sun.moveRotate){
      sunObj.rotateY(jsonObj.sun.rotation / jsonObj.rotationScale);
    }
    reduceScale = (sunObj.scale.x - jsonObj.sun.radius/jsonObj.sizeScale/10) / jsonObj.objTranslation.timeStep;
    sunObj.scale.subScalar(reduceScale);

    //Moon
    //Rotate Moon
    if (moonObj && jsonObj.planets[2].moon.moveRotate){
      moonObj.rotateY(jsonObj.planets[2].moon.rotation / jsonObj.rotationScale);
    }

    if (jsonObj.objTranslation.timeStep == 1){
      scene.attach(moonOrigin);

      //Direction
      planetOrigins[2].getWorldPosition(planetPos);
      moonOrigin.getWorldPosition(moonPos);
      dir.subVectors(moonPos, planetPos).normalize();

      //Distance
      let planetBox = new THREE.Box3().setFromObject( planets[2] );

      distance = moonPos.distanceTo(planetPos) - (planetBox.getSize().x/2 + jsonObj.planets[2].moon.distanceFromEarth / jsonObj.distanceScale);
      moonOrigin.position.sub(dir.multiplyScalar(distance));

      moonPivot.attach(moonOrigin);

    } else {
      scene.attach(moonOrigin);

      //Direction
      planetOrigins[2].getWorldPosition(planetPos);
      moonOrigin.getWorldPosition(moonPos);
      dir.subVectors(moonPos, planetPos).normalize();

      //Distance
      distance = moonPos.distanceTo(planetPos) - (jsonObj.planets[2].moon.distanceFromEarth / jsonObj.distanceScale);
      distance /= jsonObj.objTranslation.timeStep;
      moonOrigin.position.sub(dir.multiplyScalar(distance));
      moonPivot.attach(moonOrigin);
    }

    //Scale
    reduceScale = (moonObj.scale.x - jsonObj.planets[2].moon.radius/jsonObj.sizeScale) / jsonObj.objTranslation.timeStep;
    moonObj.scale.subScalar(reduceScale);

    //Origin
    //Direction
    dir.subVectors(originPos, placementPos).normalize();

    //Distance
    distance = originPos.distanceTo(placementPos);
    distance /= jsonObj.objTranslation.timeStep;

    originPoint.position.sub(dir.multiplyScalar(distance));

    jsonObj.objTranslation.timeStep--;

  } else {

    //Get percise location
    originPoint.position.copy(placementPos);

    //Reset Values
    for (let i=0; i<jsonObj.numPlanets; i++){
      jsonObj.planets[i].beingViewed = false;

      if (!jsonObj.pause){
        jsonObj.planets[i].moveOrbit = true;
      }

      if (jsonObj.planets[i].moon){
        jsonObj.planets[i].moon.beingViewed = false;
        if (!jsonObj.pause){
          jsonObj.planets[i].moon.moveOrbit = true;
        }
      }

      if (jsonObj.showPlanetLines){
        orbitLines[i].visible = true;
      }
    }

    jsonObj.sun.beingViewed = false;
    jsonObj.originReturn = false;
    jsonObj.objTranslation.timeStep = 100;
    jsonObj.objTranslation.inTransit = false;
  }
}


/*****************************************************************
  Inside Object
******************************************************************
=> Check if camera is inside of Obj
******************************************************************/
function checkInsideObject(){
  //With in here check the planets, moon, and sun
  let inside = false;
  let objectBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3())
  let cameraPos = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);

  //planets
  for (let i=0; i<jsonObj.numPlanets; i++){
    objectBox.setFromObject(planets[i]);

    if (objectBox.containsPoint(cameraPos)){
      inside = true;
      console.log("planet " + i);
    }
  }
  //Moon
  objectBox.setFromObject(moonObj);
  if (objectBox.containsPoint(cameraPos)){
    inside = true;
    console.log("moon");
  }

  //Sun
  objectBox.setFromObject(sunObj);
  if (objectBox.containsPoint(cameraPos)){
    inside = true;
    console.log("sun");
  }

  collisionAlert.visible = inside;
}

/*****************************************************************
  Scene Event Handlers
******************************************************************/
function touchSelectEvent() {
  if (showSolarSystem){

    //Get ray position and direction based upon where the screen was touched
    let inputPose = event.frame.getPose(event.inputSource.targetRaySpace, xrRefSpace);
    if (inputPose) {

      let targetRay = new XRRay(inputPose.transform);
      let rayOrigin = new THREE.Vector3(targetRay.origin.x, targetRay.origin.y, targetRay.origin.z);
      let rayDirection = new THREE.Vector3(targetRay.direction.x, targetRay.direction.y, targetRay.direction.z);

      let sceneRaycaster = new THREE.Raycaster();
      sceneRaycaster.set(rayOrigin, rayDirection);

      //Variables that are touchable
      let sceneIntersectsArray = [sunObj, moonObj, planets[0], planets[1], planets[2], planets[3], planets[4], planets[5], planets[6], planets[7], planets[8], planetOrigins[0], planetOrigins[1], planetOrigins[2], planetOrigins[3], planetOrigins[4], planetOrigins[5], planetOrigins[6], planetOrigins[7], planetOrigins[8]];
      let menuIntersectsArray = [uiOptions[0], uiOptions[1], uiOptions[2], uiOptions[3], uiOptions[4], uiOptions[5], uiOptions[6], uiOptions[7], uiOptions[8], uiOptions[9], uiOptions[10], planetOptions[0], planetOptions[1], planetOptions[2], planetOptions[3], planetOptions[4], planetOptions[5], planetOptions[6], planetOptions[7], planetOptions[8], planetOptions[9], planetOptions[10], textBox];

      //Check if ray intercepted and touchable objs
      let intersects = sceneRaycaster.intersectObjects(menuIntersectsArray, true);

      if (intersects.length > 0){
        menuEvent(intersects);

      } else {
        let intersects = sceneRaycaster.intersectObjects(sceneIntersectsArray, true);
        if (intersects.length > 0){

          //Check for sun
          if (intersects[0].object.parent.name == "Sun"){
            sceneEvent(intersects, "Sun");

            //Check for moon
          } else if (intersects[0].object.parent.name == "Moon"){
            sceneEvent(intersects, "Moon");

          //Check for planets
          } else {

            for (let i=0; i<jsonObj.numPlanets; i++){
              if (intersects[0].object.children[0] == planets[i]){
                sceneEvent(intersects, planets[i].name);

              } else if (intersects[0].object.parent == planets[i]){
                sceneEvent(intersects, planets[i].name);
              }
            }
          }
        }
      }
    }

  } else {
    if (reticle.visible){
      showSolarSystem = true;
      sunObj.getWorldPosition(placementPos);
      sunObj.position.y = 0;
      sunObj.children[0].material.opacity = 1;
      originPoint.add(sunObj);

      scene.add(originPoint);
      originPoint.position.copy(placementPos);
    } else {
       console.log("cant place yet");
    }
  }
}


/*****************************************************************
  Scene Object Events
******************************************************************/
function sceneEvent(intersects, obj){
  if (!jsonObj.objTranslation.inTransit){
    switch(obj){

      case "Sun":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        sunSelect();
        break;

      case "Mercury":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(0);
        break;

      case "Venus":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(1);
        break;

      case "Earth":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(2);

        if (jsonObj.planets[2].beingViewed){
          let point = planets[2].worldToLocal(intersects[0].point);
          checkEarthBoundingBoxs(point);
        }
        break;

      case "Moon":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        moonSelect();
        break;

      case "Mars":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(3);
        break;

      case "Jupiter":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(4);
        break;

      case "Saturn":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(5);
        break;

      case "Uranus":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(6);
        break;

      case "Neptune":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(7);
        break;

      case "Pluto":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        planetSelect(8);
        break;

      default:
        break;
    }
  }
}


/*****************************************************************
  UI Object Events
******************************************************************/
function menuEvent(intersects){
  if (intersects[0].object.name){
    switch(intersects[0].object.name){

      case "Drawer":
        minimizeTextBox(true);
        toggleUIOptionsVisibility();
        togglePlanetsOptionsVisibilityOff();
        break;

      case "Lines":
        toggleOrbitLines();
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        break;

      case "Planets":
        minimizeTextBox(true);
        togglePlanetsOptionsVisibility();
        break;

      case "Light":
        toggleLight();
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        break;

      case "OrbitSpeed":
        switch (jsonObj.orbitScale) {
          //Fast Speed
          case 0.1:
            jsonObj.orbitScale = 7;
            break;

          //Normal Speed
          case 1:
            jsonObj.orbitScale = 0.1;
            break;

          //Slow Speed
          case 7:
            jsonObj.orbitScale = 1;
            break;
        }
        break;

      case "RotationSpeed":
        switch (jsonObj.rotationScale){
          //Fast Speed
          case 1:
            jsonObj.rotationScale = 100;
            break;

          //Normal Speed
          case 10:
            jsonObj.rotationScale = 1;
            break;

          //Slow Speed
          case 100:
            jsonObj.rotationScale = 10;
            break;
        }
        break;

      case "Reset":
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        resetSolarSystem();
        break;

      case "Return to Origin":
        toggleReturnToOrigin();
        toggleUIOptionsVisibilityOff();
        togglePlanetsOptionsVisibilityOff();
        break;

      case "Exit":
        toggleUIOptionsVisibility();
        togglePlanetsOptionsVisibilityOff();
        xrSession.end()
        break;

      case "Sun":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        sunSelect();
        break;

      case "Mercury":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(0);
        break;

      case "Venus":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(1);
        break;

      case "Earth":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(2);

        if (jsonObj.planets[2].beingViewed){
          let point = planets[2].worldToLocal(intersects[0].point);

          checkEarthBoundingBoxs(point);
        }
        break;

      case "Moon":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        moonSelect();
        break;

      case "Mars":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(3);
        break;

      case "Jupiter":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(4);
        break;

      case "Saturn":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(5);
        break;

      case "Uranus":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(6);
        break;

      case "Neptune":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(7);
        break;

      case "Pluto":
        togglePlanetsOptionsVisibilityOff();
        toggleUIOptionsVisibilityOff();
        planetSelect(8);
        break;

      case "Pause":
        togglePause();
        break;

      case "Play":
        togglePause();
        break;

      case "textBox":
        //Check if minimized
        if (textBox.position.y == -0.0855){
          minimizeTextBox(false);
        } else {
          minimizeTextBox(true);
        }
        break;

      default:
        break;
    }
  }
}


/*****************************************************************
  Scene Event Helper Functions
******************************************************************
=> Grab random fun fact from JSON
=> Set varibles so appropriate action can be taken to move towards user
*******************************************************************/
function sunSelect(){
  //Pick random fact
  let ranNum = Math.floor(Math.random() * 5);

  updateCanvasTexture(sunObj, jsonObj.sun.facts[ranNum]);

  if (!jsonObj.sun.beingViewed){

    //Hide textBox for transition
    textBox.visible = false;
    minimizeTextBox(false);

    for (let i=0; i<jsonObj.numPlanets; i++){

      if (jsonObj.planets[i].beingViewed){
        jsonObj.objTranslation.switchObj = true;
        jsonObj.planets[i].switchingFrom = true;

        //Reset Values
        scene.attach(originPoint);
        planetOrigins[i].remove(sunPivot);
        pivots[i].attach(planetOrigins[i]);
      }

      if (jsonObj.planets[i].moon){
        if (jsonObj.planets[i].moon.beingViewed){
          jsonObj.objTranslation.switchObj = true;
          jsonObj.planets[i].moon.switchingFrom = true;

          //Reset Values
          scene.attach(originPoint);
          planetOrigins[i].remove(sunPivot);
          pivots[i].attach(planetOrigins[i]);
          planetOrigins[i].add(moonPivot);
          moonPivot.position.set(0, 0, 0);
          moonPivot.attach(moonOrigin);
        }
      }


      jsonObj.planets[i].beingViewed = false;
      jsonObj.planets[i].moveOrbit = false;
      if ( jsonObj.planets[i].moon ){
        jsonObj.planets[i].moon.beingViewed = false;
        jsonObj.planets[i].moon.moveOrbit = false;
      }

        if (jsonObj.showPlanetLines){
          orbitLines[i].visible = false;
        }
    }

    jsonObj.sun.beingViewed = true;

    jsonObj.objTranslation.timeStep = 100;
    jsonObj.objTranslation.inTransit = true;
    atOrigin = false

  } else {
    minimizeTextBox(false);
  }
}

function planetSelect(num){

  //Pick random fact
  let ranNum = Math.floor(Math.random() * 5);

  atOrigin = false;

  updateCanvasTexture(planets[num], jsonObj.planets[num].facts[ranNum]);

  if (!jsonObj.planets[num].beingViewed){

    //Hide textBox for transition
    textBox.visible = false;
    minimizeTextBox(false);

    if (jsonObj.sun.beingViewed){
      jsonObj.objTranslation.switchObj = true;
      jsonObj.sun.switchingFrom = true;
    }

    for (let i=0; i<jsonObj.numPlanets; i++){

      if (jsonObj.planets[i].beingViewed){
        jsonObj.objTranslation.switchObj = true;
        jsonObj.planets[i].switchingFrom = true;

        //Reset Values
        scene.attach(originPoint);
        planetOrigins[i].remove(sunPivot); //could attach to scene
        pivots[i].attach(planetOrigins[i]);
      }

      if (jsonObj.planets[i].moon){
        if (jsonObj.planets[i].moon.beingViewed){
          jsonObj.objTranslation.switchObj = true;
          jsonObj.planets[i].moon.switchingFrom = true;

          //Reset Values
          scene.attach(originPoint);
          planetOrigins[i].remove(sunPivot);
          pivots[i].attach(planetOrigins[i]);
          planetOrigins[i].add(moonPivot);
          moonPivot.position.set(0, 0, 0);
          moonPivot.attach(moonOrigin);
        }
      }

      jsonObj.planets[i].beingViewed = false;
      jsonObj.planets[i].moveOrbit = false;
      if ( jsonObj.planets[i].moon ){
        jsonObj.planets[i].moon.beingViewed = false;
        jsonObj.planets[i].moon.moveOrbit = false;
      }

      if (jsonObj.showPlanetLines){
        orbitLines[i].visible = false;
      }
    }

    jsonObj.sun.beingViewed = false;
    jsonObj.planets[num].beingViewed = true;

    jsonObj.objTranslation.timeStep = 100;
    jsonObj.objTranslation.inTransit = true;
    atOrigin = false;

  } else {
    minimizeTextBox(false);
  }
}

//NOTE: moonSelect is configured only for earths moon
function moonSelect(){

  //Pick random fact
  let ranNum = Math.floor(Math.random() * 5);

  updateCanvasTexture(moonObj, jsonObj.planets[2].moon.facts[ranNum]);

  if (!jsonObj.planets[2].moon.beingViewed){

    //Hide textBox for transition
    textBox.visible = false;
    minimizeTextBox(false);

    if (jsonObj.sun.beingViewed){
      jsonObj.objTranslation.switchObj = true;
      jsonObj.sun.switchingFrom = true;
    }

    for (let i=0; i<jsonObj.numPlanets; i++){

      if (jsonObj.planets[i].beingViewed){
        jsonObj.objTranslation.switchObj = true;
        jsonObj.planets[i].switchingFrom = true;

        //Reset Values
        scene.attach(originPoint);
        planetOrigins[i].remove(sunPivot);
        pivots[i].attach(planetOrigins[i]);
      }

      jsonObj.planets[i].beingViewed = false;
      jsonObj.planets[i].moveOrbit = false;
      if ( jsonObj.planets[i].moon ){
        jsonObj.planets[i].moon.beingViewed = false;
        jsonObj.planets[i].moon.moveOrbit = false;

        //Update Distance From Sun
        let moonPos = new THREE.Vector3();
        let sunPos = new THREE.Vector3();
        moonObj.getWorldPosition(moonPos);
        originPoint.getWorldPosition(sunPos);

        jsonObj.planets[i].moon.distanceFromSun = moonPos.distanceTo(sunPos);
      }

      if (jsonObj.showPlanetLines){
        orbitLines[i].visible = false;
      }
    }

    jsonObj.sun.beingViewed = false;
    jsonObj.planets[2].moon.beingViewed = true;

    jsonObj.objTranslation.timeStep = 100;
    jsonObj.objTranslation.inTransit = true;

    atOrigin = false;

  } else {
    minimizeTextBox(false);
  }
}


//Earth Bounding Boxs
function checkEarthBoundingBoxs(point){

  let antarcticaBox = new THREE.Box3();
  antarcticaBox.setFromPoints(jsonObj.continents[6].boundingBox);
  antarcticaBox.expandByPoint(jsonObj.continents[6].centerPoint);

  let australiaBox = new THREE.Box3();
  australiaBox.setFromPoints(jsonObj.continents[5].boundingBox);

  let europeBox = new THREE.Box3();
  europeBox.setFromPoints(jsonObj.continents[2].boundingBox);

  let africaBox1 = new THREE.Box3();
  africaBox1.setFromPoints(jsonObj.continents[3].boundingBox[0]);

  let africaBox2 = new THREE.Box3();
  africaBox2.setFromPoints(jsonObj.continents[3].boundingBox[1]);

  let southAmericaBox1 = new THREE.Box3();
  southAmericaBox1.setFromPoints(jsonObj.continents[1].boundingBox[0]);

  let southAmericaBox2 = new THREE.Box3();
  southAmericaBox2.setFromPoints(jsonObj.continents[1].boundingBox[1]);

  let northAmericaBox1 = new THREE.Box3();
  northAmericaBox1.setFromPoints(jsonObj.continents[0].boundingBox[0]);

  let northAmericaBox2 = new THREE.Box3();
  northAmericaBox2.setFromPoints(jsonObj.continents[0].boundingBox[1]);

  let asiaBox1 = new THREE.Box3();
  asiaBox1.setFromPoints(jsonObj.continents[4].boundingBox[0]);

  let asiaBox2 = new THREE.Box3();
  asiaBox2.setFromPoints(jsonObj.continents[4].boundingBox[1]);

  if (antarcticaBox.containsPoint(point)){
    continentObj.name = "Continent: Antarctica";
    updateCanvasTexture(continentObj, jsonObj.continents[6].fact);

  } else if (australiaBox.containsPoint(point)){
    continentObj.name = "Continent: Australia";
    updateCanvasTexture(continentObj, jsonObj.continents[5].fact);

  } else if (europeBox.containsPoint(point)){
    continentObj.name = "Continent: Europe";
    updateCanvasTexture(continentObj, jsonObj.continents[2].fact);

  } else if (africaBox1.containsPoint(point)){
    continentObj.name = "Continent: Africa";
    updateCanvasTexture(continentObj, jsonObj.continents[3].fact);

  } else if (africaBox2.containsPoint(point)){
    continentObj.name = "Continent: Africa";
    updateCanvasTexture(continentObj, jsonObj.continents[3].fact);

  } else if (southAmericaBox1.containsPoint(point)){
    continentObj.name = "Continent: South America";
    updateCanvasTexture(continentObj, jsonObj.continents[1].fact);

  } else if (southAmericaBox2.containsPoint(point)){
    continentObj.name = "Continent: South America";
    updateCanvasTexture(continentObj, jsonObj.continents[1].fact);

  } else if (northAmericaBox1.containsPoint(point)){
    continentObj.name = "Continent: North America";
    updateCanvasTexture(continentObj, jsonObj.continents[0].fact);

  } else if (northAmericaBox2.containsPoint(point)){
    continentObj.name = "Continent: North America";
    updateCanvasTexture(continentObj, jsonObj.continents[0].fact);

  } else if (asiaBox1.containsPoint(point)){
    continentObj.name = "Continent: Asia";
    updateCanvasTexture(continentObj, jsonObj.continents[4].fact);

  } else if (asiaBox2.containsPoint(point)){
    continentObj.name = "Continent: Asia";
    updateCanvasTexture(continentObj, jsonObj.continents[4].fact);

  } else {
    console.log("False");
  }
}


/*****************************************************************
  UI Helper Functions
*****************************************************************/
//Open Drawer
function toggleUIOptionsVisibility(){
  uiOptionsVisible = !uiOptionsVisible;

  for(let i=1; i<jsonObj.ui_size; i++){
    if(uiOptionsVisible && i!=6 && i!=7){
      uiOptions[i].position.x = jsonObj.ui[i].position.x;
    } else {
      if (i!=2 && i!=6 && i!=7)
      uiOptions[i].position.x = 1.0;
    }
  }

  uiOptions[6].position.x = (uiOptionsVisible && !atOrigin) ? jsonObj.ui[6].position.x : 1.0;
}

//Close Drawer
function toggleUIOptionsVisibilityOff(){
  uiOptionsVisible = false;
  for(let i=1; i<jsonObj.ui_size; i++){
    if(i!=2 && i!=7/*&& i!=6*/)
      uiOptions[i].position.x = 1.0;
  }
}

//Open Planet Drawer
function togglePlanetsOptionsVisibility(){
  planetOptionsVisible = !planetOptionsVisible;

  for(let i=0; i<jsonObj.ui[uiPlanetIndex].size; i++){
    if(planetOptionsVisible){
      planetOptions[i].position.x = 0.05;
    } else {
      planetOptions[i].position.x = 1.0;
    }
  }
}

//Close Planet Drawer
function togglePlanetsOptionsVisibilityOff(){
  planetOptionsVisible = false;
  for(let i=0; i<jsonObj.ui[uiPlanetIndex].size; i++){
    planetOptions[i].position.x = 1.0;
  }
}

//Change Light
function toggleLight(){
  if (cameraLight.visible){
    cameraLight.visible = false;
    sunLight.visible = true;

  } else {
    cameraLight.visible = true;
    sunLight.visible = false;
  }
}

//Change OrbitLines
function toggleOrbitLines(){
  if (jsonObj.showPlanetLines){
    jsonObj.showPlanetLines = false;
    for (var i=0; i<jsonObj.numPlanets; i++){
      orbitLines[i].visible = false;
    }

  } else {
    jsonObj.showPlanetLines = true;
    for (var i=0; i<jsonObj.numPlanets; i++){
      orbitLines[i].visible = true;
    }
  }
}

//Return To Origin
function toggleReturnToOrigin(){
  //Reset Hierarchy
  scene.attach(originPoint);

  for (let i=0; i<jsonObj.numPlanets; i++){
    if (jsonObj.planets[i].beingViewed){
      planetOrigins[i].remove(sunPivot);
      pivots[i].attach(planetOrigins[i]);
    }

    if (jsonObj.planets[i].moon){
      if (jsonObj.planets[i].moon.beingViewed){
        planetOrigins[i].remove(sunPivot);
        pivots[i].attach(planetOrigins[i]);
        planetOrigins[i].add(moonPivot);
        moonPivot.position.set(0, 0, 0);
        moonPivot.attach(moonOrigin);
      }
    }
  }

  //Hide textBox for transition
  textBox.visible = false;
  jsonObj.objTranslation.inTransit = true;
  jsonObj.originReturn = true;
  atOrigin = true;
}

//Pause or Unpause
function togglePause(){
  if (!jsonObj.pause){
    //Pause
    jsonObj.pause = true;
    jsonObj.sun.moveRotate = false;

    for (let i=0; i<jsonObj.numPlanets; i++){
      jsonObj.planets[i].moveRotate = false;
      jsonObj.planets[i].moveOrbit = false;

      if (jsonObj.planets[i].moon){
        jsonObj.planets[i].moon.moveRotate = false;
        jsonObj.planets[i].moon.moveOrbit = false;
      }
    }
    uiOptions[2].position.x = 1.0;
    uiOptions[7].position.x =jsonObj.ui[7].position.x;
  } else {
    //UnPause
    jsonObj.pause = false;
    jsonObj.sun.moveRotate = true;

    for (let i=0; i<jsonObj.numPlanets; i++){
      if (!jsonObj.planets[i].beingViewed){
        jsonObj.planets[i].moveRotate = true;
        jsonObj.planets[i].moveOrbit = true;
      } else {
        jsonObj.planets[i].moveRotate = true;
      }

      if (jsonObj.planets[i].moon){
        if (!jsonObj.planets[i].moon.beingViewed){
          jsonObj.planets[i].moon.moveRotate = true;
          jsonObj.planets[i].moon.moveOrbit = true;
        }
      }
    }
    uiOptions[7].position.x = 1.0;
    uiOptions[2].position.x =jsonObj.ui[2].position.x;
  }
}

//Reset SolarSystem
function resetSolarSystem(){
  textBox.visible = false;

  if (jsonObj.sun.beingViewed){
    scene.attach(originPoint);
    for (let i=jsonObj.objTranslation.timeStep; i>-1; i--){
      returnToOrigin();
    }
  } else {

    for (let i=0; i<jsonObj.numPlanets; i++){
      if (jsonObj.planets[i].beingViewed){
        scene.attach(originPoint);
        planetOrigins[i].remove(sunPivot);
        pivots[i].attach(planetOrigins[i]);

        for (let i=jsonObj.objTranslation.timeStep; i>-1; i--){
          returnToOrigin();
        }
      }

      if (jsonObj.planets[i].moon){
        if (jsonObj.planets[i].moon.beingViewed){
          scene.attach(originPoint);
          planetOrigins[i].remove(sunPivot);
          pivots[i].attach(planetOrigins[i]);
          planetOrigins[i].add(moonPivot);
          moonPivot.position.set(0, 0, 0);
          moonPivot.attach(moonOrigin);

          for (let i=jsonObj.objTranslation.timeStep; i>-1; i--){
            returnToOrigin();
          }
        }
      }
    }
  }

  showSolarSystem = false;
}

//Update Textbox
function updateCanvasTexture(obj, fact){

  //Create new canvas
  let ctx = document.createElement('canvas').getContext('2d');

  ctx.canvas.style.width = 200 + "px";
  ctx.canvas.style.height = 200 + "px";

  let scale = window.devicePixelRatio;

  if (!scale){
    scale = 1;
  }

  ctx.canvas.height = 200 * scale;
  ctx.canvas.width = 200 * scale;

  ctx.scale(scale, scale);

  //Background
  ctx.fillStyle = '#FF6600';
  ctx.fillRect(0, 0, 200, 150);

  ctx.fillStyle = "#000000";

  //Title
  ctx.font = '18px Bold Arial';
  ctx.textAlign = "center";
  ctx.fillText(obj.name, 100, 20);

  ctx.strokeStyle = "#000000";
  ctx.beginPath();
  ctx.moveTo(0, 25);
  ctx.lineTo(200, 25);
  ctx.stroke();

  ctx.textAlign = "left";

  //Information
  ctx.font = '10px Arial';
  if (obj == sunObj){

    ctx.fillText("Mass: " + jsonObj.sun.mass, 7, 40);
    ctx.fillText("Radius: " + jsonObj.sun.radius + " km", 7, 60);
    ctx.fillText("Surface Temperature: " + jsonObj.sun.surfaceTemperature + " fahrenheit", 7, 80); //jsonObj.sun.surfaceTemperature fahrenheit
    ctx.fillText("Core Temperature: " + jsonObj.sun.coreTemperature + " fahrenheit", 7, 100); //jsonObj.sun.coreTemperature + fahrenheit

  } else if (obj == moonObj){

    ctx.fillText("Mass: " + jsonObj.planets[2].moon.mass, 7, 40);
    ctx.fillText("Radius: " + jsonObj.planets[2].moon.radius + " km", 7, 60);
    ctx.fillText("Orbital Period Around Earth: " + jsonObj.planets[2].moon.orbitPeriod, 7, 80);
    ctx.fillText("Distance from Earth: " + jsonObj.planets[2].moon.distanceFromEarth + " km", 7, 100);

  } else if (obj == continentObj){
      for (let i=0; i<7; i++){
        if (obj.name == "Continent: " + jsonObj.continents[i].name){
          ctx.fillText("Area: " + jsonObj.continents[i].area, 7, 40);
          ctx.fillText("Population: " + jsonObj.continents[i].population, 7, 60);
          ctx.fillText("Number of Countries: " + jsonObj.continents[i].countries, 7, 80);
        }
      }

  } else {
    for (let i=0; i<jsonObj.numPlanets; i++){
      if (obj == planets[i]){

        ctx.fillText("Mass: " + jsonObj.planets[i].mass, 7, 40);
        ctx.fillText("Radius: " + jsonObj.planets[i].radius + " km", 7, 60);
        ctx.fillText("Orbital Period: " + jsonObj.planets[i].orbitPeriod, 7, 80);
        ctx.fillText("Distance from Sun: " + jsonObj.planets[i].distanceFromSun + " km", 7, 100);
      }
    }
  }

  wrapText(ctx, "Fun Fact: " + fact, 7, 120, 180, 18);

  let texture = new THREE.CanvasTexture(ctx.canvas);
  textBox.material.map = texture;
  textBox.material.needsUpdate = true;
}


//Code credit to: https://www.html5canvastutorials.com/tutorials/html5-canvas-wrap-text-tutorial/
function wrapText(context, text, x, y, maxWidth, lineHeight){
  let words = text.split(' ');
  let line = '';

  for (let i=0; i<words.length; i++){
    let testLine = line + words[i] + ' ';
    let metrics = context.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && i > 0) {
      context.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
    context.fillText(line, x, y);
  }
}


function minimizeTextBox(minimize) {
  if (minimize){
    textBox.position.y = -0.0855;
  } else {
    textBox.position.y = -0.055;
  }
}


init();
