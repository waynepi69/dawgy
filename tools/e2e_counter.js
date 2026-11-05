// 计数器测试：本地起 http 服务，拦截并伪造 abacus 的响应，不会碰线上真实计数
const puppeteer=require('puppeteer-core'),http=require('http'),fs=require('fs');
const html=fs.readFileSync('/workspace/dawgy/index.html');
const srv=http.createServer((q,r)=>{r.setHeader('content-type','text/html;charset=utf8');r.end(html);}).listen(0);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m);}else console.log('ok  ',m);};
(async()=>{
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
const URL='http://127.0.0.1:'+srv.address().port+'/';
async function mk(mode,state){
  const ctx=await br.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2});
  const errs=[],calls=[],other=[];p.__calls=calls;p.__errs=errs;p.__other=other;
  p.on('pageerror',e=>errs.push(String(e)));
  await p.setRequestInterception(true);
  p.on('request',r=>{const u=r.url();
    if(/abacus\.jasoncameron\.dev/.test(u)){calls.push(u.replace('https://abacus.jasoncameron.dev/',''));
      if(mode==='fail')return r.abort();
      if(mode==='hang')return;                       // 永不返回
      if(mode==='500')return r.respond({status:500,body:'x'});
      const op=u.split('/')[3];if(op==='hit')state.n++;
      return r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({value:state.n})});}
    if(!u.startsWith(URL)&&!/^(data|blob|about):/.test(u))other.push(u);
    r.continue();});
  await p.goto(URL);return p;
}
async function quiz(p){
  await p.click('#startBtn');
  for(let i=0;i<24;i++){await p.waitForSelector('.opt');await p.evaluate(()=>document.querySelector('.opt[data-i="1"]').click());await sleep(340);}
  await p.waitForSelector('#result.active');
}
const txt=(p,s)=>p.$eval(s,e=>e.hidden?'':e.textContent);
// 1 正常：首次完成 +1，其余不加
{const st={n:41};const p=await mk('ok',st);await sleep(400);
 ok(await txt(p,'#coverTested')==='已有 41 人测试过','cover shows 41 (get)');
 await quiz(p);await sleep(500);
 ok(st.n===42,'hit once -> 42, got '+st.n);
 ok(await txt(p,'#resTested')==='已有 42 人测试过','result shows 42: '+await txt(p,'#resTested'));
 await p.reload();await sleep(500);ok(st.n===42,'reload does not increment');
 await p.evaluate(()=>{location.hash='me'});await sleep(300);
 ok(await txt(p,'#resTested')==='已有 42 人测试过','saved result shows count');
 await p.click('#againBtn');await quiz(p);await sleep(500);
 ok(st.n===42,'second completion in same browser does not increment, n='+st.n);
 ok(p.__calls.filter(c=>c.startsWith('hit/')).length===1,'exactly one hit call: '+JSON.stringify(p.__calls));
 ok(p.__other.length===0,'no other network: '+p.__other);ok(!p.__errs.length,'no errors '+p.__errs);
 await p.screenshot({path:'/workspace/dawgy/_c.png'});
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await p.screenshot({path:'/workspace/dawgy/result_count.png',fullPage:true});
 await p.close();}
// 2 失败 / 超时 / 500：隐藏，页面照常，下次还会重试
for(const m of ['fail','500','hang']){const st={n:5};const p=await mk(m,st);await sleep(300);
 ok(await txt(p,'#coverTested')==='',m+': cover count hidden');
 const t0=Date.now();await quiz(p);ok(Date.now()-t0<20000,m+': quiz completes normally');
 await sleep(m==='hang'?4800:300);
 ok(await txt(p,'#resTested')==='',m+': result count hidden');
 ok(!await p.evaluate(()=>localStorage.getItem('dawgy:counted')),m+': not marked counted (retry later)');
 ok(!p.__errs.length,m+': no page errors '+p.__errs);await p.close();}
await br.close();srv.close();console.log(fails?'FAILS '+fails:'COUNTER ALL PASS');
})();
