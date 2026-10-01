import bpy, sys, os
frames = [int(x) for x in sys.argv[sys.argv.index('--') + 1:]]
bpy.ops.wm.open_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'scene.blend'))
sc = bpy.context.scene
for f in frames:
    sc.frame_set(f)
    sc.render.filepath = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'stills', f'f{f:04d}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', f)
