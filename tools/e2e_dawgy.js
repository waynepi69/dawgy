const puppeteer=require('puppeteer-core');
const fs=require('fs');
const URL='file:///workspace/dawgy/index.html';
const OUT='/workspace/dawgy/';
(async()=>{
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
const errs=[];let fails=0;
const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m);}};
const netReqs=[];
async function page(_unused,w=390,h=844){
  const p=await br.newPage();await p.setViewport({width:w,height:h,deviceScaleFactor:2});
  p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load resource/.test(m.text()))errs.push(m.text());});
  await p.setRequestInterception(true);
  p.on('request',r=>{if(!/^(file|blob|data|about):/.test(r.url()))netReqs.push(r.url());r.continue();});
  await p.goto(URL);return p;
}
async function takeQuiz(p,key){
  await p.click('#startBtn');
  const picks=await p.evaluate(k=>{const D=window.__dawgy;return D.QUIZ.map(q=>{let best=0,bd=9;q.o.forEach(([t,s],i)=>{const d=Math.abs(s-2*D.DOGS[k].p[D.DIMS.findIndex(x=>x.k===q.d)]);if(d<bd){bd=d;best=i;}});return best;});},key);
  for(let i=0;i<24;i++){await p.waitForSelector('.opt');
    const cnt=await p.$$eval('.opt',o=>o.length);ok(cnt===4,'opts count '+cnt);
    const lab=await p.$eval('#progText',e=>e.textContent);ok(lab.startsWith((i+1)+' /'),'prog '+lab);
    await p.evaluate(n=>document.querySelector('.opt[data-i="'+n+'"]').click(),picks[i]);
    await new Promise(r=>setTimeout(r,340));}
  await p.waitForSelector('#result.active');
}
const keys=await (async()=>{const p=await page(true);const k=await p.evaluate(()=>window.__dawgy.KEYS);await p.close();return k;})();
const res={};
// 1. 12 种结果（同时检查：典型八维有强有弱、3 个姿势可切换、没有任何联网请求）
for(const k of keys){
  const p=await page(true);await takeQuiz(p,k);
  const got=await p.evaluate(()=>document.querySelector('#resName').textContent);
  const exp=await p.evaluate(k=>window.__dawgy.DOGS[k].n,k);
  ok(got===exp,`${k}: expected ${exp} got ${got}`);res[k]=got;
  const n=await p.evaluate(()=>({rel:document.querySelectorAll('.rel').length,bars:document.querySelectorAll('.dim').length,
    imgOk:document.querySelector('#resDog img').naturalWidth>0,
    rp:[...document.querySelectorAll('.rel-p')].map(e=>e.textContent.length),
    rs:[...document.querySelectorAll('.rel-s span')].map(e=>e.textContent.length),
    nf:document.querySelectorAll('.rel-f').length,txt:document.body.innerText.includes('小情景'),
    memes:[...document.querySelectorAll('#memeList .meme')].map(e=>e.textContent.length)}));
  ok(n.rel===3&&n.bars===8&&n.imgOk,k+' structure '+JSON.stringify(n));
  ok(n.rp.every(x=>x>60)&&n.rs.every(x=>x>5)&&n.nf===0&&!n.txt,k+' rel text '+JSON.stringify(n));
  ok(n.memes.length>=2&&n.memes.length<=3&&n.memes.every(x=>x>20),k+' memes '+JSON.stringify(n.memes));
  await new Promise(r=>setTimeout(r,500));
  // 姿势：3 张图都能加载，点主图循环 0→1→2，文案跟着变，没有 GIF 区块
  const ps=await p.evaluate(async()=>{
    const out={caps:[],srcs:[],ok:true,gif:!!document.querySelector('#gifCard,#gifImg,.gif-card')};
    const hero=document.querySelector('#resDog');
    for(let i=0;i<3;i++){
      const im=hero.querySelector('img');if(!im.complete)await new Promise(r=>{im.onload=r;im.onerror=r;});
      out.ok=out.ok&&im.naturalWidth>0;out.caps.push(document.querySelector('#poseCap').textContent);out.srcs.push(im.src);
      out.dots=document.querySelectorAll('#poseDots i').length;out.on=[...document.querySelectorAll('#poseDots i')].findIndex(e=>e.classList.contains('on'));
      hero.click();await new Promise(r=>setTimeout(r,50));
    }
    return out;});
  ok(ps.ok&&!ps.gif&&ps.dots===3&&new Set(ps.srcs).size===3&&new Set(ps.caps).size===3&&ps.caps.every(c=>c.length>5),k+' poses '+JSON.stringify(ps));
  // 典型八维：至少 2 项 >=75、2 项 <=25
  const pv=await p.evaluate(k=>window.__dawgy.DOGS[k].p.map(x=>Math.round(x*100)),k);
  ok(pv.filter(x=>x>=75).length>=2&&pv.filter(x=>x<=25).length>=2,k+' prototype strong/weak '+pv);
  // 海报
  const po=await p.evaluate(async k=>{const c=await window.__dawgy.makePoster(k);if(!c)return null;return c.toDataURL('image/png').length;},k);
  ok(po&&po>20000,k+' poster '+po);
  await p.close();
}
console.log('results',JSON.stringify(res));
// 2. 柴犬结果页截图（默认姿势=名场面）
{
  const p=await page(false);await takeQuiz(p,'shiba');
  await new Promise(r=>setTimeout(r,900));await p.screenshot({path:OUT+'result.png'});
  await p.evaluate(()=>document.querySelector('.res-body').scrollIntoView());
  // 长页面截图
  await p.evaluate(()=>{document.querySelector('#result').scrollTop=0});
  const h=await p.evaluate(()=>document.querySelector('#result').scrollHeight);
  await p.setViewport({width:390,height:Math.min(h,4000),deviceScaleFactor:1.5});
  await new Promise(r=>setTimeout(r,500));
  await p.screenshot({path:OUT+'result_full.png'});
  await p.setViewport({width:390,height:844,deviceScaleFactor:2});
  // 点关系头像
  await p.evaluate(()=>document.querySelector('.rel-head').click());
  const fr=await p.evaluate(()=>({b:getComputedStyle(document.querySelector('#friendBanner')).display,a:document.querySelector('#againBtn').textContent,t:document.querySelector('#bannerText').textContent,m:!document.querySelector('#toMine').hidden}));
  ok(fr.b==='flex'&&fr.a==='测测我是什么狗'&&/图鉴/.test(fr.t)&&!/朋友分享/.test(fr.t)&&fr.m,'rel click '+JSON.stringify(fr));
  await p.click('#toMine');await new Promise(r=>setTimeout(r,300));
  ok((await p.$eval('#resName',e=>e.textContent))==='柴犬'&&(await p.$eval('#againBtn',e=>e.textContent))==='再测一次','back to mine');
  // 海报截图
  await p.click('#posterBtn');await p.waitForSelector('#modal.show');await new Promise(r=>setTimeout(r,400));
  const pw=await p.evaluate(()=>document.querySelector('#posterImg').naturalWidth);ok(pw===750,'poster width '+pw);
  await p.screenshot({path:OUT+'poster.png'});
  const dataUrl=await p.evaluate(async()=>{const b=await (await fetch(document.querySelector('#posterImg').src)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b);});});
  fs.writeFileSync('/workspace/tools/poster_full.png',Buffer.from(dataUrl.split(',')[1],'base64'));
  ok(await p.evaluate(()=>document.activeElement.id==='closeModal'),'dialog focus on close');
  ok(await p.evaluate(()=>document.querySelector('#modal').getAttribute('role')==='dialog'&&document.querySelector('#toast').getAttribute('role')==='status'),'aria roles');
  await p.keyboard.press('Escape');await new Promise(r=>setTimeout(r,200));
  ok(await p.evaluate(()=>!document.querySelector('#modal').classList.contains('show')&&document.activeElement.id==='posterBtn'),'Esc closes + focus restored');
  await p.close();
}
// 3. 返回键、hash、图鉴、封面
{
  const p=await page(true);
  await p.screenshot({path:OUT+'cover.png'});
  await p.click('#startBtn');await p.waitForSelector('.opt');
  await p.evaluate(()=>document.querySelector('.opt').click());await new Promise(r=>setTimeout(r,340));
  await p.evaluate(()=>document.querySelectorAll('.opt')[1].click());await new Promise(r=>setTimeout(r,340));
  await p.screenshot({path:OUT+'quiz.png'});
  await p.click('#prevBtn');await new Promise(r=>setTimeout(r,250));
  ok((await p.$eval('#progText',e=>e.textContent))==='2 / 24','back btn');
  ok(await p.$eval('.opt.pick',e=>1)===1,'prev pick remembered');
  await p.close();
  const q=await br.newPage();await q.setViewport({width:390,height:844,deviceScaleFactor:2});q.on('pageerror',e=>errs.push(String(e)));
  await q.setRequestInterception(true);q.on('request',r=>/giphy/.test(r.url())?r.abort():r.continue());
  await q.goto(URL+'#r=akita');await q.reload();
  ok(/朋友分享/.test(await q.$eval('#bannerText',e=>e.textContent)),'share banner');
  ok((await q.$eval('#resName',e=>e.textContent))==='秋田','hash link');
  await q.click('#galleryBtn');await new Promise(r=>setTimeout(r,300));
  ok((await q.$$eval('#legend div',e=>e.map(x=>x.textContent))).length===8,'gallery legend');
  const gc=await q.$$eval('.g-card img',i=>i.map(x=>x.naturalWidth>0));ok(gc.length===12&&gc.every(Boolean),'gallery imgs');
  await q.screenshot({path:OUT+'gallery.png'});
  await q.evaluate(()=>document.querySelector('.g-card[data-k=corgi]').click());
  ok((await q.$eval('#resName',e=>e.textContent))==='柯基','gallery open');
  { const bt=await q.$eval('#bannerText',e=>e.textContent);ok(!/朋友分享/.test(bt)&&/图鉴|逛/.test(bt),'gallery banner not "friend shared": '+bt);
    ok((await q.$eval('#chartTitle',e=>e.textContent))==='这只狗的典型八维','dog chart title'); }

  // share fallback
  await q.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});});
  await q.click('#shareBtn');await new Promise(r=>setTimeout(r,300));
  ok(/复制|失败/.test(await q.$eval('#toast',e=>e.textContent)),'share toast');
  await q.goBack();await new Promise(r=>setTimeout(r,300));
  ok(await q.evaluate(()=>document.querySelector('#gallery').classList.contains('active')),'back from dog -> gallery');
  await q.close();
}

