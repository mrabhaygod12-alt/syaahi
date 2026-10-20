import type { SlideManifest } from "@/lib/presentations/hybrid/model";
import { visualNodes } from "@/lib/presentations/hybrid/visual";
/** Fixed authored camera curve. Source text never becomes animation code. */
export async function cameraTrack() {
  const { getProject, val } = await import("@theatre/core");
  const project = getProject("Syaahi visual director", {
    state: {
      definitionVersion: "0.4.0",
      revisionHistory: [],
      sheetsById: {
        Director: {
          staticOverrides: { byObject: {} },
          sequence: {
            type: "PositionalSequence",
            length: 1,
            subUnitsPerUnit: 60,
            tracksByObject: {
              Camera: {
                trackIdByPropPath: { '["progress"]': "camera-progress" },
                trackData: {
                  "camera-progress": {
                    type: "BasicKeyframedTrack",
                    keyframes: [
                      {
                        id: "start",
                        position: 0,
                        value: 0,
                        handles: [0.5, 1, 0.3, 0],
                        connectedRight: true,
                      },
                      {
                        id: "end",
                        position: 1,
                        value: 1,
                        handles: [0.7, 1, 0.5, 0],
                        connectedRight: false,
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  await project.ready;
  const sheet = project.sheet("Director"),
    object = sheet.object("Camera", { progress: 0 });
  return (position: number) => {
    sheet.sequence.position = Math.max(0, Math.min(1, position));
    return val(object.props.progress);
  };
}
/** Precompute a small bounded rigid-body motion; seeking reads fixed samples. */
export async function physicsMotion(s: SlideManifest) {
  const R = await import("@dimforge/rapier3d-compat");
  await R.init();
  const world = new R.World({ x: 0, y: 0, z: 0 }),
    nodes = visualNodes(s);
  try {
    world.timestep = 1 / 60;
    const bodies = nodes.map((n, i) => {
      const body = world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation((n.x - 250) / 100, (250 - n.y) / 100, n.z)
          .setLinvel(Math.sin(i) * 0.15, Math.cos(i) * 0.15, 0.1)
          .setLinearDamping(s.genome.damping * 4),
      );
      world.createCollider(
        R.ColliderDesc.ball(n.r / 90).setRestitution(0.6),
        body,
      );
      return body;
    });
    const samples: Float32Array[] = [];
    for (let frame = 0; frame <= 360; frame++) {
      const values = new Float32Array(nodes.length * 3);
      bodies.forEach((b, i) => {
        const p = b.translation();
        values.set([p.x, p.y, p.z], i * 3);
      });
      samples.push(values);
      world.step();
    }
    return (time: number, index: number) => {
      const at = Math.min(360, Math.max(0, time * 60)),
        a = Math.floor(at),
        b = Math.min(360, a + 1),
        t = at - a;
      return [0, 1, 2].map(
        (axis) =>
          samples[a][index * 3 + axis] * (1 - t) +
          samples[b][index * 3 + axis] * t,
      );
    };
  } finally {
    world.free();
  }
}
