"""Blender 4.5 LTS. Export reference-built architecture and LOD tree meshes."""
import bpy
import math
import random
import sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index("--")+1:]
OUT, CARDS = map(Path, args[:2])
LOW_SAKURA = args[2:] == ["--sakura-low"]
OUT.mkdir(parents=True, exist_ok=True)

def material(name, color, metal=0, rough=.74):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*color,1)
    bsdf.inputs["Metallic"].default_value=metal
    bsdf.inputs["Roughness"].default_value=rough
    return mat

def finish(obj,name,mat,smooth=False):
    obj.name=name;obj.data.materials.append(mat)
    if obj.type=="MESH":
        for polygon in obj.data.polygons:polygon.use_smooth=smooth
    return obj

def box(name,loc,size,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object;obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new("Dressed edges","BEVEL");mod.width=bevel;mod.segments=2
        normal=obj.modifiers.new("Weighted normals","WEIGHTED_NORMAL")
    return finish(obj,name,mat)

def tube(name,points,radius,mat):
    curve=bpy.data.curves.new(name,"CURVE");curve.dimensions="3D"
    curve.bevel_depth=radius;curve.bevel_resolution=1;curve.resolution_u=1
    spline=curve.splines.new("POLY");spline.points.add(len(points)-1)
    for vertex,p in zip(spline.points,points):vertex.co=(*p,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    return finish(obj,name,mat)

def export(filename,objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format="GLB",use_selection=True,export_apply=True)
    bpy.ops.object.delete()

bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete()
if not LOW_SAKURA:
    stone=material("Masonry_PBR",(.43,.39,.33))
    cap=material("Dressed limestone",(.50,.48,.41))
    iron=material("Weathered wrought iron",(.032,.042,.035),.63,.42)
    glass=material("Lantern cream glass",(.65,.60,.43),.12,.29)
    trim=material("Map frame timber",(.37,.27,.15))
    sign=material("Park sign green",(.057,.27,.21))
    gate=[]

    def arc(x):
        return 3.43+2.16*max(0,1-(x/5.9)**2)**1.16

    for side in [-1,1]:
        x=side*5.9
        for i,(width,depth,h,z) in enumerate([(1.43,1.44,.23,.115),(1.25,1.25,.28,.36),(1.04,1.03,2.59,1.795),
                        (1.23,1.2,.15,3.165),(1.43,1.39,.17,3.32),(1.19,1.17,.13,3.465)]):
            gate.append(box("Pillar band "+str(i),(x,0,z),(width,depth,h),stone if i==2 else cap,.035))
        gate.append(box("Wing masonry pier",(side*10.13,0,.73),(.83,.86,1.46),stone,.045))
        gate.append(box("Wing coping",(side*10.13,0,1.51),(1.01,.99,.16),cap,.034))
        for i in range(19):
            dx=6.42+i*.185
            h=1.38+.83*max(0,1-(dx-6.4)/1.65)**2
            gate.append(tube("Fence picket",[(side*dx,0,.09),(side*dx,0,h)],.024,iron))
        for h in [.17,1.14]:
            gate.append(tube("Fence runner",[(side*6.42,0,h),(side*9.74,0,h)],.033,iron))
        gate.append(tube("Fence crown",[(side*(6.42+i*.09),0,1.38+.83*max(0,1-i*.09/1.65)**2) for i in range(38)],.031,iron))
        gate.append(box("Iron spring plate",(x,0,3.59),(.58,.31,.21),iron,.028))
    for h in [0,.23,.52]:
        gate.append(tube("Continuous rib",[(-5.9+i*11.8/74,0,arc(-5.9+i*11.8/74)+h) for i in range(75)],.032,iron))
    for i in range(1,28):
        x=-5.9+i*11.8/28; y=arc(x)
        gate.append(tube("Arch brace",[(x-.10,0,y),(x+.10,0,y+.51)],.014,iron))
        for signum in [-1,1]:
            gate.append(tube("Cast scroll",[(x+signum*(.09+(.144-j*.0038)*math.cos(j*.34)),0,
                  y+.25+(.144-j*.0038)*math.sin(j*.34)) for j in range(29)],.012,iron))
    gate.append(box("Lamp top",(0,0,5.98),(.61,.56,.14),iron,.06))
    gate.append(box("Lamp glass",(0,0,5.60),(.38,.36,.62),glass,.055))
    gate.append(box("Lamp base",(0,0,5.24),(.53,.47,.15),iron,.058))
    for x in [-.2,.2]:
        for y in [-.18,.18]:
            gate.append(tube("Lamp mullion",[(x,y,5.25),(x*1.26,y*1.2,5.94)],.035,iron))
    for x in [-8.38,-6.82]:
        gate.append(box("Information stand",(x,1.06,.93),(.12,.16,1.86),trim,.025))
    gate.append(box("Information backing",(-7.6,1.07,1.31),(1.56,.12,1.11),cap,.03))
    gate.append(box("Information header",(-7.6,1,1.92),(1.6,.17,.24),sign,.018))
    font=bpy.data.curves.new("Park sign letters","FONT");font.body="HIGH PARK";font.align_x="CENTER";font.size=.128;font.extrude=.002
    obj=bpy.data.objects.new("Park sign letters",font);bpy.context.collection.objects.link(obj)
    obj.location=(-7.6,.902,1.88);obj.rotation_euler.x=math.pi/2
    gate.append(finish(obj,"Park sign letters",glass))
    # Convert and consolidate by surface so scrollwork remains one runtime mesh.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in gate:obj.select_set(True)
    bpy.context.view_layer.objects.active=gate[0];bpy.ops.object.convert(target="MESH")
    parts=list(bpy.context.selected_objects)
    joined=[]
    for surface in [stone,cap,iron,glass,trim,sign]:
        selected=[obj for obj in parts if obj.data.materials[0]==surface]
        if not selected:continue
        bpy.ops.object.select_all(action="DESELECT")
        for item in selected:item.select_set(True)
        bpy.context.view_layer.objects.active=selected[0]
        bpy.ops.object.join()
        joined.append(bpy.context.object)
        parts=[obj for obj in parts if obj not in selected]
    export("north-gate.glb",joined)

def tree(species,seed,lod):
    rng=random.Random(seed)
    bark=material("Bark "+species,(.16,.105,.067) if species=="oak" else (.22,.16,.11))
    canopy=material("LeafCards "+species,(1,1,1),rough=.91)
    image=bpy.data.images.load(str(CARDS/(species+"-leaves.png")),check_existing=True)
    bsdf=canopy.node_tree.nodes.get("Principled BSDF")
    slot=canopy.node_tree.nodes.new("ShaderNodeTexImage");slot.image=image
    canopy.node_tree.links.new(slot.outputs["Color"],bsdf.inputs["Base Color"])
    canopy.node_tree.links.new(slot.outputs["Alpha"],bsdf.inputs["Alpha"])
    bv,bf,lv,lf=[],[],[],[]
    height=(13.8 if species=="maple" else 11.7 if species=="oak" else 6.1)*rng.uniform(.94,1.09)
    spread=(5.0 if species=="maple" else 6.6 if species=="oak" else 3.5)*rng.uniform(.91,1.11)
    sides={"high":8,"balanced":6,"low":5}[lod]
    def branch(points,widths):
        offset=len(bv)
        for j,(p,r) in enumerate(zip(points,widths)):
            axis=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
            a=axis.cross(Vector((1,0,0))).normalized();b=axis.cross(a).normalized()
            for i in range(sides):
                angle=i*math.tau/sides
                bv.append(p+r*(a*math.cos(angle)+b*math.sin(angle))*(.93+.13*rng.random()))
        for j in range(len(points)-1):
            for i in range(sides):
                a=offset+j*sides+i;b=offset+j*sides+(i+1)%sides
                bf.append((a,b,b+sides,a+sides))
    def card(center,scale):
        yaw=rng.random()*math.tau
        u=Vector((math.cos(yaw),math.sin(yaw),rng.uniform(-.35,.35))).normalized()*scale
        v=Vector((-math.sin(yaw)*.44,math.cos(yaw)*.44,rng.choice([-1,1])*.81)).normalized()*scale*.74
        i=len(lv);lv.extend([center-u-v,center+u-v,center+u+v,center-u+v]);lf.append((i,i+1,i+2,i+3))
    trunk=[Vector((rng.uniform(-.24,.24)*i,rng.uniform(-.2,.2)*i,height*f)) for i,f in enumerate([0,.19,.37,.58,.78,.98])]
    branch(trunk,[height*x for x in [.048,.037,.030,.021,.012,.002]])
    for i in range({"high":10,"balanced":8,"low":7}[lod]):
        angle=i*2.399+rng.uniform(-.35,.35)
        y=height*(.34+.043*i)
        f=min(4,int((y/height)/.19))
        start=Vector((trunk[f].x,trunk[f].y,y))
        rad=spread*(1-.037*i)*rng.uniform(.79,1.12)
        axis=Vector((math.cos(angle),math.sin(angle),0))
        middle=start+axis*rad*.53+Vector((0,0,height*.095))
        tip=start+axis*rad+Vector((0,0,height*rng.uniform(.14,.24)))
        branch([start,middle,tip],[height*.019,height*.008,height*.0018])
        for j in range({"high":4,"balanced":3,"low":2}[lod]):
            part=middle.lerp(tip,(j+1)/4.5)
            twig=part+Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(.7,1.6)))*spread*.31
            branch([part,part.lerp(twig,.52),twig],[height*.007,height*.003,height*.001])
            for _ in range({"high":8,"balanced":4,"low":2}[lod]):
                c=twig+Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-.65,.86)))*spread*.24
                card(c,spread*rng.uniform(.19,.37)*(1.32 if lod=="low" else 1))
    for _ in range(20 if lod=="high" else 10):
        card(trunk[-1]+Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-.55,.45)))*spread*.42,spread*.29)
    result=[]
    for name,vertices,faces,mat in [("Wood",bv,bf,bark),("LeafCards",lv,lf,canopy)]:
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        finish(obj,name,mat,name=="Wood")
        if name=="LeafCards":
            uv=mesh.uv_layers.new(name="UVMap")
            for poly in mesh.polygons:
                for loop,value in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop].uv=value
        result.append(obj)
    export(f"{species}-{seed}-{lod}.glb",result)

species_seeds = [("sakura", [19, 61])] if LOW_SAKURA else [("maple",[43,79]),("oak",[31,67]),("sakura",[19,61])]
for species,seeds in species_seeds:
    for seed in seeds:
        for lod in (["low"] if LOW_SAKURA else ["high", "balanced"]):
            tree(species,seed,lod)
