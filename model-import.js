import * as THREE from 'three';
import { FBXLoader } from './vendor/FBXLoader.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { GLTFExporter } from './vendor/GLTFExporter.js';
import {productUVs} from './product-uv.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { mergeVertices } from './vendor/BufferGeometryUtils.js';

const internalName = /(?:pcb|电池|纽扣电池|蜂鸣|fmq|fmp|speaker|battery|circuit|^结构$|(?:^|[_-])DC(?:[_-]|$)|(?:^|[_-])XLB(?:[_-]|$))/i;
const safeKey = (name, index) => `part-${String(index + 1).padStart(2, '0')}-${name.normalize('NFKD').replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'mesh'}`;

export function triangleKey(geometry, index) {
  const position = geometry.attributes.position;
  const vertices = [];
  for (let k=0;k<3;k++) vertices.push([position.getX(index+k),position.getY(index+k),position.getZ(index+k)].map(v=>Math.round(v*100000)).join(','));
  return vertices.sort().join(';');
}

/** Copy whole triangles, preserving imported corner normals and UVs. */
export function subsetGeometry(source, trianglePredicate = () => true, start = 0, count = Infinity) {
  const geometry = source.index ? source.toNonIndexed() : source;
  const end = Math.min(geometry.attributes.position.count, start + count);
  const selected = [];
  for (let i = start; i + 2 < end; i += 3) if (trianglePredicate(i, geometry)) selected.push(i, i + 1, i + 2);
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    if (name === 'skinIndex' || name === 'skinWeight') continue;
    // Decode quantized / interleaved GLB attributes before world transforms.
    // Transforming normalized integer storage directly would clip or wrap it.
    const values = new Float32Array(selected.length * attr.itemSize);
    for (let k = 0; k < selected.length; k++) for (let j = 0; j < attr.itemSize; j++) values[k * attr.itemSize + j] = attr.getComponent(selected[k], j);
    out.setAttribute(name, new THREE.BufferAttribute(values, attr.itemSize));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  out.computeBoundingBox();
  return out;
}

export function physicalMaterial(key, finish = 'matte', color = '#eeefeb') {
  const settings = {
    matte: {roughness: .52, metalness: 0, clearcoat: .000001, clearcoatRoughness: .22},
    gloss: {roughness: .17, metalness: 0, clearcoat: .72, clearcoatRoughness: .12},
    metal: {roughness: .2, metalness: 1, clearcoat: .000001, clearcoatRoughness: .15},
    silicone: {roughness: .78, metalness: 0, clearcoat: .000001, clearcoatRoughness: .35}
  };
  const material = new THREE.MeshPhysicalMaterial({color, ...(settings[finish] || settings.matte)});
  material.name = key;
  return material;
}

/**
 * Import without discarding potentially external small pieces. The review UI must
 * let a person confirm selected parts: names cannot reliably identify internals.
 * FBX source normals and all world transforms are retained; camera/light nodes
 * and animation rigs are not included in the public static product asset.
 */
