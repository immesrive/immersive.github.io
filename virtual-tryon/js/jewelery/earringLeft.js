//import {OBJLoader2} from 'https://threejsfundamentals.org/threejs/resources/threejs/r119/examples/jsm/loaders/OBJLoader2.js';
import {OBJLoader} from '../../third-party/OBJLoader.js';
import {DistanceHelper} from "../helpers/distanceHelper.js";
import {MeshStandardMaterial, Vector3} from "../../third-party/three.module.js";

export class EarringLeft{
    constructor(mesh){
        this.mesh = mesh;
        this.path = "";
        this.prevDom = {x: 0, y:0};
    }
    async update({poses, mask, xOff, yOff, zOff, width, height, scaleOff, camera, earringPath, adaptive, rotX, rotY, rotZ}){
        if(earringPath !== this.path){
            this.path = earringPath;
            this.mesh.children[0].geometry = (await EarringLeft.create(earringPath)).children[0].geometry
//            console.log("Howdy");
        }
        
//        console.log("scaled: " + poses.poseLandmarks[8].x * 500)
        
        const domToWorld = function(x, y) {
          let newPosition = new Vector3();
          let normalizedX = (x / width) * 2 - 1;
          let normalizedY = ((y - height) / height) * 2 + 1;
          newPosition.set(normalizedX, -normalizedY, 0);
          newPosition.unproject(camera);
          return newPosition;
        };
//        console.log("POSES EARRING")
//        console.log(poses)
        
        if(poses.poseLandmarks[8].score <= 0.1){
            this.hide();
            return;
        }
        var domPos = domToWorld(
            poses.poseLandmarks[8].x * width, 
            poses.poseLandmarks[8].y * height
        );
        
//        console.log("Earrings: " + domPos.x + " " + domPos.y);
        this.mesh.position.x = (domPos.x + this.prevDom.x)/2 + xOff;
        this.mesh.position.y = (domPos.y + this.prevDom.y)/2 + yOff;
        const trackLeftRot = mask.geometry.track(109 , 108 , 151 );
        const trackLeftPos = mask.geometry.track(177 , 137 , 132 );
        this.mesh.rotation.setFromRotationMatrix(trackLeftRot.rotation);
        var temp = this.mesh.rotation.z;
        
        this.mesh.rotation.x += rotX / 180 * Math.PI;
        this.mesh.rotation.z = this.mesh.rotation.y + rotZ/180 * Math.PI;
        this.mesh.rotation.y = -temp + rotY/180 * Math.PI;
        this.mesh.position.z = trackLeftPos.position.z + zOff;
        
        var domPosLeft = domToWorld(poses.poseLandmarks[11].x * width, poses.poseLandmarks[11].y * height);
        var domPosRight = domToWorld(poses.poseLandmarks[12].x * width, poses.poseLandmarks[12].y * height);
        if(!adaptive){
            this.mesh.scale.x = 10 + scaleOff;
            this.mesh.scale.y = 10 + scaleOff;
            this.mesh.scale.z = 10 + scaleOff;
        } else {            
            this.mesh.scale.setScalar(DistanceHelper.distance({
                x1: domPosLeft.x, 
                y1: domPosLeft.y, 
                x2: domPosRight.x, 
                y2: domPosRight.y})/23 + scaleOff);
        }
        
        this.prevDom.x = domPos.x;
        this.prevDom.y = domPos.y;
    }
    static create(objPath) {
        this.path = objPath;
        return new Promise((resolve, reject) => {
            const objLoader = new OBJLoader();
            var loader = objLoader.load(objPath, (root) => {
                //console.log("FUNCTION: " + objLoader.load);
                var material = new MeshStandardMaterial({
                      color: 0xD4AF37,
                      roughness: 0.4,
                      metalness: 0.1,
                      transparent: true,
                });
                //console.log(root);
                root.children[0].material = material;
                root.scale.setScalar(10);
                root.name = "left";
                root.castShadow = true; 
                root.receiveShadow = true;
                root.rotation.x = -90;
                resolve(root);
                console.log("Called!")
            });
        });
    }
    hide(){
        //console.log(this.mesh);
        this.mesh.visible = false;
    }
    show(){
        //console.log(this.mesh);
        this.mesh.visible = true;
    }
}
