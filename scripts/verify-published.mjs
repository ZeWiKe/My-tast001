import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'_site');
const manifest=JSON.parse(await fs.readFile(path.join(root,'snapshot-manifest.json'),'utf8'));
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
assert.equal(catalog.products.length,manifest.models);
assert.equal(catalog.products.reduce((n,p)=>n+p.gallery.length,0),manifest.images);
for(const item of manifest.files){
  const file=path.resolve(root,'.'+item.path);assert.ok(file.startsWith(root+path.sep));
  const bytes=await fs.readFile(file);assert.equal(bytes.length,item.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.path);
}
const html=await fs.readFile(path.join(root,'index.html'),'utf8');assert.ok(html.includes('app.js?v=16'));
const app=await fs.readFile(path.join(root,'app.js'),'utf8');assert.ok(app.includes("fetch(new URL('./catalog.json',document.baseURI)"));assert.ok(app.includes('p.model=assetURL(p.model)'));assert.ok(app.includes('addCard(assetURL(image.src)'));
console.log(`Static artifact verified: ${manifest.models} models, ${manifest.images} images, all product asset checksums match.`);
