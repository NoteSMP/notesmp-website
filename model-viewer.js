/* NoteSMP Minecraft model previewer.
 * Reads vanilla Java block/item model JSON and textures from the versioned resource repository.
 * Parent chains, element cuboids, face texture references and UVs are supported.
 */
const MC_ASSET_ROOT = 'https://raw.githubusercontent.com/NoteSMP/notesmp-ressources/main/versions/26.3-0.20.1/assets/minecraft/';
const MODEL_CDN = 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const mcModelViewer = {
  async start() {
    const host = document.querySelector('#model-viewer');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.innerHTML = `
      <section class="panel mc-model-panel">
        <div class="panel-heading"><div><span class="overline">RESOURCE PREVIEW</span><h2>3D Minecraft model viewer</h2></div></div>
        <div class="mc-model-controls">
          <input id="mc-model-id" aria-label="Minecraft item or block ID" value="minecraft:oak_planks" placeholder="minecraft:stone">
          <button class="button-primary" id="mc-model-load" type="button">Render model</button>
        </div>
        <div class="mc-model-stage" id="mc-model-stage" aria-label="Interactive 3D model preview"></div>
        <p class="mc-model-help" id="mc-model-message">Enter a block or item ID. Drag to rotate; scroll to zoom. This preview resolves JSON model parents and textures from the NoteSMP resource repository.</p>
      </section>`;
    const load = async () => {
      const id = document.querySelector('#mc-model-id').value.trim().replace(/^minecraft:/, '');
      if (!/^[a-z0-9_./-]+$/.test(id)) { this.message('Use a valid Minecraft resource ID.'); return; }
      try { await this.renderModel(id); }
      catch (error) { this.message(`Could not render “${id}”. Check that its model is present in the versioned assets. ${error.message || ''}`); }
    };
    document.querySelector('#mc-model-load').addEventListener('click', load);
    document.querySelector('#mc-model-id').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    await load();
  },
  message(text) { const node = document.querySelector('#mc-model-message'); if (node) node.textContent = text; },
  async json(path) {
    const response = await fetch(MC_ASSET_ROOT + path);
    if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${path}`);
    return response.json();
  },
  async resolveModel(path, seen = new Set()) {
    if (seen.has(path)) throw new Error('Model parent loop.');
    seen.add(path);
    const model = await this.json(path);
    if (!model.parent) return model;
    const parentPath = model.parent.startsWith('minecraft:') ? model.parent.slice(10) : model.parent;
    const parent = await this.resolveModel(`models/${parentPath}.json`, seen);
    return { ...parent, ...model, textures: { ...(parent.textures || {}), ...(model.textures || {}) }, elements: model.elements || parent.elements };
  },
  async renderModel(id) {
    const THREE = await import(MODEL_CDN);
    const stage = document.querySelector('#mc-model-stage');
    stage.replaceChildren();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101812');
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(24, 20, 28);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(15, 25, 12); scene.add(sun);
    const model = await this.resolveModel(`models/item/${id}.json`);
    if (!model.elements?.length) {
      const block = await this.resolveModel(`models/block/${id}.json`);
      model.elements = block.elements;
      model.textures = { ...(model.textures || {}), ...(block.textures || {}) };
    }
    if (!model.elements?.length) throw new Error('This model has no cuboid elements (generated/flat models are not supported yet).');
    const textureCache = new Map();
    const textureFor = async key => {
      if (textureCache.has(key)) return textureCache.get(key);
      let ref = model.textures?.[key] || key;
      const seen = new Set();
      while (ref.startsWith('#') && !seen.has(ref)) { seen.add(ref); ref = model.textures?.[ref.slice(1)] || 'missingno'; }
      if (ref.startsWith('minecraft:')) ref = ref.slice(10);
      const path = `textures/${ref}.png`;
      const texture = await new Promise((resolve, reject) => new THREE.TextureLoader().load(MC_ASSET_ROOT + path, resolve, undefined, reject));
      texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
      textureCache.set(key, texture); return texture;
    };
    const root = new THREE.Group();
    for (const element of model.elements) {
      const from = element.from || [0,0,0], to = element.to || [16,16,16];
      const geometry = new THREE.BoxGeometry((to[0]-from[0])/8, (to[1]-from[1])/8, (to[2]-from[2])/8);
      const mats = [];
      for (const face of ['right','left','top','bottom','front','back']) {
        const faceData = element.faces?.[face];
        if (!faceData) { mats.push(new THREE.MeshStandardMaterial({ color: '#7b837c', transparent:true, opacity:0 })); continue; }
        const texture = await textureFor(faceData.texture);
        const mat = new THREE.MeshStandardMaterial({ map: texture, transparent:true, alphaTest:.08, roughness:1 });
        mats.push(mat);
      }
      const mesh = new THREE.Mesh(geometry, mats);
      mesh.position.set((from[0]+to[0]-16)/8, (from[1]+to[1]-16)/8, (from[2]+to[2]-16)/8);
      if (element.rotation) {
        const origin = element.rotation.origin.map(v => (v-8)/8);
        mesh.position.sub(new THREE.Vector3(...origin));
        const axis = element.rotation.axis === 'x' ? 'x' : element.rotation.axis === 'y' ? 'y' : 'z';
        mesh.rotation[axis] = THREE.MathUtils.degToRad(element.rotation.angle);
        mesh.position.add(new THREE.Vector3(...origin));
      }
      root.add(mesh);
    }
    scene.add(root);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3()).length();
    camera.position.set(size*.9, size*.75, size*1.1); camera.lookAt(0,0,0);
    const resize = () => { const w=stage.clientWidth,h=stage.clientHeight; if(!w||!h)return; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(stage); resize();
    let dragging=false,lastX=0,lastY=0;
    renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
    renderer.domElement.addEventListener('pointerup',()=>dragging=false);
    renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;root.rotation.y+=(e.clientX-lastX)*.01;root.rotation.x+=(e.clientY-lastY)*.01;lastX=e.clientX;lastY=e.clientY;});
    renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.position.multiplyScalar(e.deltaY>0?1.08:.92);},{passive:false});
    const animate=()=>{if(!stage.isConnected){observer.disconnect();renderer.dispose();return;}renderer.render(scene,camera);requestAnimationFrame(animate);}; animate();
    this.message(`Loaded minecraft:${id}. Drag to rotate; scroll to zoom.`);
  }
};
window.addEventListener('notesmp:render', () => mcModelViewer.start());
document.addEventListener('DOMContentLoaded', () => mcModelViewer.start());
