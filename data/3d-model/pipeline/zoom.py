import sys,re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0,'.')
from leaves import load
M=Path('out/m')
rows=load(str(M/'jacket_leaves.tsv'))
cs=np.load(M/'jacket_cent.npy'); li=np.load(M/'jacket_li.npy')
ph=np.array([(re.search(r'PHASE[-_]?(\d+(?:-\d+)?)',r['path']) or [None,'ifc'])[1] for r in rows])
PAL={'1':(230,25,75),'2':(60,180,75),'3':(0,130,200),'5':(245,130,48),'6':(145,30,180),'7':(220,0,0),'8':(0,150,150),'9':(128,128,0),'ifc':(200,200,200)}
def render(box, axes, out, w=900, h=700):
    (x0,x1),(y0,y1),(z0,z1)=box
    m=(cs[:,0]>x0)&(cs[:,0]<x1)&(cs[:,1]>y0)&(cs[:,1]<y1)&(cs[:,2]>z0)&(cs[:,2]<z1)
    p=cs[m]; g=ph[li[m]]
    a,b=axes; lo=np.array([p[:,a].min(),p[:,b].min()]); hi=np.array([p[:,a].max(),p[:,b].max()])
    s=min((w-20)/(hi[0]-lo[0]),(h-30)/(hi[1]-lo[1]))
    img=np.full((h,w,3),255,np.uint8)
    for k in PAL:
        sel=g==k; px=((p[sel,a]-lo[0])*s+10).astype(int); py=(h-15-(p[sel,b]-lo[1])*s).astype(int)
        img[np.clip(py,0,h-1),np.clip(px,0,w-1)]=PAL[k]
    im=Image.fromarray(img); d=ImageDraw.Draw(im)
    for i,k in enumerate(PAL): d.rectangle((w-90,8+i*14,w-80,18+i*14),fill=PAL[k]); d.text((w-75,7+i*14),'phase '+k,fill=(0,0,0))
    im.save(out)
render(((-154,-146),(89,97),(-56,10)),(0,2),'out/m/z_tank_side.png')
render(((-154,-146),(89,97),(-56,10)),(1,2),'out/m/z_tank_front.png')
render(((-152,-126),(104,132),(-18,-2)),(1,2),'out/m/z_htank_front.png')
print('ok')
