/**
 * GitHub Pages adapter. Runs the reference geometry fully in-browser.
 * It operates on a fixed, synthetic 5,999-point scene generated from seed 42.
 * Original FastAPI server still handles real .npy/.bin uploads in the local application.
 * No external network or user-data tracking is used.
 */
(function(){
  'use strict';
  const scene=window.__POINTLAB_STATIC_POINTS;
  if(!Array.isArray(scene)) throw new Error('Static scene was not loaded.');
  const dist2=(a,b)=>{const x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return x*x+y*y+z*z;};
  function random01(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  function fps(points,n,seed){
    let current=Math.floor(random01(seed)()*points.length);
    let d=new Float64Array(points.length).fill(Infinity),used=new Uint8Array(points.length),selected=[];
    for(let g=0;g<n;g++){
      selected.push(current);used[current]=1;
      for(let i=0;i<points.length;i++){const v=dist2(points[i],points[current]);if(v<d[i])d[i]=v;}
      let best=-1;
      for(let i=0;i<points.length;i++)if(!used[i]&&d[i]>best){best=d[i];current=i;}
    }
    return selected;
  }
  function random(points,n,seed){
    const rng=random01(seed),ids=Array.from({length:points.length},(_,i)=>i);
    for(let i=0;i<n;i++){const j=i+Math.floor(rng()*(points.length-i));[ids[i],ids[j]]=[ids[j],ids[i]];}
    return ids.slice(0,n);
  }
  function assign(points,centers){const label=[];for(const p of points){let d=Infinity,idx=0;for(let i=0;i<centers.length;i++){const v=dist2(p,centers[i]);if(v<d){d=v;idx=i;}}label.push(idx);}return label;}
  function distanceStats(points,centers){const arr=points.map(p=>Math.sqrt(Math.min(...centers.map(c=>dist2(p,c))))).sort((a,b)=>a-b);const mean=arr.reduce((a,b)=>a+b,0)/arr.length;return {mean_m:+mean.toFixed(4),p95_m:+arr[Math.ceil(.95*arr.length)-1].toFixed(4),max_m:+arr[arr.length-1].toFixed(4)};}
  function shape(groups,neighbors,seed){
    const ids=fps(scene,groups,seed),centers=ids.map(i=>scene[i]),labels=assign(scene,centers),ranges=scene.map(p=>Math.hypot(...p));
    const extent=[0,1,2].map(a=>+(Math.max(...scene.map(x=>x[a]))-Math.min(...scene.map(x=>x[a]))).toFixed(2));
    return {source:'synthetic_demo',mode:'geometric_patches_not_learned_tokens',points:scene,patch_ids:labels,centers,center_indices:ids,
      metrics:{point_count:scene.length,patch_count:groups,neighbors_per_patch:neighbors,spatial_extent_m:extent,mean_range_m:+(ranges.reduce((a,b)=>a+b,0)/ranges.length).toFixed(2),max_range_m:+Math.max(...ranges).toFixed(2),unique_patch_assignments:new Set(labels).size},
      note:'Browser-only reference. Fixed synthetic scene, sampled with chosen seed; no learned codebook.'};
  }
  function benchmark(groups,seed){const fpsCenters=fps(scene,groups,seed).map(i=>scene[i]),randomCenters=random(scene,groups,seed).map(i=>scene[i]);return {
    source:'synthetic_demo',dataset_points:scene.length,num_centers:groups,seed,
    metric:'distance_to_nearest_sampled_center_in_meters',lower_is_better:true,
    methods:{fps:distanceStats(scene,fpsCenters),random:distanceStats(scene,randomCenters)},
    note:'Browser-only sampling coverage of a fixed procedural 3D scene; not ML performance.'};}
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,options){
    if(typeof input!=='string'||!input.startsWith('/api/'))return originalFetch(input,options);
    try{
      const u=new URL(input,'https://pointlab.invalid');const seed=Number(u.searchParams.get('seed')??42),groups=Number(u.searchParams.get('groups')??64),neighbors=Number(u.searchParams.get('neighbors')??32);
      if(!Number.isInteger(groups)||groups<4||groups>256||!Number.isInteger(neighbors)||neighbors<4||neighbors>128||!Number.isInteger(seed)||seed<0||seed>100000)return new Response(JSON.stringify({detail:'Out-of-range query parameter'}),{status:422});
      if(u.pathname==='/api/scene/upload')return new Response(JSON.stringify({detail:'Upload is available in the self-hosted FastAPI app. This public static demo does not send files to any server.'}),{status:501});
      let payload;
      if(u.pathname==='/api/scene/demo')payload=shape(groups,neighbors,seed);
      else if(u.pathname==='/api/benchmark/demo')payload=benchmark(groups,seed);
      else return new Response(JSON.stringify({detail:'Not found'}),{status:404});
      return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
    }catch(err){return new Response(JSON.stringify({detail:String(err)}),{status:422});}
  };
  window.__POINTLAB_STATIC_MODE=true;
})();
