# Builds the low-poly goat used by The Herd and writes assets/goat.glb.
#
#   blender --background --python tools/make_goat.py
#
# The goat faces +X and stands on the ground at z = 0 (Blender is Z up; the GLB comes out Y up).
# It is only ever seen small and from above, so the silhouette is what matters: long body,
# swept-back horns, beard, short upright tail. The UV x value marks the part of the goat so the
# shader can colour horns and hooves differently from the coat:
#   0 coat, 1 horn, 2 beard, 3 hoof

import math
import os

import bmesh
import bpy
from mathutils import Vector as V

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "assets", "goat.glb"))

COAT, HORN, BEARD, HOOF = 0, 1, 2, 3

bm = bmesh.new()
uv = bm.loops.layers.uv.new("part")


def tag(faces, part):
    for f in faces:
        for loop in f.loops:
            loop[uv].uv = ((part + 0.5) / 8.0, 0.5)


def loft(rings, part):
    """Skin a list of rings (each a list of points, same length) and cap both ends."""
    vr = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    faces = []
    for a, b in zip(vr, vr[1:]):
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
    faces.append(bm.faces.new(list(reversed(vr[0]))))
    faces.append(bm.faces.new(vr[-1]))
    tag(faces, part)


def body_ring(x, half_w, z_low, z_high, cut=0.36):
    """An eight-sided cross section in the YZ plane: a box with its corners cut."""
    cy = half_w * cut
    cz = (z_high - z_low) * cut * 0.5
    return [
        V((x, -half_w + cy, z_low)),
        V((x, half_w - cy, z_low)),
        V((x, half_w, z_low + cz)),
        V((x, half_w, z_high - cz)),
        V((x, half_w - cy, z_high)),
        V((x, -half_w + cy, z_high)),
        V((x, -half_w, z_high - cz)),
        V((x, -half_w, z_low + cz)),
    ]


def tube(path, radii, sides, part, spin=0.0):
    """Sweep an ellipse along a path. radii are (across, sideways) pairs, one per path point."""
    pts = [V(p) for p in path]
    rings = []
    for i, c in enumerate(pts):
        prev = pts[max(i - 1, 0)]
        nxt = pts[min(i + 1, len(pts) - 1)]
        t = (nxt - prev).normalized()
        ref = V((0, 1, 0)) if abs(t.y) < 0.9 else V((1, 0, 0))
        b = (ref - t * ref.dot(t)).normalized()
        n = t.cross(b).normalized()
        ra, rb = radii[i]
        ring = []
        for k in range(sides):
            a = spin + math.tau * k / sides
            ring.append(c + n * (ra * math.cos(a)) + b * (rb * math.sin(a)))
        rings.append(ring)
    loft(rings, part)


# ---- body: rump, belly, shoulder, chest
loft(
    [
        body_ring(-0.50, 0.090, 0.56, 0.80),
        body_ring(-0.40, 0.165, 0.47, 0.87),
        body_ring(-0.05, 0.195, 0.41, 0.85),
        body_ring(0.28, 0.170, 0.45, 0.87),
        body_ring(0.47, 0.105, 0.55, 0.85),
    ],
    COAT,
)

# ---- neck and head
tube([(0.36, 0, 0.72), (0.50, 0, 0.93), (0.60, 0, 1.08)], [(0.14, 0.115), (0.105, 0.09), (0.09, 0.08)], 6, COAT)
tube(
    [(0.52, 0, 1.12), (0.70, 0, 1.08), (0.84, 0, 1.01), (0.90, 0, 0.97)],
    [(0.085, 0.085), (0.080, 0.075), (0.055, 0.052), (0.040, 0.040)],
    6,
    COAT,
)

for s in (-1, 1):
    # ears, held out sideways and a little down
    tube([(0.60, s * 0.07, 1.13), (0.585, s * 0.15, 1.10), (0.57, s * 0.22, 1.04)], [(0.038, 0.020), (0.034, 0.018), (0.010, 0.008)], 4, COAT)
    # horns: up, then swept back in an arc and spreading apart
    tube(
        [
            (0.615, s * 0.045, 1.15),
            (0.575, s * 0.065, 1.30),
            (0.480, s * 0.095, 1.42),
            (0.350, s * 0.135, 1.47),
            (0.230, s * 0.175, 1.42),
            (0.160, s * 0.200, 1.33),
        ],
        [(0.046, 0.040), (0.042, 0.036), (0.036, 0.030), (0.028, 0.024), (0.018, 0.016), (0.006, 0.006)],
        4,
        HORN,
        spin=math.pi / 4,
    )
    # front legs
    x, y = 0.33, s * 0.115
    tube([(x, y, 0.52), (x, y, 0.27), (x, y, 0.07)], [(0.070, 0.062), (0.042, 0.040), (0.034, 0.034)], 4, COAT, spin=math.pi / 4)
    tube([(x, y, 0.075), (x, y, 0.0)], [(0.040, 0.040), (0.044, 0.044)], 4, HOOF, spin=math.pi / 4)
    # back legs, with the hock set a little behind
    x, y = -0.37, s * 0.125
    tube([(x + 0.02, y, 0.54), (x - 0.045, y, 0.28), (x, y, 0.07)], [(0.090, 0.068), (0.046, 0.042), (0.034, 0.034)], 4, COAT, spin=math.pi / 4)
    tube([(x, y, 0.075), (x, y, 0.0)], [(0.040, 0.040), (0.044, 0.044)], 4, HOOF, spin=math.pi / 4)

# ---- beard and tail
tube([(0.78, 0, 0.99), (0.775, 0, 0.90), (0.76, 0, 0.82)], [(0.034, 0.028), (0.026, 0.020), (0.006, 0.006)], 4, BEARD)
tube([(-0.47, 0, 0.80), (-0.54, 0, 0.88), (-0.58, 0, 0.97)], [(0.042, 0.036), (0.034, 0.028), (0.010, 0.010)], 4, COAT)

bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bmesh.ops.triangulate(bm, faces=bm.faces[:])

mesh = bpy.data.meshes.new("goat")
bm.to_mesh(mesh)
bm.free()

# start from an empty scene so nothing else is exported
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
goat = bpy.data.objects.new("goat", mesh)
bpy.context.scene.collection.objects.link(goat)
bpy.context.view_layer.objects.active = goat
goat.select_set(True)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="NONE",
    export_animations=False,
)

xs = [v.co.x for v in mesh.vertices]
zs = [v.co.z for v in mesh.vertices]
print(f"GOAT ok: {len(mesh.polygons)} triangles, x {min(xs):.2f}..{max(xs):.2f}, z {min(zs):.2f}..{max(zs):.2f}")
print(f"GOAT file: {OUT} ({os.path.getsize(OUT)} bytes)")
