const fs=require('fs');
eval(fs.readFileSync('/workspace/dawgy/src/data_quiz.js','utf8')+';global.QUIZ=QUIZ;global.DIMS=DIMS');
const D=DIMS.map(d=>d.k);
const names=['husky','shiba','golden','corgi','border','teddy','frenchie','samoyed','pom','lab','akita','gsd'];
let P0={
husky:[.85,.75,.2,.85,.4,.6,.9,.7],
shiba:[.4,.2,.55,.95,.25,.6,.5,.5],
golden:[.6,.95,.6,.1,.8,.55,.4,.85],
corgi:[.7,.8,.45,.65,.55,.85,.7,.7],
border:[.95,.5,.95,.55,.5,.2,.4,.15],
teddy:[.55,.45,.8,.45,.8,.4,.85,.35],
frenchie:[.05,.65,.1,.6,.7,.75,.55,.8],
samoyed:[.45,.85,.2,.2,.7,.5,.3,.75],
pom:[.75,.3,.55,.85,.75,.3,.95,.25],
lab:[.8,.85,.1,.1,.55,.98,.4,.8],
akita:[.35,.1,.55,.7,.5,.3,.1,.85],
gsd:[.6,.1,.9,.15,.45,.25,.15,.9]};
if(fs.existsSync('/workspace/tools/p8.json')&&process.argv[3]==='cont')P0=JSON.parse(fs.readFileSync('/workspace/tools/p8.json'));
const STRETCH=parseFloat(process.argv[2]||1.4);
let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
function person(){ // latent per dim: mix of uniform and 'extremes'
  return D.map(()=>{const u=rnd();return rnd()<.35?(u<.5?u*.6:1-(1-u)*.6):u;});
}
function answer(l,noise){const v=Array(8).fill(0),c=Array(8).fill(0);
  QUIZ.forEach(q=>{const di=D.indexOf(q.d);const t=2*l[di]+(rnd()*2-1)*noise;let best=0,bd=9;q.o.forEach((o,i)=>{const dd=Math.abs(o[1]-t);if(dd<bd){bd=dd;best=i;}});v[di]+=q.o[best][1];c[di]+=2;});
  return v.map((x,i)=>Math.max(0,Math.min(1,.5+(x/c[i]-.5)*STRETCH)));}
const N=20000;const people=[];for(let i=0;i<N;i++)people.push(answer(person(),.8));
function uniformPeople(){const r=[];for(let i=0;i<N;i++){const v=Array(8).fill(0),c=Array(8).fill(0);QUIZ.forEach(q=>{const di=D.indexOf(q.d);v[di]+=q.o[Math.floor(rnd()*q.o.length)][1];c[di]+=2;});r.push(v.map((x,i)=>Math.max(0,Math.min(1,.5+(x/c[i]-.5)*STRETCH))));}return r;}
const uni=uniformPeople();
function dist(P,pp){const cnt={};names.forEach(n=>cnt[n]=0);pp.forEach(v=>{let b=null,bd=9;for(const n of names){let d=0;for(let i=0;i<8;i++)d+=(P[n][i]-v[i])**2;if(d<bd){bd=d;b=n;}}cnt[b]++;});return cnt;}
function cost(P,pp){const c=dist(P,pp);let s=0;names.forEach(n=>{const f=c[n]/N-1/12;s+=f*f*1e4;});
  let drift=0;names.forEach(n=>P[n].forEach((x,i)=>drift+=(x-P0[n][i])**2));return s+drift*6;}
const mode=process.argv[4]||'opt';
let P=JSON.parse(JSON.stringify(P0));
if(mode==='opt'){let best=cost(P,people);
 for(let it=0;it<14;it++){let imp=false;for(const n of names)for(let i=0;i<8;i++)for(const dlt of [.06,-.06,.03,-.03]){
  const old=P[n][i];const nv=Math.max(0,Math.min(1,old+dlt));if(nv===old)continue;P[n][i]=nv;const c=cost(P,people);if(c<best-1e-6){best=c;imp=true;}else P[n][i]=old;}
  if(!imp)break;}
 fs.writeFileSync('/workspace/tools/p8.json',JSON.stringify(P));}
const rep=(pp,label)=>{const c=dist(P,pp);const arr=names.map(n=>[n,(c[n]/N*100).toFixed(1)]);console.log(label,arr.map(a=>a.join(':')).join(' '),'min',Math.min(...Object.values(c))/N*100,'max',Math.max(...Object.values(c))/N*100);};
rep(people,'latent ');rep(uni,'uniform');
let dr=0;names.forEach(n=>P[n].forEach((x,i)=>dr=Math.max(dr,Math.abs(x-P0[n][i]))));console.log('stretch',STRETCH,'maxdrift',dr.toFixed(2));
