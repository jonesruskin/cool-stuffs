"""sample the mocap per frame: dancer hip height (for the music tempo) and foot heights (for footsteps) -> out/motion.json"""
import bpy, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'out', 'scene.blend'))
sc=bpy.context.scene
arms={o.animation_data.action.name:o for o in bpy.data.objects if o.type=='ARMATURE' and o.animation_data and o.animation_data.action}
mich=arms['SambaDance']; sol=arms['Walk']
hb=mich.pose.bones['mixamorig:Hips']
feet=[b for b in sol.pose.bones if b.name.lower().endswith('foot')][:2]
mfeet=[b for b in mich.pose.bones if b.name.lower().endswith('foot')][:2]
out={'hipz':[], 'sol':[], 'mich':[]}
for f in range(1,241):
    sc.frame_set(f)
    out['hipz'].append((mich.matrix_world@hb.head).z)
    out['sol'].append([(sol.matrix_world@b.head).z for b in feet])
    out['mich'].append([(mich.matrix_world@b.head).z for b in mfeet])
json.dump(out,open(os.path.join(HERE, 'out', 'motion.json'),'w'))