// 5. 评审修复专项
{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const pick=async(p,i)=>{await p.evaluate(n=>document.querySelector('.opt[data-i="'+n+'"]').click(),i);};
  // 5a 刷新不丢结果 + 封面“查看上次结果” + 通俗解释 + 免责声明
  let p=await page(true);await takeQuiz(p,'husky');
  const nm=await p.$eval('#resName',e=>e.textContent);
  const vec1=await p.$$eval('.dim-fill',e=>e.map(x=>x.dataset.w).join());
  await p.reload();await sleep(400);
  ok((await p.$eval('#resName',e=>e.textContent))===nm&&(await p.$$eval('.dim-fill',e=>e.map(x=>x.dataset.w).join()))===vec1,'reload keeps own result '+nm);
  const xs=await p.$$eval('#chart .dim-x',e=>e.map(x=>x.textContent));
  ok(JSON.stringify(xs)===JSON.stringify(['精力有多旺','爱不爱社交','精明还是单纯','自己拿主意还是随大流','离不离得开人','有多爱吃','情绪和表现欲有多强','心里稳不稳']),'dimension explanations '+xs);
  ok(/趣味测试/.test(await p.$eval('#result .disclaimer',e=>e.textContent)),'result disclaimer');
  await p.goto(URL);await sleep(300);
  ok(await p.$eval('#lastBtn',e=>!e.hidden),'cover has 查看上次结果');
  ok(/趣味测试/.test(await p.$eval('#cover',e=>e.textContent)),'cover disclaimer');
  await p.click('#lastBtn');await sleep(300);
  ok((await p.$eval('#resName',e=>e.textContent))===nm,'lastBtn opens result');
  // 分享链接带向量：新页面（无存储）打开
  const link=await p.evaluate(()=>{const v=window.__dawgy.state();return v.view;});
  const hash=await p.evaluate(()=>{const D=window.__dawgy;const m=D.state().mine;return '#r='+m.k+'&v='+m.v.map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');});
  const ctx=await br.createBrowserContext();const q=await ctx.newPage();await q.setViewport({width:390,height:844});
  await q.goto(URL+hash);await sleep(400);
  ok((await q.$eval('#resName',e=>e.textContent))===nm&&/朋友分享/.test(await q.$eval('#bannerText',e=>e.textContent))&&(await q.$$eval('.dim-fill',e=>e.map(x=>x.dataset.w).join()))===vec1,'share link with vector reproduces chart');
  ok(await q.$eval('#toMine',e=>e.hidden),'no toMine for stranger');
  await ctx.close();
  // 5b 中途刷新恢复进度；浏览器返回
  const p2=await page(true);await p2.click('#startBtn');
  for(let i=0;i<5;i++){await p2.waitForSelector('.opt');await p2.evaluate(()=>document.querySelector('.opt').click());await sleep(340);}
  ok((await p2.$eval('#progText',e=>e.textContent))==='6 / 24','at q6');
  const before=await p2.evaluate(()=>window.__dawgy.state());
  await p2.reload();await sleep(400);
  const after=await p2.evaluate(()=>window.__dawgy.state());
  ok((await p2.$eval('#progText',e=>e.textContent))==='6 / 24'&&JSON.stringify(after.answers)===JSON.stringify(before.answers)&&JSON.stringify(after.order)===JSON.stringify(before.order),'reload mid-quiz resumes');
  await p2.goBack();await sleep(300);
  ok((await p2.$eval('#progText',e=>e.textContent))==='5 / 24','browser back goes to previous question, not out of page');
  await p2.goForward();await sleep(300);
  ok((await p2.$eval('#progText',e=>e.textContent))==='6 / 24','forward');
  // 竞态：点选项后 280ms 内立刻点上一题，不应错乱
  await p2.evaluate(()=>document.querySelector('.opt').click());await p2.click('#prevBtn');await sleep(500);
  ok((await p2.$eval('#progText',e=>e.textContent))==='5 / 24','prev-vs-timer race');
  // 不能通过 hash 跳到没答过的题
  await p2.evaluate(()=>{location.hash='#q20'});await sleep(300);
  ok(/^[567] \//.test(await p2.$eval('#progText',e=>e.textContent)),'cannot skip ahead: '+await p2.$eval('#progText',e=>e.textContent));
  // 5c 选项顺序随机：两次开始，顺序不应总是相同；data-i 覆盖全部原下标
  const ords=[];for(let t=0;t<2;t++){await p2.evaluate(()=>window.__dawgy.go(''));await sleep(200);await p2.click('#startBtn');await sleep(200);ords.push(await p2.evaluate(()=>JSON.stringify(window.__dawgy.state().order)));}
  ok(ords[0]!==ords[1],'option order shuffled per session');
  await p2.close();
  // 5e 键盘/无障碍：选项是 button + aria-pressed；进度条 role
  const p4=await page(true);await p4.click('#startBtn');await sleep(300);
  const a11y=await p4.evaluate(()=>({tag:[...document.querySelectorAll('.opt')].every(e=>e.tagName==='BUTTON'&&e.hasAttribute('aria-pressed')),pb:document.querySelector('#bar').getAttribute('role'),foc:document.activeElement.id,cover:document.querySelector('#coverDog').tagName}));
  ok(a11y.tag&&a11y.pb==='progressbar'&&a11y.cover==='BUTTON','a11y '+JSON.stringify(a11y));
  ok(a11y.foc==='qTitle','focus moved to question heading: '+a11y.foc);
  // 对比度：--ink3 在 #F6F1E7 上 ≥ 4.5
  const cr=await p4.evaluate(()=>{const L=h=>{const n=parseInt(h.slice(1),16),f=x=>{x/=255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4};return .2126*f(n>>16)+.7152*f(n>>8&255)+.0722*f(n&255)};const c=getComputedStyle(document.documentElement).getPropertyValue('--ink3').trim();const a=L(c),b=L('#F6F1E7');return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  ok(cr>=4.5,'ink3 contrast '+cr.toFixed(2));
  await p4.close();
  await p.close();
}
// 4. 桌面宽度截图
{const p=await page(true,1280,900);await p.screenshot({path:'/workspace/tools/desktop.png'});await p.close();}
ok(netReqs.length===0,'no network requests: '+JSON.stringify(netReqs.slice(0,5)));
console.log('network requests',netReqs.length);
console.log('errors',JSON.stringify(errs));
console.log(fails===0&&!errs.length?'ALL PASS':'FAILS '+fails);
await br.close();
})();
