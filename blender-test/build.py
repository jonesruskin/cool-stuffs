"""
Blender 10-second test: a rain-soaked neon street at night.
  Shot 1 (0–4.5 s): low dolly — a soldier walks toward camera (real Mixamo motion capture).
  Shot 2 (4.5–10 s): orbit around a woman dancing samba under a streetlight as the soldier passes.
Everything is built from code; characters + mocap come from the three.js example models (Mixamo).
    python3 build.py [--preview]   -> out/frames/####.png  (Cycles, CPU)
"""
import bpy, math, os, sys, random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.environ.get('ASSETS', os.path.join(HERE, 'assets'))
OUT = os.path.join(HERE, 'out', 'frames')
FPS, END = 24, 240
SHOT2 = 109
PREVIEW = '--preview' in sys.argv
R = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS; sc.frame_start = 1; sc.frame_end = END

# ---------------------------------------------------------------- materials
def mat(name, base=(0.1, 0.1, 0.1), rough=.5, metal=0., emit=None, strength=0., alpha=1.):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m

def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)   # sRGB → linear

def wet_asphalt():
    m = bpy.data.materials.new('asphalt'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    puddle = N.new('ShaderNodeTexNoise'); puddle.inputs['Scale'].default_value = .35; puddle.inputs['Detail'].default_value = 3
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = .47; ramp.color_ramp.elements[1].position = .56
    L.new(tc.outputs['Object'], puddle.inputs['Vector']); L.new(puddle.outputs['Fac'], ramp.inputs['Fac'])
    rough = N.new('ShaderNodeMapRange'); rough.inputs['To Min'].default_value = .34; rough.inputs['To Max'].default_value = .02
    L.new(ramp.outputs['Color'], rough.inputs['Value']); L.new(rough.outputs['Result'], b.inputs['Roughness'])
    grain = N.new('ShaderNodeTexNoise'); grain.inputs['Scale'].default_value = 60
    col = N.new('ShaderNodeMix'); col.data_type = 'RGBA'
    col.inputs['A'].default_value = (*hexc('#0e0f13'), 1); col.inputs['B'].default_value = (*hexc('#07080b'), 1)
    L.new(tc.outputs['Object'], grain.inputs['Vector']); L.new(ramp.outputs['Color'], col.inputs['Factor'])
    L.new(col.outputs['Result'], b.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .08
    L.new(grain.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

def windows(seed):
    """facade in world metres: 3.2 m floors, 2.6 m bays; each window cell lit at random, warm or cool"""
    m = bpy.data.materials.new(f'facade{seed}'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = .85
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    def op(kind, a_, b_=None, v=None):
        n = N.new('ShaderNodeMath'); n.operation = kind
        (L.new(a_, n.inputs[0]) if not isinstance(a_, (int, float)) else n.inputs[0].__setattr__('default_value', a_))
        if b_ is not None: (L.new(b_, n.inputs[1]) if not isinstance(b_, (int, float)) else n.inputs[1].__setattr__('default_value', b_))
        return n.outputs[0]
    u = op('ADD', sep.outputs['X'], sep.outputs['Y'])
    fu = op('FRACT', op('DIVIDE', u, 2.0)); fz = op('FRACT', op('DIVIDE', sep.outputs['Z'], 3.0))
    inx = op('MULTIPLY', op('GREATER_THAN', fu, .27), op('LESS_THAN', fu, .73))
    inz = op('MULTIPLY', op('GREATER_THAN', fz, .34), op('LESS_THAN', fz, .76))
    win = op('MULTIPLY', inx, inz)
    cell = N.new('ShaderNodeCombineXYZ')
    L.new(op('FLOOR', op('DIVIDE', u, 2.0)), cell.inputs['X']); L.new(op('FLOOR', op('DIVIDE', sep.outputs['Z'], 3.0)), cell.inputs['Y'])
    cell.inputs['Z'].default_value = seed * .137
    wn = N.new('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; L.new(cell.outputs[0], wn.inputs['Vector'])
    lit = op('MULTIPLY', win, op('GREATER_THAN', wn.outputs['Value'], .62))
    hue = N.new('ShaderNodeMix'); hue.data_type = 'RGBA'
    hue.inputs['A'].default_value = (*hexc('#ffb36b'), 1); hue.inputs['B'].default_value = (*hexc('#9fc3ff'), 1)
    L.new(op('GREATER_THAN', wn.outputs['Value'], .86), hue.inputs['Factor']); L.new(hue.outputs['Result'], b.inputs['Emission Color'])
    L.new(op('MULTIPLY', op('MULTIPLY', lit, 1.6), op('MULTIPLY', wn.outputs['Value'], wn.outputs['Value'])), b.inputs['Emission Strength'])
    base = N.new('ShaderNodeMix'); base.data_type = 'RGBA'
    base.inputs['A'].default_value = (*hexc('#17181d'), 1); base.inputs['B'].default_value = (*hexc('#06070b'), 1)
    L.new(win, base.inputs['Factor']); L.new(base.outputs['Result'], b.inputs['Base Color'])
    L.new(op('SUBTRACT', .85, op('MULTIPLY', win, .7)), b.inputs['Roughness'])
    return m

def shopfront(color, strength):
    m = bpy.data.materials.new('shop'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    def op(kind, a_, b_):
        n = N.new('ShaderNodeMath'); n.operation = kind
        for i, v in enumerate((a_, b_)):
            (L.new(v, n.inputs[i]) if not isinstance(v, (int, float)) else n.inputs[i].__setattr__('default_value', v))
        return n.outputs[0]
    u = op('ADD', sep.outputs['X'], sep.outputs['Y'])
    mull = op('GREATER_THAN', op('FRACT', op('DIVIDE', u, 1.6), 1), .06)           # 0 on the mullion bars
    grad = op('ADD', .35, op('MULTIPLY', op('ADD', sep.outputs['Z'], 1.1), .3))     # brighter towards the top
    # interior: lit shelf bands broken into product clusters, soft glow behind
    cv = N.new('ShaderNodeCombineXYZ'); L.new(u, cv.inputs['X']); L.new(op('FLOOR', op('MULTIPLY', sep.outputs['Z'], 2.4), 0), cv.inputs['Y'])
    clus = N.new('ShaderNodeTexNoise'); clus.inputs['Scale'].default_value = 1.6; clus.inputs['Detail'].default_value = 0
    L.new(cv.outputs[0], clus.inputs['Vector'])
    band = op('GREATER_THAN', op('FRACT', op('MULTIPLY', sep.outputs['Z'], 2.4), 0), .72)
    items = op('MULTIPLY', band, op('GREATER_THAN', clus.outputs['Fac'], .48))
    shelves = op('ADD', .3, op('MULTIPLY', items, 1.6))
    L.new(op('MULTIPLY', op('MULTIPLY', op('MULTIPLY', mull, grad), shelves), strength), b.inputs['Emission Strength'])
    b.inputs['Emission Color'].default_value = (*hexc(color), 1); b.inputs['Base Color'].default_value = (.02, .02, .02, 1)
    return m

ASPH = wet_asphalt()
CURB = mat('curb', hexc('#1a1b20'), .6)
POLE = mat('pole', hexc('#111215'), .35, .8)
def shutter():
    m = bpy.data.materials.new('shutter'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); wave = N.new('ShaderNodeTexWave'); wave.wave_type = 'BANDS'; wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = 6; L.new(tc.outputs['Object'], wave.inputs['Vector'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .5
    L.new(wave.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Base Color'].default_value = (*hexc('#3a3d44'), 1); b.inputs['Metallic'].default_value = .7; b.inputs['Roughness'].default_value = .45
    return m
SHUTTER = shutter()
RAIN = mat('rain', hexc('#cfdcff'), .1, emit=hexc('#c9d6f5'), strength=.25, alpha=.25)

# ---------------------------------------------------------------- set
def box(name, loc, size, m):
    bpy.ops.mesh.primitive_cube_add(location=loc); o = bpy.context.object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); o.data.materials.append(m); return o

box('road', (0, 0, -.05), (40, 160, .1), ASPH); bpy.ops.object.transform_apply(scale=True)   # world-metre texture coords
for s in (-1, 1):
    box(f'walk{s}', (s * 6.0, 0, .07), (3.2, 160, .14), CURB)
    y = 70.0
    while y > -60:
        d = R.uniform(7, 13); h = R.uniform(9, 30); w = R.uniform(8, 12)
        o = box(f'bld{s}{int(y)}', (s * (7.6 + w / 2), y - d / 2, h / 2), (w, d - .4, h), windows(int(y * 10) + s))
        bpy.ops.object.transform_apply(scale=True)
        # lit shopfront at street level + awning
        closed = R.random() < .35
        shop = box(f'shop{s}{int(y)}', (s * 7.58, y - d / 2, 1.5), (.06, d - 1.6, 2.2),
                   SHUTTER if closed else shopfront(R.choice(['#ffb070', '#9cc8ff', '#ff8fb0', '#ffd27a', '#7dffcf']), R.uniform(.5, 1.0)))
        bpy.ops.object.transform_apply(scale=True)
        box(f'awn{s}{int(y)}', (s * 7.0, y - d / 2, 3.0), (1.3, d - 1.2, .08), mat(f'awnm{s}{int(y)}', hexc(R.choice(['#7a1028', '#0f3b52', '#5a3a0a'])), .6))
        y -= d

FONT = '/mnt/skills/examples/canvas-design/canvas-fonts/BigShoulders-Bold.ttf'
fnt = bpy.data.fonts.load(FONT) if os.path.exists(FONT) else None
def neon(text, loc, rot_z, color, size=1.1, strength=14, vertical=False):
    cu = bpy.data.curves.new(text, 'FONT'); cu.body = '\n'.join(text) if vertical else text
    if fnt: cu.font = fnt
    cu.size = size; cu.extrude = .03; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    o = bpy.data.objects.new(text, cu); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (math.radians(90), 0, math.radians(rot_z))
    o.data.materials.append(mat(f'neon_{text}', (0, 0, 0), .4, emit=hexc(color), strength=strength * 1.8))
    # light it actually throws into the street
    bpy.ops.object.light_add(type='AREA', location=(loc[0] - math.copysign(1.2, loc[0]), loc[1], loc[2]))
    l = bpy.context.object; l.data.energy = 260; l.data.color = hexc(color); l.data.size = 2.5
    l.rotation_euler = (0, math.radians(90 * (1 if loc[0] > 0 else -1)), 0)
    return o
SIGNS = [('NOODLES', 1, 6, 3.6, '#ff2d75', True), ('BAR', -1, 2, 4.2, '#22d3ee', True), ('24H', 1, -3, 5.0, '#ffb020', False),
         ('ARCADE', -1, -9, 3.8, '#a855f7', True), ('KARAOKE', 1, -15, 4.6, '#22d3ee', True), ('HOTEL', -1, -20, 6.0, '#ff2d75', True),
         ('OPEN', 1, 10, 3.0, '#ff2d75', False), ('RAMEN', -1, 12, 4.4, '#ffb020', True), ('TAXI', -1, -28, 3.4, '#ffb020', False)]
for t, s, y, z, c, v in SIGNS:
    neon(t, (s * 7.45, y, z), 90 * -s, c, size=.9 if v else 1.1, vertical=v)
EXTRA = ['SUSHI', 'BAR', 'PACHINKO', 'LIVE', 'JAZZ', 'CAFE', 'GAMES', 'NIGHT']
for i, t in enumerate(EXTRA):
    s_ = -1 if i % 2 else 1
    neon(t, (s_ * 7.45, 16 - i * 9.5 + R.uniform(-2, 2), R.uniform(6.5, 11)), 90 * -s_, R.choice(['#ff2d75', '#22d3ee', '#a855f7', '#ffb020', '#4ade80']),
         size=.8, strength=10, vertical=R.random() < .6)
for y in (14, 0, -14, -28, -42):
    for s_ in (-1, 1):
        box(f'pl{s_}{y}', (s_ * 4.9, y, 2.6), (.1, .1, 5.2), POLE)
        box(f'lp{s_}{y}', (s_ * 4.3, y, 5.15), (.5, .25, .08), mat(f'lpm{s_}{y}', (0, 0, 0), emit=hexc('#cfe0ff'), strength=18))
        bpy.ops.object.light_add(type='POINT', location=(s_ * 4.3, y, 4.9)); pl = bpy.context.object
        pl.data.energy = 220; pl.data.color = hexc('#bcd0ff'); pl.data.shadow_soft_size = .3

# streetlight over the dancer
DANCE = Vector((2.3, -6.0, .14))
box('pole', (4.6, -6.0, 2.6), (.12, .12, 5.2), POLE)
box('arm', (3.9, -6.0, 5.15), (1.5, .1, .1), POLE)
box('lamp', (3.2, -6.0, 5.05), (.6, .3, .1), mat('lamp', (0, 0, 0), emit=hexc('#ffcf8a'), strength=30))
bpy.ops.object.light_add(type='SPOT', location=(3.0, -6.0, 4.9)); sp = bpy.context.object
sp.data.energy = 1500; sp.data.color = hexc('#ffc27a'); sp.data.spot_size = math.radians(70); sp.data.spot_blend = .6; sp.data.shadow_soft_size = .2
sp.rotation_euler = (0, math.radians(-8), 0)

# world: deep blue night, mist for depth haze in the compositor
w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (*hexc('#070a14'), 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
w.mist_settings.start = 4; w.mist_settings.depth = 55; w.mist_settings.falloff = 'QUADRATIC'
bpy.ops.object.light_add(type='SUN', location=(0, 0, 30)); sun = bpy.context.object
sun.data.energy = .08; sun.data.color = hexc('#7f9cff'); sun.rotation_euler = (math.radians(40), 0, math.radians(30))

# ---------------------------------------------------------------- rain
bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=.0045, depth=.45, location=(0, 0, -50))
drop = bpy.context.object; drop.name = 'drop'; drop.data.materials.append(RAIN); drop.hide_render = True
def rain(name, center, size, count, cam, height=11.0, speed=9.0, seed=0):
    """deterministic rain: every drop's height is a function of the frame (no particle cache), so any frame
    renders on its own. z = floor + (z0 - speed·t) mod height; a light wind slants the fall."""
    me = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    g = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    g.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = g.nodes; L = g.links
    outn = N.new('NodeGroupOutput')
    rnd = N.new('FunctionNodeRandomValue'); rnd.data_type = 'FLOAT_VECTOR'
    rnd.inputs[0].default_value = (center[0] - size[0] / 2, center[1] - size[1] / 2, 0)
    rnd.inputs[1].default_value = (center[0] + size[0] / 2, center[1] + size[1] / 2, height)
    rnd.inputs['Seed'].default_value = seed
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(rnd.outputs[0], sep.inputs[0])
    t = N.new('GeometryNodeInputSceneTime')
    def op(kind, a_, b_):
        n = N.new('ShaderNodeMath'); n.operation = kind
        for i, v in enumerate((a_, b_)):
            (L.new(v, n.inputs[i]) if not isinstance(v, (int, float)) else n.inputs[i].__setattr__('default_value', v))
        return n.outputs[0]
    fall = op('FLOORED_MODULO', op('SUBTRACT', sep.outputs['Z'], op('MULTIPLY', t.outputs['Seconds'], speed)), height)
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(op('ADD', sep.outputs['X'], op('MULTIPLY', fall, .1)), comb.inputs['X'])
    L.new(sep.outputs['Y'], comb.inputs['Y']); L.new(op('ADD', fall, -.3), comb.inputs['Z'])
    pts = N.new('GeometryNodePoints'); pts.inputs['Count'].default_value = count; L.new(comb.outputs[0], pts.inputs['Position'])
    info = N.new('GeometryNodeObjectInfo'); info.inputs['Object'].default_value = drop; info.inputs['As Instance'].default_value = True
    sz = N.new('FunctionNodeRandomValue'); sz.data_type = 'FLOAT'; sz.inputs[2].default_value = .6; sz.inputs[3].default_value = 1.1
    sz.inputs['Seed'].default_value = seed + 1
    inst = N.new('GeometryNodeInstanceOnPoints')
    # no drops right on the lens: delete points near this shot's camera
    ci = N.new('GeometryNodeObjectInfo'); ci.inputs['Object'].default_value = cam
    pos = N.new('GeometryNodeInputPosition'); dist = N.new('ShaderNodeVectorMath'); dist.operation = 'DISTANCE'
    L.new(pos.outputs[0], dist.inputs[0]); L.new(ci.outputs['Location'], dist.inputs[1])
    dele = N.new('GeometryNodeDeleteGeometry'); L.new(pts.outputs['Points'], dele.inputs['Geometry'])
    L.new(op('LESS_THAN', dist.outputs['Value'], 1.7), dele.inputs['Selection'])
    L.new(dele.outputs['Geometry'], inst.inputs['Points']); L.new(info.outputs['Geometry'], inst.inputs['Instance'])
    L.new(sz.outputs[1], inst.inputs['Scale'])
    rot = N.new('FunctionNodeInputVector'); rot.vector = (0, -.1, 0)       # tilt with the wind
    L.new(rot.outputs[0], inst.inputs['Rotation'])
    L.new(inst.outputs['Instances'], outn.inputs[0])
    o.modifiers.new(name, 'NODES').node_group = g
    o.cycles.use_motion_blur = False      # wrap-around would smear across the frame
    return o

# ---------------------------------------------------------------- characters (Mixamo rigs + motion capture)
def import_char(file, height):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, file))
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    root = bpy.data.objects.new(file + '_root', None); sc.collection.objects.link(root)
    for o in new:
        if o.parent is None: o.parent = root
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    zs = [(o.matrix_world @ Vector(c)).z for o in new if o.type == 'MESH' for c in o.evaluated_get(dg).bound_box]
    root.scale = (height / (max(zs) - min(zs)),) * 3
    return root, arm, new

def loop_action(arm, name):
    act = bpy.data.actions[name]
    arm.animation_data.action = act
    for fc in act.fcurves:
        if not any(m.type == 'CYCLES' for m in fc.modifiers): fc.modifiers.new('CYCLES')
    return act

sol_root, sol, _ = import_char('Soldier.glb', 1.80)
walk = loop_action(sol, 'Walk')
mich_root, mich, _ = import_char('Michelle.glb', 1.68)
samba = bpy.data.actions['SambaDance']; mich.animation_data.action = samba

def walk_speed(arm, act):
    """(speed in m/frame, direction) — the planted foot slides backwards in an in-place clip;
    the root must move forwards at the same speed so the feet stay planted"""
    feet = [b for b in arm.pose.bones if b.name.lower().endswith('foot')][:2]
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    vel, prev = [], None
    for fr in range(f0, f1 + 1):
        sc.frame_set(fr)
        low = min((arm.matrix_world @ b.head for b in feet), key=lambda p: p.z)
        if prev is not None: vel.append(low.y - prev.y)
        prev = low
    vel.sort(); med = vel[len(vel) // 2]
    return abs(med), (-1 if med > 0 else 1)          # forward is opposite to the planted foot's slide

spd, fwd = walk_speed(sol, walk)
print('walk speed m/frame', spd, 'forward', fwd)
if fwd > 0:   # make the soldier face -Y (towards the cameras) whatever the clip's convention
    sol_root.rotation_euler = (0, 0, math.pi)
def key(o, fr, loc, interp='LINEAR'):
    o.location = loc; o.keyframe_insert('location', frame=fr)
S1Y0 = 6.0
S1Y1 = S1Y0 - spd * (SHOT2 - 2)
S2Y0 = 4.0
key(sol_root, 1, (-.6, S1Y0, 0)); key(sol_root, SHOT2 - 1, (-.6, S1Y1, 0))
key(sol_root, SHOT2, (-1.6, S2Y0, 0)); key(sol_root, END, (-1.6, S2Y0 - spd * (END - SHOT2), 0))
for fc in sol_root.animation_data.action.fcurves:
    for k in fc.keyframe_points:
        k.interpolation = 'CONSTANT' if int(k.co[0]) == SHOT2 - 1 else 'LINEAR'
mich_root.location = DANCE; mich_root.rotation_euler = (0, 0, math.radians(-25))
bpy.ops.object.light_add(type='AREA', location=(0, 2.2, 2.4)); rim = bpy.context.object
rim.data.energy = 140; rim.data.color = hexc('#6fa8ff'); rim.data.size = 1.5; rim.parent = sol_root
rim.rotation_euler = (math.radians(-60), 0, 0)
rim.scale = (1 / sol_root.scale[0],) * 3
rim.location = (0, -2.0 / sol_root.scale[0], 2.4 / sol_root.scale[0])

# ---------------------------------------------------------------- cameras
def camera(name, lens=35, fstop=2.2):
    c = bpy.data.cameras.new(name); c.lens = lens; c.dof.use_dof = True; c.dof.aperture_fstop = fstop
    o = bpy.data.objects.new(name, c); sc.collection.objects.link(o); return o
def look(o, target):
    d = Vector(target) - o.location; o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

cam1 = camera('cam1', 30, 2.0)
for fr, y in ((1, S1Y0), (SHOT2 - 1, S1Y1)):
    cam1.location = (.45, y - 3.6, .5); look(cam1, (-.6, y, 1.25))
    cam1.keyframe_insert('location', frame=fr); cam1.keyframe_insert('rotation_euler', frame=fr)
for fc in cam1.animation_data.action.fcurves:
    for k in fc.keyframe_points: k.interpolation = 'LINEAR'
cam1.data.dof.focus_distance = 3.7

cam2 = camera('cam2', 38, 2.2)
for fr in range(SHOT2, END + 1, 2):            # key along the arc so the dancer stays framed
    k = (fr - SHOT2) / (END - SHOT2); k = k * k * (3 - 2 * k) * .35 + k * .65
    r = 4.3 - .5 * k; ang = math.radians(-40 + 65 * k)
    cam2.location = (DANCE.x + math.sin(ang) * r, DANCE.y - math.cos(ang) * r, 1.3); look(cam2, (2.5, -6.0, .92))
    cam2.keyframe_insert('location', frame=fr); cam2.keyframe_insert('rotation_euler', frame=fr)
cam2.data.dof.focus_distance = 4.3
m1 = sc.timeline_markers.new('shot1', frame=1); m1.camera = cam1
m2 = sc.timeline_markers.new('shot2', frame=SHOT2); m2.camera = cam2
sc.camera = cam1
rain('rain_shot1', (-.2, 0), (11, 30), 6000, cam1, seed=1)
rain('rain_shot2', (1.5, -6), (12, 16), 4500, cam2, seed=2)

# ---------------------------------------------------------------- render + compositing
r = sc.render; r.engine = 'CYCLES'; r.resolution_x, r.resolution_y = (960, 540) if PREVIEW else (1280, 720); r.resolution_percentage = 100   # CPU-only budget
r.use_overwrite = False; r.use_placeholder = True   # a restarted render resumes where it stopped
r.use_persistent_data = True
cy = sc.cycles; cy.device = 'CPU'; cy.samples = 8 if PREVIEW else 14; cy.use_adaptive_sampling = True; cy.adaptive_threshold = .04
cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
cy.max_bounces = 4; cy.diffuse_bounces = 2; cy.glossy_bounces = 3; cy.transmission_bounces = 3; cy.transparent_max_bounces = 6
cy.caustics_reflective = False; cy.caustics_refractive = False; cy.blur_glossy = 1.0
r.use_motion_blur = not PREVIEW; r.motion_blur_shutter = .4
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
sc.view_settings.exposure = 0
vl = sc.view_layers[0]; vl.use_pass_mist = True

sc.use_nodes = True
nt = sc.node_tree; N = nt.nodes; L = nt.links
for n in list(N): N.remove(n)
rl = N.new('CompositorNodeRLayers')
glare = N.new('CompositorNodeGlare'); glare.glare_type = 'FOG_GLOW'; glare.quality = 'HIGH'
glare.inputs['Threshold'].default_value = .9; glare.inputs['Strength'].default_value = .9; glare.inputs['Size'].default_value = .7
haze_col = N.new('CompositorNodeRGB'); haze_col.outputs[0].default_value = (*hexc('#1b2240'), 1)
haze = N.new('CompositorNodeMixRGB'); haze.blend_type = 'SCREEN'
mistk = N.new('CompositorNodeMath'); mistk.operation = 'MULTIPLY'; mistk.inputs[1].default_value = .3
L.new(rl.outputs['Image'], glare.inputs['Image'])
L.new(rl.outputs['Mist'], mistk.inputs[0]); L.new(mistk.outputs[0], haze.inputs['Fac'])
L.new(glare.outputs['Image'], haze.inputs[1]); L.new(haze_col.outputs[0], haze.inputs[2])
vig_mask = N.new('CompositorNodeEllipseMask'); vig_mask.inputs['Size'].default_value = (.95, .9)
vig_blur = N.new('CompositorNodeBlur'); vig_blur.filter_type = 'GAUSS'; vig_blur.inputs['Size'].default_value = (220, 220)
L.new(vig_mask.outputs['Mask'], vig_blur.inputs['Image'])
vig = N.new('CompositorNodeMixRGB'); vig.blend_type = 'MULTIPLY'; vig.inputs['Fac'].default_value = 1
vig_ramp = N.new('CompositorNodeMapRange'); vig_ramp.inputs['To Min'].default_value = .55
L.new(vig_blur.outputs['Image'], vig_ramp.inputs['Value'])
L.new(haze.outputs['Image'], vig.inputs[1]); L.new(vig_ramp.outputs['Value'], vig.inputs[2])
out = N.new('CompositorNodeComposite'); L.new(vig.outputs['Image'], out.inputs['Image'])

os.makedirs(OUT, exist_ok=True)
r.filepath = os.path.join(OUT, '')
r.image_settings.file_format = 'PNG'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'out', 'scene.blend'))
print('scene built; walk speed', spd)
