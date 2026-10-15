const $ = (id) => document.getElementById(id);
const canvas = $('cloud');
const ctx = canvas.getContext('2d', { alpha: false });
const state = {
  data: null, view: 'explorer', mode: 'height', camera: 'perspective',
  yaw: -0.48, pitch: 0.68, zoom: 1, offsetX: 0, offsetY: 0, orbit: false,
  dragging: false, moved: false, dragOrigin: null, running: false,
  seed: 42, groups: 64, neighbors: 32, maskRatio: 0.4, file: null, selectedPatch: 0,
  width: 0, height: 0, pixelRatio: 1, screenPoints: [], hover: -1,
};
const quantized = (n) => Math.round(n).toLocaleString('en-US');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let toastTimer;
function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.remove('hide');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hide'), 3900);
}
function setLoading(active) { $('loading').classList.toggle('hide', !active); $('run-btn').disabled = active; }
function setRangeProgress(input) {
  const percent = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
  input.style.background = `linear-gradient(to right, #d9ff7b ${percent}%, #344855 ${percent}%)`;
}
function initializeRanges() {
  for (const id of ['group-slider', 'neighbor-slider', 'mask-slider']) {
    const el = $(id); setRangeProgress(el);
    el.addEventListener('input', () => {
      setRangeProgress(el);
      if(id === 'group-slider') {$('group-output').textContent = el.value; state.groups = Number(el.value);}
      if(id === 'neighbor-slider') {$('neighbor-output').textContent = el.value; state.neighbors = Number(el.value);}
      if(id === 'mask-slider') {$('mask-output').textContent = `${el.value}%`; state.maskRatio = Number(el.value)/100; draw();}
    });
    if(id !== 'mask-slider') el.addEventListener('change', () => compute());
  }
}
async function compute() {
  if(state.running) return;
  state.running = true; setLoading(true);
  try {
    let response;
    if (state.file) {
      const form = new FormData(); form.append('file', state.file);
      response = await fetch(`/api/scene/upload?groups=${state.groups}&neighbors=${state.neighbors}`, { method:'POST', body:form });
    } else {
      response = await fetch(`/api/scene/demo?seed=${state.seed}&groups=${state.groups}&neighbors=${state.neighbors}`);
    }
    if(!response.ok) {
      const payload = await response.json().catch(()=>({}));
      throw new Error(typeof payload.detail === 'string' ? payload.detail : `Request failed (${response.status})`);
    }
    state.data = await response.json();
    state.selectedPatch = Math.min(state.selectedPatch, state.data.centers.length-1);
    $('stat-points').textContent = quantized(state.data.metrics.point_count);
    $('stat-groups').textContent = quantized(state.data.metrics.patch_count);
    $('stat-neighbors').textContent = quantized(state.data.metrics.neighbors_per_patch);
    $('stat-range').textContent = state.data.metrics.max_range_m;
    $('viewer-source').textContent = state.file ? 'LOCAL UPLOAD' : 'SYNTHETIC SCENE';
    $('scene-name').textContent = state.file ? `FILE / ${state.file.name.slice(0,34).toUpperCase()}` : `SCENE ${String(state.seed).padStart(3,'0')} / PROCEDURAL`;
    $('chart-caption').textContent = state.file ? 'Uploaded point cloud' : 'Seeded procedural geometry';
    renderHistogram(); draw();
  } catch(error) { toast(`Unable to load scene: ${error.message}`); }
  finally { state.running = false; setLoading(false); }
}
function resizeCanvas() {
  const rect = $('canvas-wrap').getBoundingClientRect();
  state.width = rect.width; state.height = rect.height;
  state.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width*state.pixelRatio));
  canvas.height = Math.max(1, Math.round(rect.height*state.pixelRatio));
  ctx.setTransform(state.pixelRatio,0,0,state.pixelRatio,0,0);
  draw();
}
function project(p) {
  const x = p[0], y = p[1], z = p[2];
  const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
  const horiz = cy*x + sy*y;
  const depth = -sy*x + cy*y;
  const sp = Math.sin(state.pitch), cp = Math.cos(state.pitch);
  const vert = depth*sp + z*cp;
  const cameraDistance = Math.max(85, 165 / state.zoom);
  const persp = 1/(1 + depth/cameraDistance*0.27);
  const scale = Math.min(state.width/98, state.height/68)*state.zoom * persp;
  return [state.width*0.5 + horiz*scale + state.offsetX,
          state.height*0.52 - vert*scale + state.offsetY, depth, scale];
}
function line3d(p1,p2,color='#324756',width=0.7){
  const a=project(p1), b=project(p2);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
}
function drawGrid(){
  for(let x=-50;x<=50;x+=10) line3d([x,-40,-1.55],[x,40,-1.55],x===0?'#42636b':'#263c4a',x===0?1:0.6);
  for(let y=-40;y<=40;y+=10) line3d([-50,y,-1.55],[50,y,-1.55],y===0?'#42636b':'#263c4a',y===0?1:0.6);
  line3d([0,0,-2],[0,0,13],'#bbd88288',1.3);
}
function colorForPoint(p,id){
  if(state.mode==='patch'){
    const hue=(id*137.508+54)%360;
    return `hsla(${hue},78%,72%,0.85)`;
  }
  if(state.mode==='distance'){
    const r=Math.hypot(p[0],p[1],p[2]);
    const t=clamp(r/65,0,1);
    return `hsl(${185-t*142},${70+t*12}%,${74-t*15}%)`;
  }
  const t=clamp((p[2]+1.7)/13,0,1);
  return `hsl(${82+t*135},76%,${75-t*13}%)`;
}
function masked(id) {
  if(state.view!=='masking') return false;
  const hash = ((id*1103515245 + 12345) >>> 0) % 10000 / 10000;
  return hash < state.maskRatio;
}
function draw(){
  if(!state.width || !state.height) return;
  ctx.clearRect(0,0,state.width,state.height);
  ctx.fillStyle='#0b1723';ctx.fillRect(0,0,state.width,state.height);
  const gradient=ctx.createRadialGradient(state.width*.53,state.height*.45,8,state.width*.53,state.height*.45,state.width*.68);
  gradient.addColorStop(0,'#192b3d');gradient.addColorStop(.56,'#0e1b2a');gradient.addColorStop(1,'#08121e');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,state.width,state.height);
  // Crosshair and millimeter-style reticle, visual scaffolding only.
  ctx.strokeStyle='#32455488';ctx.lineWidth=.6;
  ctx.beginPath();ctx.arc(state.width/2,state.height/2,Math.min(state.width,state.height)*.31,0,Math.PI*2);ctx.stroke();
  drawGrid();
  if(!state.data) return;
  const points=state.data.points, labels=state.data.patch_ids;
  const screenPoints=new Array(points.length);
  for(let i=0;i<points.length;i++){
    const p=points[i], id=labels[i], pos=project(p);
    screenPoints[i]=pos;
    if(pos[0] < -8 || pos[0] > state.width+8 || pos[1] < -8 || pos[1] > state.height+8)continue;
    const hidden=masked(id);
    if(hidden){ctx.fillStyle='#58738c25';ctx.fillRect(pos[0],pos[1],1.1,1.1);continue;}
    if(state.view==='patches' && id!==state.selectedPatch){ctx.fillStyle='#637b8875';ctx.fillRect(pos[0],pos[1],1.15,1.15);continue;}
    ctx.fillStyle=colorForPoint(p,id);
    const size=state.mode==='patch'?2:1.6;
    ctx.fillRect(pos[0],pos[1],size,size);
  }
  state.screenPoints=screenPoints;
  if(state.view==='patches'){
    const chosen=state.data.centers[state.selectedPatch];
    if(chosen){const pos=project(chosen);ctx.strokeStyle='#d9ff7b';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(pos[0],pos[1],10,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#d9ff7b88';ctx.beginPath();ctx.arc(pos[0],pos[1],21,0,Math.PI*2);ctx.stroke();
      ctx.font='10px monospace';ctx.fillStyle='#d9ff7b';ctx.fillText(`PATCH #${state.selectedPatch}`,pos[0]+23,pos[1]-8);}
  } else {
    ctx.strokeStyle='#c3a8ff';ctx.lineWidth=1.4;
    for(const p of state.data.centers){const pos=project(p);ctx.beginPath();ctx.moveTo(pos[0]-2,pos[1]);ctx.lineTo(pos[0]+2,pos[1]);ctx.moveTo(pos[0],pos[1]-2);ctx.lineTo(pos[0],pos[1]+2);ctx.stroke();}
  }
  $('azimuth-label').textContent = `AZ ${state.yaw >= 0?'+':''}${String(Math.round(state.yaw*180/Math.PI)).padStart(3,'0')}°`;
}
let pointerStart;
canvas.addEventListener('pointerdown',(e)=>{state.dragging=true;state.moved=false;pointerStart=[e.clientX,e.clientY,state.yaw,state.pitch];canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',(e)=>{
  if(state.dragging && pointerStart){
    let dx=e.clientX-pointerStart[0],dy=e.clientY-pointerStart[1];
    if(Math.abs(dx)+Math.abs(dy)>2) state.moved=true;
    state.yaw=pointerStart[2]+dx*.008;state.pitch=clamp(pointerStart[3]+dy*.006,-1.35,1.52);
    state.orbit=false;$('orbit-btn').classList.remove('active');draw();return;
  }
  const bounds=canvas.getBoundingClientRect(), mx=e.clientX-bounds.left,my=e.clientY-bounds.top;
  if(!state.screenPoints?.length || state.view!=='patches'){ $('canvas-tooltip').classList.add('hide');return; }
  let chosen=-1, distance=100;
  for(let i=0;i<state.screenPoints.length;i+=3){let p=state.screenPoints[i],d=(p[0]-mx)**2+(p[1]-my)**2;if(d<distance){distance=d;chosen=i;}}
  if(chosen!==-1){let pt=state.data.points[chosen];let tooltip=$('canvas-tooltip');tooltip.innerHTML=`RETURN ${chosen}<br>X ${pt[0].toFixed(1)}m &nbsp; Y ${pt[1].toFixed(1)}m<br>Z ${pt[2].toFixed(1)}m &nbsp; PATCH ${state.data.patch_ids[chosen]}`;
    tooltip.style.left=Math.min(mx+18,bounds.width-205)+'px';tooltip.style.top=Math.min(my+20,bounds.height-85)+'px';tooltip.classList.remove('hide');state.hover=chosen;
  }else $('canvas-tooltip').classList.add('hide');
});
canvas.addEventListener('pointerup',()=>{if(!state.moved && state.hover>=0 && state.view==='patches' && state.data){state.selectedPatch=state.data.patch_ids[state.hover];draw();}state.dragging=false;});
canvas.addEventListener('pointercancel',()=>{state.dragging=false});
canvas.addEventListener('pointerleave',()=>{$('canvas-tooltip').classList.add('hide');});
canvas.addEventListener('wheel',(e)=>{e.preventDefault();state.zoom=clamp(state.zoom*Math.exp(-e.deltaY*.001),.45,4.2);draw();},{passive:false});
canvas.addEventListener('dblclick',resetCamera);
function resetCamera(){state.camera='perspective';state.yaw=-.48;state.pitch=.68;state.zoom=1;state.offsetX=0;state.offsetY=0;state.orbit=false;$('orbit-btn').classList.remove('active');document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera==='perspective'));$('camera-label').textContent='PERSPECTIVE · FREE ORBIT';draw();}
function setCamera(mode){state.camera=mode;if(mode==='top'){state.yaw=0;state.pitch=1.52;}else if(mode==='side'){state.yaw=0;state.pitch=0.08;}else{state.yaw=-.48;state.pitch=.68;}document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===mode));$('camera-label').textContent=mode.toUpperCase()+' · FREE ORBIT';draw();}
function renderHistogram(){
  if(!state.data)return;
  const bins=Array(28).fill(0);
  for(const p of state.data.points){let d=Math.hypot(...p);bins[Math.min(27,Math.floor(d/65*28))]++;}
  const max=Math.max(...bins,1);
  $('histogram').replaceChildren(...bins.map((n)=>{let el=document.createElement('div');el.style.height=`${Math.max(3,Math.round(n/max*90))}%`;el.title=`${n} points`;return el;}));
}
function showView(view){
  state.view=view;
  const titles={explorer:['3D Explorer','See what <em>machines see.</em>','A playground for point clouds, geometric tokenization, and the building blocks of 3D machine intelligence.'],patches:['Patch inspector','Geometry, <em>under the surface.</em>','Explore local point neighborhoods. Click a point to isolate its geometric patch.'],masking:['Masking studio','Learn by <em>hiding.</em>','Explore masked point modeling concepts. This visualizes a simulated mask—not model inference.'],benchmark:['Benchmark lab','Measure the <em>difference.</em>','Explore geometric coverage of FPS and random sampling on the same seeded scene.'],research:['Research archive','Built in <em>the open.</em>','Explore the notebooks, their provenance and the reproducible experiment roadmap.']};
  $('crumb').textContent=titles[view][0];$('page-title').innerHTML=titles[view][1];$('page-desc').textContent=titles[view][2];
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));
  $('research-panel').classList.toggle('hide',view!=='research');$('benchmark-panel').classList.toggle('hide',view!=='benchmark');$('workspace').classList.toggle('hide',view==='research'||view==='benchmark');
  $('masked-legend').classList.toggle('hide',view!=='masking');
  if(view==='patches') {state.mode='patch';$('scene-name').textContent = `INSPECTOR / PATCH ${state.selectedPatch}`;}
  if(view==='masking') state.mode='patch';
  document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===state.mode));
  if(view!=='research'&&view!=='benchmark') {requestAnimationFrame(()=>{resizeCanvas();draw();});}
}
$('run-btn').addEventListener('click',compute);
$('bench-run').addEventListener('click', async ()=>{
 const b=$('bench-run');b.disabled=true;b.textContent='Computing comparison...';
 try{
   const r=await fetch(`/api/benchmark/demo?seed=${state.seed}&groups=${state.groups}`);
   if(!r.ok)throw new Error(`Benchmark returned ${r.status}`);
   const d=await r.json();
   const names=[['mean_m','MEAN DISTANCE'],['p95_m','95TH PERCENTILE'],['max_m','WORST-CASE COVERAGE']];
   $('bench-results').replaceChildren(...names.map(([key,name])=>{
     const fps=d.methods.fps[key],rand=d.methods.random[key], max=Math.max(fps,rand,.01);
     const block=document.createElement('div');block.className='bench-metric';
     const label=document.createElement('span');label.textContent=name;
     const numbers=document.createElement('div');numbers.className='bench-numbers';
     numbers.innerHTML=`<div><b>${fps.toFixed(2)} m</b><small>FARTHEST POINT</small></div><div><b>${rand.toFixed(2)} m</b><small>RANDOM</small></div>`;
     const bars=document.createElement('div');bars.className='bench-metric-bar';
     const barA=document.createElement('span');barA.style.width=`${fps/max*45}%`;
     const barB=document.createElement('span');barB.style.width=`${rand/max*45}%`;
     bars.append(barA,barB);
     const note=document.createElement('div');note.className='bench-metric-note';note.textContent=`${d.num_centers} centers · ${d.dataset_points.toLocaleString()} synthetic points · seed ${d.seed}`;
     block.append(label,numbers,bars,note);return block;
   }));
   toast('Reference geometric coverage computed.');
 }catch(error){toast(`Benchmark unavailable: ${error.message}`)}
 finally{b.disabled=false;b.textContent='↻  Run comparison  ↗'}
});
$('synthetic-btn').addEventListener('click',()=>{state.file=null;state.seed=(state.seed+1)%100000;$('synthetic-btn').classList.add('active');$('upload-btn').classList.remove('active');compute();});
$('upload-btn').addEventListener('click',()=>$('file-input').click());
$('file-input').addEventListener('change',(e)=>{const f=e.target.files[0];if(!f)return;if(f.size>4*1024*1024){toast('Files must be 4 MB or smaller.');return;}state.file=f;$('upload-btn').classList.add('active');$('synthetic-btn').classList.remove('active');compute();});
$('reset-btn').addEventListener('click',resetCamera);
$('orbit-btn').addEventListener('click',()=>{state.orbit=!state.orbit;$('orbit-btn').classList.toggle('active',state.orbit);});
$('capture-btn').addEventListener('click',()=>{draw();const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download=`pointlab-${state.view}-${Date.now()}.png`;link.click();toast('High-resolution point-cloud image saved.');});
$('shortcuts-btn').addEventListener('click',()=>$('shortcuts').showModal());
$('close-dialog').addEventListener('click',()=>$('shortcuts').close());
for(const b of document.querySelectorAll('[data-view]')) b.addEventListener('click',()=>showView(b.dataset.view));
for(const b of document.querySelectorAll('[data-color]')) b.addEventListener('click',()=>{state.mode=b.dataset.color;document.querySelectorAll('[data-color]').forEach(x=>x.classList.toggle('active',x===b));draw();});
for(const b of document.querySelectorAll('[data-camera]')) b.addEventListener('click',()=>setCamera(b.dataset.camera));
document.addEventListener('keydown',(e)=>{if(e.target.matches('input,textarea,dialog')||$('shortcuts').open)return;const k=e.key.toLowerCase();if(k==='r')resetCamera();if(k==='o')$('orbit-btn').click();if(k==='s')$('capture-btn').click();if(k==='?')$('shortcuts').showModal();if(state.view==='patches'&&state.data&&['arrowleft','arrowright'].includes(k)){state.selectedPatch=clamp(state.selectedPatch+(k==='arrowright'?1:-1),0,state.data.centers.length-1);draw();}});
let lastFrame=0;
function animate(t){if(state.orbit && t-lastFrame>30){state.yaw+=.004;draw();lastFrame=t;}requestAnimationFrame(animate);}requestAnimationFrame(animate);
initializeRanges();new ResizeObserver(resizeCanvas).observe($('canvas-wrap'));resizeCanvas();compute();
