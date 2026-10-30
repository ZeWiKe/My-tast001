export const DEFAULT_VIEW=Object.freeze({yaw:0,pitch:0,roll:0,distance:9.35,modelYaw:0,modelPitch:0});
const bounds={yaw:[-180,180],pitch:[-80,80],roll:[-180,180],distance:[4.9,12],modelYaw:[-180,180],modelPitch:[-180,180]};
export function normalizeView(input={}){
  const result={};for(const [key,[min,max]]of Object.entries(bounds)){
    const raw=input?.[key];const n=raw===null||raw===undefined||raw===''?NaN:Number(raw);
    result[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):DEFAULT_VIEW[key];
  }return result;
}
export function cameraPositionForView(input){const v=normalizeView(input),yaw=v.yaw*Math.PI/180,pitch=v.pitch*Math.PI/180;
  return{x:v.distance*Math.sin(yaw)*Math.cos(pitch),y:v.distance*Math.sin(pitch),z:v.distance*Math.cos(yaw)*Math.cos(pitch)};
}
export function viewFromCamera(position,roll=0){const distance=Math.hypot(position.x,position.y,position.z);return normalizeView({yaw:Math.atan2(position.x,position.z)*180/Math.PI,pitch:Math.atan2(position.y,Math.hypot(position.x,position.z))*180/Math.PI,roll,distance});}
