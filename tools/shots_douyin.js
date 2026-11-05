const puppeteer=require('puppeteer-core'),fs=require('fs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT='/workspace/dawgy/douyin/';
(async()=>{
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:'new'});
for(const k of ['husky','shiba','frenchie','border']){
  const p=await br.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:3});
  await p.goto('file:///workspace/dawgy/index.html');
  await p.click('#startBtn');
  const picks=await p.evaluate(k=>{const D=window.__dawgy;return D.QUIZ.map(q=>{let best=0,bd=9;q.o.forEach(([t,s],i)=>{const d=Math.abs(s-2*D.DOGS[k].p[D.DIMS.findIndex(x=>x.k===q.d)]);if(d<bd){bd=d;best=i;}});return best;});},k);
  for(let i=0;i<24;i++){await p.waitForSelector('.opt');await p.evaluate(n=>document.querySelector('.opt[data-i="'+n+'"]').click(),picks[i]);await sleep(340);}
  await p.waitForSelector('#result.active');await sleep(1500);
  const name=await p.$eval('#resName',e=>e.textContent);console.log(k,name);
  await p.evaluate(()=>{document.querySelector('#result').scrollTop=0;});await sleep(300);
  await p.screenshot({path:`${OUT}${k}_1_hero.png`});
  for(const [sel,tag] of [['.chart-box','2_bars'],['.meme-box','3_tags']]){
    await p.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),sel);await sleep(1300);
    await (await p.$(sel)).screenshot({path:`${OUT}${k}_${tag}.png`});
  }
  await p.evaluate(()=>document.querySelector('#result').scrollTop=0);await sleep(200);
  await p.click('#posterBtn');await p.waitForFunction(()=>{const i=document.querySelector('#posterImg');return i&&i.src.startsWith('blob:')&&i.complete&&i.naturalWidth>0;},{timeout:15000});await sleep(500);
  const data=await p.evaluate(async()=>{const b=await (await fetch(document.querySelector('#posterImg').src)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b);});});
  fs.writeFileSync(`${OUT}${k}_4_poster.png`,Buffer.from(data.split(',')[1],'base64'));
  await p.screenshot({path:`${OUT}${k}_4_poster_modal.png`});
  await p.close();
}
await br.close();
})();
