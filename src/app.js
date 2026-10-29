/* ============ dawgy 逻辑 ============ */
const KEYS=Object.keys(DOGS);
const NDIM=DIMS.length;
const $=s=>document.querySelector(s);
const screens={cover:$("#cover"),quiz:$("#quiz"),result:$("#result"),gallery:$("#gallery")};
const NQ=QUIZ.length;
const LS_LAST="dawgy:last",LS_PROG="dawgy:prog";

/* ---------- 存储（隐私模式/禁用存储时静默失败） ---------- */
const store={
  get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set(k,v){try{localStorage.setItem(k,v);}catch(e){}},
  del(k){try{localStorage.removeItem(k);}catch(e){}}
};
const hex2=x=>Math.round(Math.max(0,Math.min(1,x))*255).toString(16).padStart(2,"0");
const packVec=v=>v.map(hex2).join("");
const unpackVec=h=>/^[0-9a-f]{16}$/.test(h||"")?h.match(/../g).map(x=>parseInt(x,16)/255):null;

/* ---------- 状态 ---------- */
let idx=0,answers=[],order=[],mine=null;      // mine = {k,v,s} 我自己的结果（持久化）
let view=null;                                // 当前结果页：{k,v,s,mode:"mine"|"dog"|"share"}
let advTimer=null,first=true;
let modalOpen=false,lastFocus=null,posterUrl=null,posterBusy=false;

