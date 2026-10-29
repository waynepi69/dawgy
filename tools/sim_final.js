const fs=require('fs');const d='/workspace/dawgy/src/';
eval(fs.readFileSync(d+'data_quiz.js','utf8').replace(/const /g,'var ')+fs.readFileSync(d+'data_dogs.js','utf8').replace('const DOGS','var DOGS'));
const KEYS=Object.keys(DOGS),ST=1.6;
let s=987654321;const rnd=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
function vec(ans){const sum={},c={};DIMS.forEach(x=>{sum[x.k]=0;c[x.k]=0});QUIZ.forEach((q,i)=>{sum[q.d]+=q.o[ans[i]][1];c[q.d]+=2});return DIMS.map(x=>Math.max(0,Math.min(1,.5+(sum[x.k]/c[x.k]-.5)*ST)))}
function cls(v){let b=null,bd=9;KEYS.forEach(k=>{let t=0;DOGS[k].p.forEach((p,i)=>t+=(p-v[i])**2);if(t<bd){bd=t;b=k}});return b}
function run(mode,N=20000,noise){const cnt={};KEYS.forEach(k=>cnt[k]=0);
 for(let n=0;n<N;n++){const lat=DIMS.map(()=>{let l=rnd();if(rnd()<.35)l=l<.5?l*.4:1-(1-l)*.4;return l});
  const ans=QUIZ.map(q=>{if(mode==='u')return Math.floor(rnd()*q.o.length);const t=2*lat[DIMS.findIndex(x=>x.k===q.d)]+(rnd()*2-1)*noise;let b=0,bd=9;q.o.forEach(([_,sc],i)=>{if(Math.abs(sc-t)<bd){bd=Math.abs(sc-t);b=i}});return b});
  cnt[cls(vec(ans))]++}
 const pc=KEYS.map(k=>cnt[k]/N*100);console.log(mode,noise||'',KEYS.map((k,i)=>k+':'+pc[i].toFixed(1)).join(' '),'min',Math.min(...pc).toFixed(1),'max',Math.max(...pc).toFixed(1))}
run('l',20000,.8);run('l',20000,1.1);run('u',20000);