export async function inspectModel(buffer, filename) {
  const bytes = ArrayBuffer.isView(buffer) ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer;
  let root;
  if (/\.fbx$/i.test(filename)) root = new FBXLoader().parse(bytes, '');
  else if (/\.glb$/i.test(filename)) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    root = (await loader.parseAsync(bytes, '')).scene;
  } else throw new Error('请选择 FBX 或 GLB 模型。');
  root.updateMatrixWorld(true);
  const scene = new THREE.Group();
  scene.name = 'product-exterior';
  const parts = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position) return;
    const geometry = subsetGeometry(object.geometry);
    geometry.applyMatrix4(object.matrixWorld);
    if (object.matrixWorld.determinant() < 0) {
      for (const attr of Object.values(geometry.attributes)) for (let i = 0; i < attr.count; i += 3) for (let k = 0; k < attr.itemSize; k++) {
        const a = (i + 1) * attr.itemSize + k, b = (i + 2) * attr.itemSize + k;
        [attr.array[a], attr.array[b]] = [attr.array[b], attr.array[a]];
      }
    }
    const groups = object.geometry.groups.length ? object.geometry.groups : [{start: 0, count: geometry.attributes.position.count, materialIndex: 0}];
    for (const group of groups) {
      const originalMaterial = Array.isArray(object.material) ? object.material[group.materialIndex] : object.material;
      const label = object.name || `部件 ${parts.length + 1}`;
      const key = safeKey(label, parts.length);
      const selectedGeometry = subsetGeometry(geometry, () => true, group.start, group.count);
      if (!selectedGeometry.attributes.position.count) continue;
      const sourceGlb = /\.glb$/i.test(filename);
      const namedFinish = /硅胶|silicone/i.test(label) ? 'silicone' : /金属|metal/i.test(label) ? 'metal' : /内环|按键|loop|gloss|emboss|groove/i.test(label) ? 'gloss' : 'matte';
      const defaultFinish = sourceGlb && originalMaterial?.metalness>.6 ? 'metal' : sourceGlb && originalMaterial?.roughness<.28 ? 'gloss' : namedFinish;
      const material = physicalMaterial(key, defaultFinish);
      if (originalMaterial?.color) material.color.copy(originalMaterial.color);
      if (originalMaterial?.map) material.map = originalMaterial.map;
      if (sourceGlb) {
        for (const property of ['roughness','metalness','roughnessMap','metalnessMap','normalMap','normalScale','aoMap','aoMapIntensity','emissive','emissiveMap','emissiveIntensity','opacity','transparent','alphaTest','side','clearcoatMap','clearcoatNormalMap','clearcoatRoughness','clearcoatRoughnessMap','clearcoatNormalScale','ior','specularIntensity','specularColor']) if (originalMaterial?.[property]!==undefined) material[property]=originalMaterial[property];
        material.clearcoat=Math.max(.000001,originalMaterial?.clearcoat || 0);
      }
      const mesh = new THREE.Mesh(selectedGeometry, material);
      mesh.name = key;
      mesh.userData.sourceName = label;
      mesh.userData.sourceParent = object.parent?.name || '';
      scene.add(mesh);
      const knownTag08Internal = /(?:^|[\\/])Tag08\.fbx$/i.test(filename) && /^(?:AdmiD20Ak9if|AdmiD20Ak9if_[34])$/.test(label);
      const knownTag15Internal = /(?:^|[\\/])Tag15\.fbx$/i.test(filename) && label==='PRT0001';
      const part = {key, label, defaultFinish, triangleCount: selectedGeometry.attributes.position.count / 3, defaultSelected: !internalName.test(label) && !knownTag08Internal && !knownTag15Internal};
      if(defaultFinish==='metal') {part.defaultColor=`#${material.color.getHexString()}`;part.colorLinked=false;}
      parts.push(part);
      mesh.userData.part = part;
    }
  });
  if (!parts.length) throw new Error('模型中没有可展示的三角网格。');
  // Some DCC exports duplicate a face-selection mesh inside its full parent.
  // Keep the explicit child region and remove coincident triangles only from
  // that named parent. This avoids z-fighting while retaining separate finishes.
  for (const child of scene.children) {
    const parent = scene.children.find(mesh=>mesh!==child && mesh.userData.sourceName===child.userData.sourceParent);
    if (!parent || parent.geometry.attributes.position.count<=child.geometry.attributes.position.count) continue;
    const keys = new Set();
    for (let i=0;i<child.geometry.attributes.position.count;i+=3) keys.add(triangleKey(child.geometry,i));
    const trimmed = subsetGeometry(parent.geometry,i=>!keys.has(triangleKey(parent.geometry,i)));
    parent.geometry.dispose();
    parent.geometry = trimmed;
    parent.userData.part.triangleCount = trimmed.attributes.position.count/3;
  }
  const bounds = new THREE.Box3().setFromObject(scene);
  const sourceDimensions = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 3 / Math.max(sourceDimensions.x, sourceDimensions.y, sourceDimensions.z);
  if (!Number.isFinite(scale)) throw new Error('模型尺寸无效。');
  for (const mesh of scene.children) {
    mesh.geometry.translate(-center.x, -center.y, -center.z);
    mesh.geometry.scale(scale, scale, scale);
    mesh.geometry.computeBoundingBox();
  }
  const stats = {meshes: parts.length, triangles: parts.reduce((n, p) => n + p.triangleCount, 0), dimensions: sourceDimensions.clone().multiplyScalar(scale).toArray(), sourceDimensions: sourceDimensions.toArray()};
  scene.userData.importStats = stats;
  return {scene, parts, stats};
}

/** Export only the explicitly selected regions; never mutate the review scene. */
export async function exportModel(scene, selectedPartKeys) {
  const keys = new Set(selectedPartKeys);
  const output = new THREE.Group();
  output.name = 'product-exterior';
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh || !keys.has(object.name)) return;
    const clone = new THREE.Mesh(object.geometry.clone().applyMatrix4(object.matrixWorld), object.material.clone());
    clone.name = object.name;
    clone.material.name = object.name;
    clone.userData = {sourceName: object.userData.sourceName || object.name};
    output.add(clone);
  });
  if (!output.children.length) throw new Error('请至少选择一个外观部件。');
  const bounds = new THREE.Box3().setFromObject(output, true);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 3 / Math.max(size.x, size.y, size.z);
  for (const mesh of output.children) {
    mesh.geometry.translate(-center.x, -center.y, -center.z);
    mesh.geometry.scale(scale, scale, scale);
    if(!mesh.geometry.attributes.uv){const original=mesh.geometry;mesh.geometry=original.index?original.toNonIndexed():original;const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(productUVs(i=>[p.getX(i),p.getY(i),p.getZ(i)],i=>[n.getX(i),n.getY(i),n.getZ(i)],p.count),2));if(original!==mesh.geometry)original.dispose();}
    const original = mesh.geometry;
    mesh.geometry = mergeVertices(original, .000001);
    original.dispose();
  }
  return new GLTFExporter().parseAsync(output, {binary: true, onlyVisible: false, includeCustomExtensions: true});
}