function loadMine(){
  const raw=store.get(LS_LAST);if(!raw)return null;
  try{const o=JSON.parse(raw);if(o&&DOGS[o.k])return{k:o.k,v:Array.isArray(o.v)&&o.v.length===NDIM?o.v:null,s:DOGS[o.s]?o.s:null};}catch(e){}
  return DOGS[raw]?{k:raw,v:null,s:null}:null;      // 兼容旧版只存了 key 的情况
}
function saveMine(){store.set(LS_LAST,JSON.stringify(mine));}
function saveProg(){store.set(LS_PROG,JSON.stringify({a:answers,o:order}));}
function loadProg(){
  try{const o=JSON.parse(store.get(LS_PROG)||"null");
    if(o&&Array.isArray(o.a)&&Array.isArray(o.o)&&o.o.length===NQ&&o.o.every((p,i)=>Array.isArray(p)&&p.length===QUIZ[i].o.length)){answers=o.a.slice(0,NQ);order=o.o;return true;}}catch(e){}
  return false;
}
function shuffled(n){const a=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function newOrder(){return QUIZ.map(q=>shuffled(q.o.length));}   // 每题选项顺序随机，避免“总选第一个/最后一个”造成位置偏差

/* ---------- 图片：base64 只解码一次，之后全部用 blob URL ---------- */
const SRC={},NP=3;   // 每只狗 3 个姿势：0 站 · 1 坐/趴 · 2 小情景
KEYS.forEach(k=>{
  SRC[k]=IMG[k].map(u=>{
    try{const bin=atob(u.split(",")[1]),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return URL.createObjectURL(new Blob([a],{type:"image/webp"}));}
    catch(e){return u;}
  });
});
const dogImg=(k,cls,alt,p)=>`<img class="dog-img ${cls||""}" src="${SRC[k][p||0]}" alt="${alt||""}" draggable="false">`;

/* ---------- 小工具 ---------- */
function setHue(c){document.documentElement.style.setProperty("--hue",c);}
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`;}
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),2200);}
function show(n,focusEl){
  Object.entries(screens).forEach(([k,s])=>s.classList.toggle("active",k===n));
  screens[n].scrollTop=0;
  if(!first&&focusEl)focusEl.focus({preventScroll:true});   // 切屏后把焦点交给标题，读屏用户知道换页了
}

/* ---------- 路由（hash + history，支持浏览器/手势返回） ---------- */
// ""=封面  #q3=第3题  #me=我的结果  #d=shiba=图鉴里看某只狗  #r=shiba&v=<16位hex>=朋友分享  #gallery=图鉴
function go(h){if(location.hash.slice(1)===h)route();else location.hash=h;}
function route(){
  clearTimeout(advTimer);
  if(modalOpen)closeModal(true);
  const h=location.hash.slice(1);let m;
  if((m=h.match(/^q(\d+)$/))){
    if(!order.length&&!loadProg()){order=newOrder();answers=[];}
    let n=Math.max(0,Math.min(+m[1]-1,NQ-1));
    let firstOpen=0;while(firstOpen<NQ&&answers[firstOpen]!=null)firstOpen++;
    if(n>firstOpen)n=Math.min(firstOpen,NQ-1);      // 不能跳过没答的题
    idx=n;show("quiz",$("#qTitle"));renderQ();
  }else if(h==="me"){
    mine=mine||loadMine();
    if(mine)showResult({...mine,mode:"mine"});else{show("cover",$("#coverTitle"));renderCover();}
  }else if((m=h.match(/^r=([a-z]+)(?:&v=([0-9a-f]{16}))?$/))&&DOGS[m[1]]){
    const v=unpackVec(m[2]);let s=null;
    if(v){const r=rank(v);if(r[0][0]===m[1])s=r[1][0];}
    showResult({k:m[1],v,s,mode:"share"});
  }else if((m=h.match(/^d=([a-z]+)$/))&&DOGS[m[1]]){
    showResult({k:m[1],v:null,s:null,mode:"dog"});
  }else if(h==="gallery"){
    show("gallery",$("#galleryTitle"));
  }else{
    document.title="dawgy · 测测你是什么小狗";
    renderCover();show("cover",$("#coverTitle"));
  }
  first=false;
}
window.addEventListener("hashchange",route);

/* ---------- 封面 ---------- */
let coverIdx=Math.floor(Math.random()*KEYS.length),coverPose=Math.floor(Math.random()*NP);
function renderCover(){
  const k=KEYS[coverIdx];$("#coverDog").innerHTML=dogImg(k,"","",coverPose);
  $("#coverName").textContent="我是"+DOGS[k].n+"（戳我换一只）";setHue(DOGS[k].c);
  $("#lastBtn").hidden=!(mine||(mine=loadMine()));
}
$("#coverDog").onclick=()=>{
  coverIdx=(coverIdx+1)%KEYS.length;coverPose=(coverPose+1)%NP;renderCover();
  const s=$("#coverDog");s.classList.remove("pop");void s.offsetWidth;s.classList.add("pop");
  s.addEventListener("animationend",()=>s.classList.remove("pop"),{once:true});
};
$("#startBtn").onclick=start;
$("#lastBtn").onclick=()=>go("me");
function start(){answers=[];order=newOrder();saveProg();go("q1");}

/* ---------- 答题 ---------- */
function renderQ(){
  const q=QUIZ[idx];
  $("#progText").textContent=`${idx+1} / ${NQ}`;
  $("#barFill").style.width=`${((idx+1)/NQ)*100}%`;
  $("#bar").setAttribute("aria-valuenow",idx+1);
  // 小狗走路：复用同一个元素，left 的过渡才有动画
  let w=$("#walker img");if(!w){$("#walker").innerHTML=`<img class="dog-img" alt="" draggable="false">`;w=$("#walker img");}
  w.src=SRC[KEYS[idx%KEYS.length]][(idx*2+1)%NP];w.style.left=`${((idx+1)/NQ)*100}%`;
  $("#qLabel").textContent=`${String(idx+1).padStart(2,"0")} · ${q.l}`;
  $("#qTitle").textContent=q.t;
  $("#prevBtn").style.visibility=idx===0?"hidden":"visible";
  const box=$("#opts");box.innerHTML="";
  let locked=false;
  order[idx].forEach((oi,pos)=>{
    const b=document.createElement("button");b.type="button";b.className="opt";b.dataset.i=oi;
    b.style.animationDelay=(pos*.05)+"s";
    b.innerHTML=`<span class="dot" aria-hidden="true"></span><span></span>`;b.lastChild.textContent=q.o[oi][0];
    const picked=answers[idx]===oi;if(picked)b.classList.add("pick");
    b.setAttribute("aria-pressed",picked?"true":"false");
    b.onclick=()=>{
      if(locked)return;locked=true;
      box.querySelectorAll(".opt").forEach(o=>{o.classList.remove("pick");o.setAttribute("aria-pressed","false");});
      b.classList.add("pick");b.setAttribute("aria-pressed","true");
      answers[idx]=oi;saveProg();
      clearTimeout(advTimer);
      advTimer=setTimeout(()=>{idx+1<NQ?go("q"+(idx+2)):finish();},260);
    };
    box.appendChild(b);
  });
}
$("#prevBtn").onclick=()=>{clearTimeout(advTimer);if(idx>0)go("q"+idx);};

// 计分：每维 3 题，每题 0~2 分 → 0~1；再以 0.5 为中心拉伸，让极端性格更容易出现；最后取欧氏距离最近的小狗
const STRETCH=1.6;
function scoreVec(ans){
  const sum={},cnt={};DIMS.forEach(d=>{sum[d.k]=0;cnt[d.k]=0;});
  QUIZ.forEach((q,i)=>{if(ans[i]==null)return;sum[q.d]+=q.o[ans[i]][1];cnt[q.d]+=2;});
  return DIMS.map(d=>{const x=cnt[d.k]?sum[d.k]/cnt[d.k]:.5;return Math.max(0,Math.min(1,.5+(x-.5)*STRETCH));});
}
const scoreAll=()=>scoreVec(answers);
function rank(v){
  return KEYS.map(k=>{const p=DOGS[k].p;let d=0;for(let i=0;i<NDIM;i++)d+=(p[i]-v[i])**2;return[k,Math.sqrt(d)];}).sort((a,b)=>a[1]-b[1]);
}


function finish(){
  const v=scoreAll(),r=rank(v);
  mine={k:r[0][0],v,s:r[1][0]};saveMine();store.del(LS_PROG);
  go("me");
}

/* ---------- 关系卡 ---------- */
function relCard(kind,cls,r){
  const o=DOGS[r.k];
  return `<div class="rel ${cls}"><button type="button" class="rel-head" data-k="${r.k}" aria-label="看看${o.n}的结果"><span class="mini">${dogImg(r.k,"","",1)}</span>
    <span class="rel-txt"><span class="rel-kind">${kind}</span><span class="rel-name">${o.n}<small>${o.t.split(" · ")[0]}</small></span></span></button>
    <div class="rel-p"></div><div class="rel-f"><b>🎬 小情景</b><span></span></div><div class="rel-s"><b>💬 ta 想对你说</b><span></span></div></div>`;
}

/* ---------- 结果页主图：3 个姿势，点一下换（默认先看小情景） ---------- */
let heroPose=2;
function setHero(p,anim){
  const key=view.k,b=DOGS[key];heroPose=p;view.pose=p;
  $("#resDog").innerHTML=dogImg(key,"",b.n+"："+b.poses[p],p);
  $("#poseCap").textContent=b.poses[p];
  $("#poseDots").innerHTML=[0,1,2].map(i=>`<i class="${i===p?"on":""}"></i>`).join("");
  if(anim){const s=$("#resDog");s.classList.remove("swap");void s.offsetWidth;s.classList.add("swap");}
}
$("#resDog").onclick=()=>{if(view)setHero((heroPose+1)%NP,true);};

/* ---------- 结果页（三种模式：我的 / 图鉴里的狗 / 朋友分享） ---------- */
function showResult(vw){
  view=vw;const key=vw.k,b=DOGS[key],mode=vw.mode;
  setHue(b.c);
  document.title=`${b.n} · dawgy`;
  $("#banner").style.background=`linear-gradient(180deg,${hexA(b.c,.32)},${hexA(b.c,.08)} 70%,transparent)`;
  setHero(2,false);
  $("#resLabel").textContent=mode==="mine"?"你的狗狗人格是":mode==="share"?"ta 的狗狗人格是":"这只小狗是";
  $("#resName").textContent=b.n;$("#resEn").textContent=b.en.toUpperCase();
  $("#resTitle").textContent=b.t;
  $("#resQuote").textContent=b.q;
  $("#resDesc").textContent=b.d;
  $("#resTags").innerHTML=b.tags.map(t=>`<span class="tag">${t}</span>`).join("");
  $("#subDog").innerHTML=vw.s?`${mode==="mine"?"你":"ta"}身上还带点 <b>${DOGS[vw.s].n}</b> 的影子`:"";
  const vv=vw.v||b.p;
  $("#chartTitle").textContent=mode==="mine"?"你的狗狗八维":vw.v?"ta 的狗狗八维":"这只狗的典型八维";
  $("#relTitle").textContent=mode==="mine"?"你的狗狗关系图":"这只狗的关系图";
  $("#chart").innerHTML=DIMS.map((d,i)=>{const pct=Math.round(vv[i]*100);
    return `<div class="dim compact"><div class="dim-head"><b>${d.n}</b><span class="dim-x">${d.x}</span><em>${pct}%</em></div><div class="dim-track"><div class="dim-fill" data-w="${pct}"></div></div><div class="dim-ends"><span>${d.lo}</span><span>${d.hi}</span></div></div>`;}).join("");
  const R=REL[key];
  $("#relBox").innerHTML=relCard("🐾 最佳狗友","",R.friend)+relCard("💕 最佳情侣","love",R.lover)+relCard("⚡ 欢喜冤家","",R.foe);
  [R.friend,R.lover,R.foe].forEach((r,i)=>{const el=$("#relBox").children[i];
    el.querySelector(".rel-p").textContent=r.p;el.querySelector(".rel-f span").textContent=r.f;el.querySelector(".rel-s span").textContent=r.s;
    el.querySelector(".rel-head").onclick=()=>go("d="+r.k);});
  $("#resFact").textContent=b.fact;$("#resWarm").textContent=b.w;
  // 顶部提示条：只在“别人的 / 图鉴里的”狗上出现，并给一个回到我的结果的入口
  const hasMine=!!(mine||(mine=loadMine()));
  const fb=$("#friendBanner");
  fb.classList.toggle("show",mode!=="mine");
  $("#bannerText").textContent=mode==="share"?"这是朋友分享的结果～":hasMine?"你正在看图鉴里的小狗。":"你正在逛图鉴～想知道自己是哪只？点最下面「测测我是什么狗」。";
  $("#toMine").hidden=!(mode!=="mine"&&hasMine);
  $("#againBtn").textContent=mode==="mine"?"再测一次":mode==="share"?"我也测一测":"测测我是什么狗";
  $("#shareNote").textContent=/^https?:/.test(location.protocol)
    ?(mode==="mine"?"分享链接会带上你的结果，朋友点开就能看":"")
    :"当前是本地文件，没有分享链接；可以用「保存海报」发给朋友";
  show("result",$("#resName"));
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll(".dim-fill").forEach(e=>e.style.width=e.dataset.w+"%")));
}
$("#toMine").onclick=()=>go("me");
$("#againBtn").onclick=start;

/* ---------- 图鉴 ---------- */
$("#galleryList").innerHTML=KEYS.map(k=>`<button type="button" class="g-card" data-k="${k}" aria-label="${DOGS[k].n}，${DOGS[k].t.split(" · ")[0]}"><span class="art" style="background:${hexA(DOGS[k].c,.18)}">${dogImg(k)}</span><span class="g-name">${DOGS[k].n}</span><span class="g-tag">${DOGS[k].t.split(" · ")[0]}</span></button>`).join("");
$("#legend").innerHTML="<b>八个维度分别是什么</b>"+DIMS.map(d=>`<div><span>${d.n}</span>：${d.x}</div>`).join("");
$("#galleryBtn").onclick=()=>go("gallery");
$("#galleryList").onclick=e=>{const c=e.target.closest(".g-card");if(c)go("d="+c.dataset.k);};
$("#galleryBack").onclick=()=>go(view?(view.mode==="mine"?"me":"d="+view.k):mine?"me":"");

/* ---------- 分享 ---------- */
function shareText(){
  const b=DOGS[view.k];
  return view.mode==="mine"?`我测出来是「${b.n}·${b.t.split(" · ")[0]}」！${b.line}。你是什么小狗？来测测～`
    :`「${b.n}·${b.t.split(" · ")[0]}」——${b.line}。你是什么小狗？来测测～`;
}
function shareUrl(){const u=location.href.split("#")[0];return u+"#r="+view.k+(view.mode==="mine"&&view.v?"&v="+packVec(view.v):"");}
async function copyText(t){
  try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(t);return true;}}catch(e){}
  try{ // iOS 老版本：需要 contentEditable + setSelectionRange
    const ta=document.createElement("textarea");ta.value=t;ta.readOnly=false;ta.contentEditable="true";
    ta.style.cssText="position:fixed;left:-9999px;top:0;opacity:0;font-size:16px";document.body.appendChild(ta);
    ta.focus();ta.select();ta.setSelectionRange(0,t.length);const ok=document.execCommand("copy");document.body.removeChild(ta);return ok;
  }catch(e){return false;}
}
$("#shareBtn").onclick=async()=>{
  const text=shareText(),http=/^https?:/.test(location.protocol),url=shareUrl();
  if(navigator.share){try{await navigator.share(http?{title:"dawgy · 测测你是什么小狗",text,url}:{title:"dawgy · 测测你是什么小狗",text});return;}catch(e){if(e&&e.name==="AbortError")return;}}
  const ok=await copyText(http?text+" "+url:text);
  toast(ok?(http?"已复制，去微信/小红书粘贴吧":"已复制文案（本地文件没有链接，可用「保存海报」）"):"复制失败，请手动截图分享");
};

/* ---------- 海报（canvas 绘制，离线可用；只画内嵌插画（当前姿势），避免跨域污染画布） ---------- */
const FONT='-apple-system,PingFang SC,Microsoft YaHei,sans-serif';
function wrapText(ctx,text,x,y,maxW,lh,maxLines){
  const lines=[];let line="";
  for(const ch of [...text]){if(ctx.measureText(line+ch).width>maxW&&line){lines.push(line);line=ch;}else line+=ch;}
  if(line)lines.push(line);
  const out=lines.slice(0,maxLines);
  if(lines.length>maxLines){let l=out[maxLines-1];while(l&&ctx.measureText(l+"…").width>maxW)l=l.slice(0,-1);out[maxLines-1]=l+"…";}
  out.forEach((l,i)=>ctx.fillText(l,x,y+i*lh));return out.length*lh;
}
function rr(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function makePoster(key,vec,pose){
  return new Promise(res=>{
    const b=DOGS[key],W=750,H=1460,cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d");
    const v=vec||(view&&view.k===key&&view.v)||b.p;
    c.fillStyle="#F6F1E7";c.fillRect(0,0,W,H);
    const g=c.createLinearGradient(0,0,0,640);g.addColorStop(0,hexA(b.c,.55));g.addColorStop(1,hexA(b.c,0));c.fillStyle=g;c.fillRect(0,0,W,640);
    c.fillStyle="#2B2622";c.textAlign="center";
    c.font=`800 44px ${FONT}`;c.fillText("dawgy",W/2,90);
    c.font=`24px ${FONT}`;c.fillStyle="#5F574A";c.fillText("测测你是什么小狗",W/2,128);
    const img=new Image();
    img.onload=()=>{
      const s=Math.min(440/img.width,420/img.height);const w=img.width*s,h=img.height*s;
      c.fillStyle="rgba(43,38,34,.08)";c.beginPath();c.ellipse(W/2,150+420-6,150,14,0,0,7);c.fill();
      c.drawImage(img,W/2-w/2,150+420-h,w,h);
      c.fillStyle="#2B2622";c.font=`800 88px ${FONT}`;c.fillText(b.n,W/2,670);
      c.fillStyle="#6F6657";c.font=`22px ${FONT}`;c.fillText(b.en.toUpperCase(),W/2,708);
      c.fillStyle="#2B2622";c.font=`600 30px ${FONT}`;c.fillText(b.t,W/2,764);
      c.fillStyle="#FBF8F1";rr(c,60,796,630,116,24);c.fill();c.strokeStyle="#A59B8A";c.setLineDash([8,8]);c.lineWidth=2;c.stroke();c.setLineDash([]);
      c.fillStyle="#2B2622";c.font=`600 28px ${FONT}`;wrapText(c,b.q,W/2,846,560,42,2);
      c.font=`600 26px ${FONT}`;
      const ws=b.tags.map(t=>c.measureText(t).width+44),tot=ws.reduce((a,x)=>a+x,0)+16*(b.tags.length-1);let x=(W-tot)/2;
      b.tags.forEach((t,i)=>{c.fillStyle=b.c;rr(c,x,940,ws[i],52,26);c.fill();c.fillStyle="#2B2622";c.fillText(t,x+ws[i]/2,975);x+=ws[i]+16;});
      // 八维小条：名称 + 一句通俗解释 + 条 + 百分比
      c.textAlign="left";
      DIMS.forEach((d,i)=>{const col=i%2,row=Math.floor(i/2),bx=60+col*340,by=1042+row*66;
        c.fillStyle="#2B2622";c.font=`600 22px ${FONT}`;c.fillText(d.n,bx,by+8);
        c.fillStyle="#E4DCCB";rr(c,bx+104,by-8,170,14,7);c.fill();
        const fw=170*v[i];if(fw>=1){c.fillStyle=b.c;rr(c,bx+104,by-8,fw,14,7);c.fill();}
        c.fillStyle="#2B2622";c.font=`600 20px ${FONT}`;c.fillText(Math.round(v[i]*100)+"%",bx+284,by+7);
        c.fillStyle="#5F574A";c.font=`15px ${FONT}`;
        let t=d.x;while(t.length>1&&c.measureText(t).width>300)t=t.slice(0,-1);c.fillText(t,bx,by+34);});
      c.textAlign="center";
      c.fillStyle="#5F574A";c.font=`24px ${FONT}`;
      const R=REL[key];
      c.fillText("狗友："+DOGS[R.friend.k].n+"　情侣："+DOGS[R.lover.k].n+"　冤家："+DOGS[R.foe.k].n,W/2,1352);
      c.fillStyle="#6F6657";c.font=`20px ${FONT}`;c.fillText("趣味测试 · 仅供娱乐，百分比代表选项倾向",W/2,1394);
      c.font=`22px ${FONT}`;c.fillText("你是什么小狗？来测测 · dawgy",W/2,1430);
      res(cv);
    };
    img.onerror=()=>res(null);
    img.src=IMG[key][pose==null?((view&&view.k===key&&view.pose!=null)?view.pose:2):pose];     // 海报用 data URI，保证 file:// 下画布不被污染
  });
}
const blobOf=cv=>new Promise(r=>{try{cv.toBlob(b=>r(b),"image/png");}catch(e){r(null);}});
$("#posterBtn").onclick=async()=>{
  if(posterBusy||!view)return;posterBusy=true;
  const btn=$("#posterBtn");btn.setAttribute("aria-disabled","true");btn.classList.add("busy");toast("海报生成中…");
  try{
    const cv=await makePoster(view.k,view.v,view.pose);
    if(!cv){toast("海报生成失败，请截图保存");return;}
    let url=null;const bl=await blobOf(cv);
    if(bl)url=URL.createObjectURL(bl);else{try{url=cv.toDataURL("image/png");}catch(e){}}
    if(!url){toast("海报生成失败，请截图保存");return;}
    if(posterUrl&&posterUrl.startsWith("blob:"))URL.revokeObjectURL(posterUrl);
    posterUrl=url;
    $("#posterImg").src=url;$("#posterImg").alt=`${DOGS[view.k].n} 结果海报`;$("#dlBtn").href=url;$("#dlBtn").download="dawgy-"+view.k+".png";
    openModal();
  }finally{posterBusy=false;btn.removeAttribute("aria-disabled");btn.classList.remove("busy");}
};
function openModal(){
  lastFocus=document.activeElement;modalOpen=true;
  Object.values(screens).forEach(s=>{s.inert=true;});
  $("#modal").classList.add("show");$("#closeModal").focus();
}
function closeModal(noFocus){
  if(!modalOpen)return;modalOpen=false;
  $("#modal").classList.remove("show");
  Object.values(screens).forEach(s=>{s.inert=false;});
  if(!noFocus&&lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
}
$("#closeModal").onclick=()=>closeModal();
$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal();};
document.addEventListener("keydown",e=>{
  if(!modalOpen)return;
  if(e.key==="Escape"){e.preventDefault();closeModal();}
  else if(e.key==="Tab"){ // 焦点只在弹窗内的两个控件间循环
    const f=[$("#dlBtn"),$("#closeModal")],i=f.indexOf(document.activeElement);
    e.preventDefault();f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus();
  }
});

/* ---------- 入口 ---------- */
mine=loadMine();
route();
// 测试钩子
window.__dawgy={DOGS,QUIZ,DIMS,REL,KEYS,IMG,rank,scoreVec,STRETCH,makePoster,go,state:()=>({idx,answers:answers.slice(),order,mine,view})};
