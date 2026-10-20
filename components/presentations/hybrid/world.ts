import type { SlideManifest } from "@/lib/presentations/hybrid/model";
import { visualNodes } from "@/lib/presentations/hybrid/visual";
import type { VisualHandle } from "./renderers";
/** One retained scene and camera span the whole presenter narrative. */
export async function mountWorld(
  host: HTMLElement,
  slides: SlideManifest[],
  pick: (index: number) => void,
): Promise<VisualHandle> {
  const T = await import("three"),
    { cameraTrack } = await import("./choreography"),
    track = await cameraTrack().catch(() => (n: number) => n),
    canvas = document.createElement("canvas");
  host.append(canvas);
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(42, 1, 0.1, 400),
    sphere = new T.SphereGeometry(0.16, 16, 12),
    cube = new T.BoxGeometry(0.32, 0.32, 0.32),
    geometries: InstanceType<typeof T.BufferGeometry>[] = [sphere, cube],
    materials: Array<InstanceType<typeof T.Material>> = [],
    groups: InstanceType<typeof T.Group>[] = [],
    hits: InstanceType<typeof T.Mesh>[][] = [];
  scene.add(new T.AmbientLight(0xffffff, 2));
  const light = new T.DirectionalLight(0xffffff, 3);
  light.position.set(0, 4, 8);
  scene.add(light);
  slides.forEach((s, index) => {
    const group = new T.Group();
    group.position.x = index * 9;
    scene.add(group);
    groups.push(group);
    const a = new T.MeshStandardMaterial({
        color: s.genome.accent,
        roughness: 0.3,
        metalness: 0.2,
      }),
      b = new T.MeshStandardMaterial({
        color: s.genome.secondary,
        roughness: 0.35,
        metalness: 0.2,
      }),
      nodes = visualNodes(s),
      points = nodes.map(
        (p) => new T.Vector3((p.x - 250) / 100, (250 - p.y) / 100, p.z),
      );
    materials.push(a, b);
    hits[index] = points.map((p, i) => {
      const mesh = new T.Mesh(
        s.metaphor === "architecture" ? cube : sphere,
        i % 2 ? a : b,
      );
      mesh.position.copy(p);
      mesh.userData.fact = nodes[i].fact;
      mesh.scale.setScalar(nodes[i].r / 14);
      group.add(mesh);
      return mesh;
    });
    const geometry = new T.BufferGeometry().setFromPoints([
        ...points,
        points[0],
      ]),
      lineMaterial = new T.LineBasicMaterial({
        color: s.genome.secondary,
        transparent: true,
        opacity: 0.45,
      });
    geometries.push(geometry);
    materials.push(lineMaterial);
    group.add(new T.Line(geometry, lineMaterial));
  });
  let current = 0,
    initialized = false,
    orbitX = 0,
    orbitY = 0;
  const look = new T.Vector3(),
    target = new T.Vector3(),
    ray = new T.Raycaster();
  const resize = (w: number, h: number) => {
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, w), Math.max(1, h));
  };
  resize(host.clientWidth, host.clientHeight);
  const select = (e: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - box.left) / box.width) * 2 - 1,
        1 - ((e.clientY - box.top) / box.height) * 2,
      ),
      camera,
    );
    const hit = ray.intersectObjects(hits[current] || [])[0];
    if (hit) pick(hit.object.userData.fact);
  };
  canvas.addEventListener("pointerup", select);
  return {
    draw: (time, beat, word, director, index = 0) => {
      current = Math.max(0, Math.min(slides.length - 1, index));
      const progress = track(director),
        x = current * 9;
      target.set(
        x + Math.sin(progress * 0.8 + orbitX) * 3,
        orbitY + progress,
        7,
      );
      if (!initialized) {
        camera.position.copy(target);
        look.set(x, 0, 0);
        initialized = true;
      } else {
        camera.position.lerp(target, 0.12);
        look.lerp(new T.Vector3(x, 0, 0), 0.12);
      }
      camera.lookAt(look);
      light.position.x = camera.position.x;
      groups.forEach((g, i) => {
        g.visible = Math.abs(i - current) <= 2;
        g.rotation.y = time * slides[i].visual.speed * 0.12;
      });
      hits[current]?.forEach((m) => {
        m.scale.setScalar(1 + beat * 0.08 + word * 0.02);
      });
      renderer.render(scene, camera);
    },
    resize,
    orbit: (x, y) => {
      orbitX = x;
      orbitY = y;
    },
    memoryBytes: slides.length * 12 * 16 * 12 * 32,
    dispose: () => {
      canvas.removeEventListener("pointerup", select);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
