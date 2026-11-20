"""Author reusable, transparent leaf-cluster cards. Requires Pillow."""
import math
import random
import sys
from pathlib import Path
from PIL import Image, ImageDraw

LENGTH = 512
SHAPES = {
    "maple": [(0,-1),(.19,-.47),(.45,-.6),(.39,-.27),(.8,-.38),(.64,.05),(.83,.16),(.41,.28),(.47,.45),(.12,.41),(0,.65),(-.12,.41),(-.47,.45),(-.41,.28),(-.83,.16),(-.64,.05),(-.8,-.38),(-.39,-.27),(-.45,-.6),(-.19,-.47)],
    "oak": [(0,-1),(.25,-.8),(.18,-.58),(.53,-.72),(.41,-.39),(.66,-.36),(.43,-.17),(.7,.01),(.35,.17),(.44,.39),(0,.68),(-.44,.39),(-.35,.17),(-.7,.01),(-.43,-.17),(-.66,-.36),(-.41,-.39),(-.53,-.72),(-.18,-.58),(-.25,-.8)],
}

def render(kind, output):
    random.seed(kind)
    image = Image.new("RGBA", (LENGTH,LENGTH), (87,118,48,0))
    draw = ImageDraw.Draw(image)
    for i in range(92 if kind!="sakura" else 135):
        a=random.uniform(0,math.tau)
        radius=math.sqrt(random.random())
        x=256+math.cos(a)*radius*218
        y=256+math.sin(a)*radius*193
        size=random.uniform(12,34)
        direction=random.uniform(0,math.tau)
        c,s=math.cos(direction),math.sin(direction)
        def point(p):
            u,v=p
            return x+size*(u*c-v*s),y+size*(u*s+v*c)
        if kind=="sakura":
            size*=.34
            shade=(random.randrange(226,255),random.randrange(178,233),random.randrange(196,239),255)
            for j in range(5):
                a=j*math.tau/5+direction
                px,py=x+size*.62*math.cos(a),y+size*.62*math.sin(a)
                draw.ellipse((px-size*.51,py-size*.51,px+size*.51,py+size*.51),fill=shade)
            draw.ellipse((x-1.3,y-1.3,x+1.3,y+1.3),fill=(195,119,129,255))
        else:
            tint=random.randrange(-15,24)
            base=(96,139,54) if kind=="maple" else (68,105,40)
            shade=tuple(v+tint for v in base)+(255,)
            draw.polygon([point(p) for p in SHAPES[kind]],fill=shade)
            draw.line([point((0,.7)),point((0,-.74))],fill=tuple(min(255,v+22) for v in shade[:3])+(255,),width=1)
    image.save(output/f"{kind}-leaves.png",optimize=True)

if __name__=="__main__":
    output=Path(sys.argv[1]);output.mkdir(parents=True,exist_ok=True)
    for kind in ["maple","oak","sakura"]:
        render(kind,output)
