import * as THREE from 'three';
import EnvironmentScene from './vendor/ModelViewerEnvironment.js';
import { surfaceFor,surfaceColor,ecoSurface,LIGHTING_PROFILES } from './appearance.js';
import {specklePixels} from './finish-texture.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
const finishTextures=new Map();
function ecoTexture(product,hex){const options=product.appearance.eco,key=hex+JSON.stringify(options);if(!finishTextures.has(key)){const image=specklePixels(hex,options),texture=new THREE.DataTexture(image.bytes,image.width,image.height);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;finishTextures.set(key,texture);}return finishTextures.get(key);}
export function configureRenderer(renderer,exposure=1,profile='neutral'){renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=exposure*1.3*(LIGHTING_PROFILES[profile]?.exposure||1);}
// Keep image previews and material editing in the same lighting profile as the stage.
export function studioLighting(){}
export function studioEnvironment(renderer,profile='neutral'){
 const room=new EnvironmentScene(profile),pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(room,.04);
 const resources=new Set();room.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});resources.forEach(r=>r.dispose());pmrem.dispose();return target;
}
export function surfaceMaterial(product,part,color){
  const s=surfaceFor(product,part),material=new THREE.MeshPhysicalMaterial({color:surfaceColor(product,part,color),roughness:s.roughness,metalness:s.metalness,clearcoat:s.clearcoat,clearcoatRoughness:.22,envMapIntensity:1});
  if(ecoSurface(product,part)){material.map=ecoTexture(product,surfaceColor(product,part,color));material.color.set('#ffffff');}
  material.userData.linked=s.linked;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vFinishPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition=position;');
    shader.fragmentShader='varying vec3 vFinishPosition;\nuniform float finishGrain;\n'+shader.fragmentShader;
    shader.uniforms.finishGrain={value:s.grain};
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nfloat grainNoise=fract(sin(dot(floor(vFinishPosition*600.0),vec3(12.9898,78.233,41.12)))*43758.5453);\nroughnessFactor=clamp(roughnessFactor+(grainNoise-.5)*finishGrain,.05,1.0);');
  };
  material.customProgramCacheKey=()=>`finish-v3-${s.grain}`;return material;
}
export function cloneProduct(original,product,color){const clone=cloneSkeleton(original);clone.traverse(o=>{if(o.isMesh){o.material=surfaceMaterial(product,o.name,color);o.castShadow=true;o.receiveShadow=true;}});return clone;}
export function releaseProduct(group){group?.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
