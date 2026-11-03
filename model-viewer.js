const ROOT='https://raw.githubusercontent.com/NoteSMP/notesmp-ressources/main/versions/26.3-0.20.1/assets/minecraft/';
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
const viewer={
 async start(){const host=document.querySelector('#model-viewer');if(!host||host.dataset.ready)return;host.dataset.ready='1';
 host.innerHTML='<section class="panel mc-model-panel"><div class="panel-heading"><div><span class="overline">RESOURCE PREVIEW</span><h2>3D Minecraft model viewer</h2></div></div><div class="mc-model-controls"><input id="mc-model-id" aria-label="Minecraft item or block ID" value="minecraft:oak_planks" placeholder="minecraft:stone"><button class="button-primary" id="mc-model-load" type="button">Render model</button></div><div id="mc-model-icon" class="mc-model-icon"></div><div class="mc-model-stage" id="mc-model-stage"></div><p class="mc-model-help" id="mc-model-message">Enter a block or item ID. Drag to rotate; scroll to zoom.</p></section>';
 const load=()=>{const id=document.querySelector('#mc-model-id').value.trim().replace(/^minecraft:/,'');if(!/^[a-z0-9_./-]+$/.test(id)){this.message('Invalid Minecraft resource ID.');return;}this.render(id).catch(e=>this.message('Could not render '+id+': '+e.message));};
 document.querySelector('#mc-model-load').addEventListener('click',load);document.querySelector('#mc-model-id').addEventListener('keydown',e=>{if(e.key==='Enter')load();});load();},
 message(s){const n=document.querySelector('#mc-model-message');if(n)n.textContent=s;},
 async json(path){const r=await fetch(ROOT+path);if(!r.ok)throw Error('Missing asset '+path);return r.json();},
 async model(path,seen=new Set()){if(seen.has(path))throw Error('Model parent cycle');seen.add(path);const m=await this.json(path);if(!m.parent)return m;const p=m.parent.replace(/^minecraft:/,'');const par=await this.model('models/'+p+'.json',seen);return {...par,...m,textures:{...(par.textures||{}),...(m.textures||{})},elements:m.elements||par.elements};},
 async renderEntity(T,id,scene){
 const name=id.toLowerCase().replace(/^minecraft:/,'');
 if(name!=='chicken'&&name!=='chicken_spawn_egg')return false;
 const g=new T.Group();
 const mat=(color)=>new T.MeshStandardMaterial({color,roughness:1});
 const white=mat('#f4f0df'), red=mat('#c83e3e'), yellow=mat('#e6b52d'), black=mat('#25231f');
 const box=(w,h,d,x,y,z,material)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);g.add(mesh);return mesh;};
 // Minecraft chicken proportions, centered around the origin; each body part remains independently visible.
 box(.72,.62,.82,0,.05,0,white);                 // body
 box(.38,.38,.38,0,.52,-.37,white);              // head
 box(.23,.12,.24,0,.43,-.62,yellow);             // beak
 box(.13,.16,.12,0,.28,-.57,red);                // wattle
 box(.20,.12,.12,0,.76,-.37,red);                // comb
 box(.08,.08,.04,-.10,.56,-.57,black);           // left eye
 box(.08,.08,.04,.10,.56,-.57,black);            // right eye
 box(.10,.42,.10,-.20,-.48,0,yellow);            // legs
 box(.10,.42,.10,.20,-.48,0,yellow);
 box(.44,.12,.48,0,.36,.48,white);               // tail
 // Attach the vanilla chicken texture as a subtle body overlay when it exists.
 try{const tx=await new Promise((ok,no)=>new T.TextureLoader().load(ROOT+'textures/entity/chicken.png',ok,undefined,no));tx.colorSpace=T.SRGBColorSpace;tx.magFilter=T.NearestFilter;tx.minFilter=T.NearestFilter;const body=g.children[0];body.material=new T.MeshStandardMaterial({map:tx,roughness:1});}catch(_){}
 scene.add(g);return g;
 },
 async resolve(id){
 // New-format item definitions point at model files; they are not themselves geometry.
 try{const d=await this.json('items/'+id+'.json');const n=d.model||d;let ref=n.model||n.fallback;if(typeof ref==='string'){ref=ref.replace(/^minecraft:/,'');const m=await this.model('models/'+ref+'.json');if(m.elements?.length)return m;}}catch(_){}
 // Picked-up blocks commonly use models/block and may not have item model files.
 try{const m=await this.model('models/item/'+id+'.json');if(m.elements?.length)return m;}catch(_){}
 return this.model('models/block/'+id+'.json');
 },
 async render(id){const T=await import(THREE_URL),stage=document.querySelector('#mc-model-stage');stage.replaceChildren();document.querySelector('#mc-model-icon').replaceChildren();
 const scene=new T.Scene();scene.background=new T.Color('#101812');const cam=new T.PerspectiveCamera(34,1,.1,100);const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;stage.appendChild(renderer.domElement);scene.add(new T.AmbientLight(0xffffff,2.1));const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(15,25,12);scene.add(light);
 const entity=await this.renderEntity(T,id,scene);if(entity){const bounds=new T.Box3().setFromObject(entity),size=Math.max(bounds.getSize(new T.Vector3()).length(),1);cam.position.set(size*.9,size*.75,size*1.1);cam.lookAt(0,0,0);const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();};const obs=new ResizeObserver(resize);obs.observe(stage);resize();let drag=false,x=0,y=0;renderer.domElement.addEventListener('pointerdown',e=>{drag=true;x=e.clientX;y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;entity.rotation.y+=(e.clientX-x)*.01;entity.rotation.x+=(e.clientY-y)*.01;x=e.clientX;y=e.clientY;});renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();cam.position.multiplyScalar(e.deltaY>0?1.08:.92);},{passive:false});const animate=()=>{if(!stage.isConnected){obs.disconnect();renderer.dispose();return;}renderer.render(scene,cam);requestAnimationFrame(animate);};animate();this.message('Rendered chicken entity preview for '+id+'.');return;}\n const m=await this.resolve(id),cache=new Map();const texture=async ref=>{const seen=new Set();while(ref&&ref[0]==='#'&&!seen.has(ref)){seen.add(ref);ref=m.textures?.[ref.slice(1)]||'missingno';}ref=(ref||'missingno').replace(/^minecraft:/,'');const path='textures/'+ref+'.png';if(cache.has(path))return cache.get(path);const t=await new Promise((ok,no)=>new T.TextureLoader().load(ROOT+path,ok,undefined,no));t.colorSpace=T.SRGBColorSpace;t.magFilter=T.NearestFilter;t.minFilter=T.NearestFilter;cache.set(path,t);return t;};
 const iconRef=m.textures?.layer0||m.textures?.particle||Object.values(m.textures||{}).find(v=>typeof v==='string'&&!v.startsWith('#'));if(iconRef){try{const t=await texture(iconRef),img=document.createElement('img');img.src=t.image.src;img.alt=id+' texture icon';img.width=64;img.height=64;img.style.imageRendering='pixelated';document.querySelector('#mc-model-icon').appendChild(img);}catch(_){}}
 if(!m.elements?.length)throw Error('No cuboid model geometry. Flat/generated item models and mob entity geometry need separate rendering support.');
 const root=new T.Group();for(const el of m.elements){const f=el.from||[0,0,0],to=el.to||[16,16,16],geo=new T.BoxGeometry((to[0]-f[0])/8,(to[1]-f[1])/8,(to[2]-f[2])/8),mats=[];
 for(const side of ['east','west','up','down','south','north']){const face=el.faces?.[side];if(!face){mats.push(new T.MeshStandardMaterial({transparent:true,opacity:0}));continue;}mats.push(new T.MeshStandardMaterial({map:await texture(face.texture),transparent:true,alphaTest:.08,roughness:1}));}
 const mesh=new T.Mesh(geo,mats);mesh.position.set((f[0]+to[0]-16)/8,(f[1]+to[1]-16)/8,(f[2]+to[2]-16)/8);root.add(mesh);}
 scene.add(root);const bounds=new T.Box3().setFromObject(root),size=Math.max(bounds.getSize(new T.Vector3()).length(),1);cam.position.set(size*.9,size*.75,size*1.1);cam.lookAt(0,0,0);
 const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();};const obs=new ResizeObserver(resize);obs.observe(stage);resize();let drag=false,x=0,y=0;renderer.domElement.addEventListener('pointerdown',e=>{drag=true;x=e.clientX;y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;root.rotation.y+=(e.clientX-x)*.01;root.rotation.x+=(e.clientY-y)*.01;x=e.clientX;y=e.clientY;});renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();cam.position.multiplyScalar(e.deltaY>0?1.08:.92);},{passive:false});
 const animate=()=>{if(!stage.isConnected){obs.disconnect();renderer.dispose();return;}renderer.render(scene,cam);requestAnimationFrame(animate);};animate();this.message('Loaded '+id+' model and texture icon. Spawn eggs are item models; mob entity geometry is separate.');}
};
window.addEventListener('notesmp:render',()=>viewer.start());document.addEventListener('DOMContentLoaded',()=>viewer.start());