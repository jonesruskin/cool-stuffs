"""render the whole shot from out/scene.blend into out/frames/ (resumable: finished frames are skipped)"""
import bpy, os
HERE = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'out', 'scene.blend'))
sc = bpy.context.scene
sc.render.filepath = os.path.join(HERE, 'out', 'frames', '')
bpy.ops.render.render(animation=True)
