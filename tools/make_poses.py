# 把 poses_src 里的原图（纯色底）抠成透明、统一裁成 320x320 方图（脚底对齐），输出 img/<key>_<0|1|2>.webp
# 0=站姿 1=坐/趴 2=名场面动作
import numpy as np, os, glob
from PIL import Image
from collections import Counter
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=os.path.join(ROOT,'poses_src'); O=os.path.join(ROOT,'img'); N=320
KEYS='husky shiba golden corgi border teddy frenchie samoyed pom lab akita gsd'.split()
def src(k,i):
    if i==0: return os.path.join(S,'orig',k+'.webp')
    for e in ('.png','.jpg'):
        p=os.path.join(S,k+'_'+'xbc'[i]+e)
        if os.path.exists(p): return p
    raise SystemExit('missing '+k+str(i))
def key(im):
    a=np.asarray(im.convert('RGBA')).astype(np.float32)
    if a[...,3].min()<250:   # 已透明（cp 里的原图）：只清掉残留的浅青蓝色斑点
        r,g,b=a[...,0],a[...,1],a[...,2]
        bad=(b-r>35)&(g-r>25)&(b>190)&(a[...,3]>0)
        a[bad,3]=0
        return Image.fromarray(a.astype(np.uint8),'RGBA')
    rgb=a[...,:3]
    edge=np.concatenate([rgb[:6].reshape(-1,3),rgb[-6:].reshape(-1,3),rgb[:,:6].reshape(-1,3),rgb[:,-6:].reshape(-1,3)])
    bg=np.median(edge,axis=0)
    d=np.sqrt(((rgb-bg)**2).sum(-1))
    al=np.clip((d-14)/(30-14),0,1)
    out=np.zeros_like(a); 
    m=al>0.01
    c=(rgb-(1-al[...,None])*bg)/np.maximum(al[...,None],0.01)
    out[...,:3]=np.clip(c,0,255); out[...,3]=al*255
    out[~m,:3]=0
    # 去掉远离主体的零星杂点（保留 >40 像素的连通块即可，不做复杂处理）
    return Image.fromarray(out.astype(np.uint8),'RGBA')
def square(im):
    bb=im.getchannel('A').point(lambda v:255 if v>24 else 0).getbbox()
    im=im.crop(bb); w,h=im.size
    s=min(N*0.94/w,N*0.94/h); im=im.resize((max(1,round(w*s)),max(1,round(h*s))),Image.LANCZOS)
    c=Image.new('RGBA',(N,N),(0,0,0,0)); c.alpha_composite(im,((N-im.width)//2,N-im.height-round(N*0.03)))
    return c
tot=0
for k in KEYS:
    for i in range(3):
        im=square(key(Image.open(src(k,i))))
        p=os.path.join(O,'%s_%d.webp'%(k,i)); im.save(p,'WEBP',quality=80,method=6); tot+=os.path.getsize(p)
print('total bytes',tot)
