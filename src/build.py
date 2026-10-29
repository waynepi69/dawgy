import base64,os,json
d=os.path.dirname(os.path.abspath(__file__))
r=lambda f:open(os.path.join(d,f),encoding='utf8').read()
keys=['husky','shiba','golden','corgi','border','teddy','frenchie','samoyed','pom','lab','akita','gsd']
img={k:['data:image/webp;base64,'+base64.b64encode(open(os.path.join(d,'..','img','%s_%d.webp'%(k,i)),'rb').read()).decode() for i in range(3)] for k in keys}
t=r('template.html')
t=t.replace('/*BASECSS*/',r('base.css')).replace('/*EXTRACSS*/',r('extra.css'))
t=t.replace('/*IMGDATA*/','/* 12 只小狗 × 3 个姿势（img/<key>_0/1/2.webp 的 base64 内嵌，保证单文件离线 + 海报可导出） */\nconst IMG='+json.dumps(img)+';')
t=t.replace('/*DATA*/',r('data_quiz.js')+'\n/* ============ 小狗数据：p = 8 维原型坐标 (E,S,B,W,C,F,D,A) ∈ [0,1] ============ */\n'+r('data_dogs.js')+'\n'+r('data_rel.js'))
t=t.replace('/*APP*/',r('app.js'))
open(os.path.join(d,'..','index.html'),'w',encoding='utf8').write(t)
print(len(t))
