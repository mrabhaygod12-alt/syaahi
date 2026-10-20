import type { SlideManifest } from "@/lib/presentations/hybrid/model";
import type { Mesh as ThreeMesh } from "three";
import {
  visualNodes,
  VERTEX_SHADER,
  FRAGMENT_SHADER,
  randomSeed,
} from "@/lib/presentations/hybrid/visual";
export interface VisualHandle {
  draw: (
    time: number,
    beat: number,
    emphasis: number,
    camera: number,
    index?: number,
  ) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
  memoryBytes?: number;
  orbit?: (x: number, y: number) => void;
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
export async function mountVisual(
  host: HTMLElement,
  s: SlideManifest,
  onPick: (fact: number) => void,
): Promise<VisualHandle> {
  const width = () => Math.max(1, host.clientWidth),
    height = () => Math.max(1, host.clientHeight);
  const canvas = () => {
    const c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    host.append(c);
    return c;
  };
  const nodes = visualNodes(s),
    color = s.genome.accent;
  if (s.visualEngine === "three") {
    const { cameraTrack, physicsMotion } = await import("./choreography");
    const track = await cameraTrack().catch(() => (n: number) => n);
    const physics = s.visual.exploded
      ? await physicsMotion(s).catch(() => null)
      : null;
    const T = await import("three"),
      c = canvas(),
      renderer = new T.WebGLRenderer({
        canvas: c,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(width(), height());
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(42, width() / height(), 0.1, 60),
      group = new T.Group();
    scene.add(
      group,
      new T.AmbientLight(0xffffff, s.genome.lighting === "soft" ? 2.3 : 1.7),
    );
    const light = new T.DirectionalLight(
      s.genome.lighting === "neon" ? s.genome.secondary : 0xffffff,
      s.genome.lighting === "soft" ? 1.6 : 3,
    );
    light.position.set(-2, 4, 5);
    scene.add(light);
    const material = new T.MeshStandardMaterial({
        color,
        metalness: 0.35,
        roughness: 0.25,
      }),
      secondary = new T.MeshStandardMaterial({
        color: s.genome.secondary,
        metalness: 0.15,
        roughness: 0.3,
      });
    const meshes: ThreeMesh[] = [];
    for (const [i, p] of nodes.entries()) {
      const geometry =
        s.metaphor === "architecture"
          ? new T.BoxGeometry(0.38, 0.38, 0.38)
          : new T.SphereGeometry(p.r / 75, 24, 16);
      const mesh = new T.Mesh(geometry, i % 2 ? material : secondary);
      mesh.position.set((p.x - 250) / 100, (250 - p.y) / 100, p.z);
      mesh.userData.fact = p.fact;
      group.add(mesh);
      meshes.push(mesh);
    }
    const positions = nodes.flatMap((p, i) => {
      const q = nodes[(i + 1) % nodes.length];
      return [
        (p.x - 250) / 100,
        (250 - p.y) / 100,
        p.z,
        (q.x - 250) / 100,
        (250 - q.y) / 100,
        q.z,
      ];
    });
    const linesGeometry = new T.BufferGeometry();
    linesGeometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    const linesMaterial = new T.LineBasicMaterial({
      color: s.genome.secondary,
      transparent: true,
      opacity: 0.35,
    });
    group.add(new T.LineSegments(linesGeometry, linesMaterial));
    const ringGeometry = new T.TorusGeometry(2.05, 0.008, 8, 100),
      ringMaterial = new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
      });
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(ringGeometry, ringMaterial);
      ring.rotation.set(i * 0.7, 0.6 + i * 0.8, 0.2);
      group.add(ring);
    }
    const ray = new T.Raycaster(),
      pointer = new T.Vector2();
    let orbitX = 0,
      orbitY = 0;
    const pick = (event: PointerEvent) => {
      const box = c.getBoundingClientRect();
      pointer.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        -((event.clientY - box.top) / box.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(meshes)[0];
      if (hit) onPick(Number(hit.object.userData.fact));
    };
    c.addEventListener("pointerup", pick);
    return {
      draw: (time, beat, emphasis, director) => {
        const t = time * s.visual.speed;
        director = track(director);
        camera.position.set(
          Math.sin(director * Math.PI * 0.6 + orbitX) * 7,
          orbitY + Math.sin(director * Math.PI) * 1.3,
          7,
        );
        camera.lookAt(0, 0, 0);
        group.rotation.y = t * 0.12;
        group.rotation.x = Math.sin(t * 0.2) * 0.08;
        meshes.forEach((m, i) => {
          m.scale.setScalar(1 + beat * 0.1 + emphasis * 0.025);
          if (physics) {
            const p = physics(t, i);
            m.position.set(p[0], p[1], p[2]);
          } else m.position.z = nodes[i].z + Math.sin(t + i) * 0.06;
        });
        renderer.render(scene, camera);
      },
      resize: (w, h) => {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      },
      orbit: (x, y) => {
        orbitX = x;
        orbitY = y;
      },
      memoryBytes: positions.length * 4 + meshes.length * 24 * 16 * 32,
      dispose: () => {
        c.removeEventListener("pointerup", pick);
        meshes.forEach((m) => m.geometry.dispose());
        material.dispose();
        secondary.dispose();
        linesGeometry.dispose();
        linesMaterial.dispose();
        ringGeometry.dispose();
        ringMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        c.remove();
      },
    };
  }
  if (s.visualEngine === "babylon") {
    const { Engine } = await import("@babylonjs/core/Engines/engine"),
      { Scene } = await import("@babylonjs/core/scene"),
      { Vector3, Color3, Color4 } = await import("@babylonjs/core/Maths/math"),
      { FreeCamera } = await import("@babylonjs/core/Cameras/freeCamera"),
      { HemisphericLight } =
        await import("@babylonjs/core/Lights/hemisphericLight"),
      { MeshBuilder } = await import("@babylonjs/core/Meshes/meshBuilder"),
      { StandardMaterial } =
        await import("@babylonjs/core/Materials/standardMaterial");
    const c = canvas(),
      engine = new Engine(c, true, {
        preserveDrawingBuffer: false,
        stencil: false,
      }),
      scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0);
    const camera = new FreeCamera("director", new Vector3(0, 0, -7), scene);
    camera.setTarget(Vector3.Zero());
    new HemisphericLight("key", new Vector3(0, 1, 0), scene);
    const material = new StandardMaterial("brand", scene);
    material.diffuseColor = Color3.FromHexString(color);
    const meshes = nodes.map((p, i) => {
      const m = MeshBuilder.CreateSphere(
        `fact-${i}`,
        { diameter: p.r / 35, segments: 20 },
        scene,
      );
      m.position = new Vector3((p.x - 250) / 100, (250 - p.y) / 100, p.z);
      m.material = material;
      return m;
    });
    engine.setSize(width(), height());
    return {
      draw: (t, beat, _word, director) => {
        camera.position.x = Math.sin(director * 2) * 3;
        camera.setTarget(Vector3.Zero());
        meshes.forEach((m, i) => {
          m.rotation.y = t * 0.3;
          m.scaling.setAll(1 + beat * 0.1);
          m.position.y =
            (250 - nodes[i].y) / 100 + Math.sin(t * s.visual.speed + i) * 0.1;
        });
        scene.render();
      },
      resize: (w, h) => engine.setSize(w, h),
      dispose: () => {
        scene.dispose();
        engine.dispose();
        c.remove();
      },
    };
  }
  if (s.visualEngine === "ogl") {
    const { Renderer, Camera, Transform, Mesh, Sphere, Program } =
        await import("ogl"),
      renderer = new Renderer({
        alpha: true,
        dpr: Math.min(devicePixelRatio, 1.5),
      }),
      gl = renderer.gl;
    host.append(gl.canvas);
    renderer.setSize(width(), height());
    const camera = new Camera(gl, { fov: 42 });
    camera.position.z = 7;
    const scene = new Transform();
    const program = new Program(gl, {
      vertex: `attribute vec3 position;attribute vec3 normal;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;varying vec3 vN;void main(){vN=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragment: `precision mediump float;varying vec3 vN;uniform vec3 brand;void main(){float l=.4+.6*max(0.,dot(normalize(vN),normalize(vec3(-1.,2.,3.))));gl_FragColor=vec4(brand*l,1.);}`,
      uniforms: { brand: { value: rgb(color) } },
    });
    const geometry = new Sphere(gl, {
      radius: 0.2,
      widthSegments: 20,
      heightSegments: 12,
    });
    const meshes = nodes.map((p) => {
      const mesh = new Mesh(gl, { geometry, program });
      mesh.position.set((p.x - 250) / 100, (250 - p.y) / 100, p.z);
      mesh.scale.set(p.r / 15);
      mesh.setParent(scene);
      return mesh;
    });
    camera.perspective({ aspect: width() / height() });
    return {
      draw: (t, beat, _word, director) => {
        camera.position.x = Math.sin(director * 2) * 2;
        camera.lookAt([0, 0, 0]);
        meshes.forEach((m, i) => {
          m.rotation.y = t * 0.1;
          m.scale.set((nodes[i].r / 15) * (1 + beat * 0.1));
        });
        renderer.render({ scene, camera });
      },
      resize: (w, h) => {
        renderer.setSize(w, h);
        camera.perspective({ aspect: w / h });
      },
      dispose: () => {
        geometry.remove();
        program.remove();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        gl.canvas.remove();
      },
    };
  }
  if (s.visualEngine === "pixi") {
    // Pixi's CSP adapter replaces generated JavaScript with static implementations.
    await import("pixi.js/unsafe-eval");
    const { Application, Graphics } = await import("pixi.js"),
      app = new Application();
    await app.init({
      width: width(),
      height: height(),
      backgroundAlpha: 0,
      antialias: true,
      autoStart: false,
      preference: "webgl",
      resolution: Math.min(devicePixelRatio, 1.5),
    });
    host.append(app.canvas);
    const art = new Graphics();
    app.stage.addChild(art);
    return {
      draw: (t, beat) => {
        const scale = Math.min(width(), height()) / 500;
        art.clear();
        nodes.forEach((p, i) => {
          const q = nodes[(i + 1) % nodes.length];
          art
            .moveTo(p.x * scale, p.y * scale)
            .lineTo(q.x * scale, q.y * scale)
            .stroke({ width: 1.2, color: s.genome.secondary, alpha: 0.35 });
          art
            .circle(
              p.x * scale,
              (p.y + Math.sin(t * s.visual.speed + i) * 3) * scale,
              p.r * scale * (1 + beat * 0.1),
            )
            .fill({ color: i % 2 ? color : s.genome.secondary, alpha: 0.85 });
        });
        app.renderer.render(app.stage);
      },
      resize: (w, h) => app.renderer.resize(w, h),
      dispose: () => {
        app.destroy(true, { children: true });
      },
    };
  }
  if (s.visualEngine === "two") {
    const Two = (await import("two.js")).default,
      two = new Two({
        width: width(),
        height: height(),
        autostart: false,
        type: Two.Types.svg,
      }).appendTo(host);
    const shapes = nodes.map((p, i) => {
      const q = nodes[(i + 1) % nodes.length],
        line = two.makeLine(p.x, p.y, q.x, q.y);
      line.stroke = s.genome.secondary;
      line.opacity = 0.3;
      const circle = two.makeCircle(p.x, p.y, p.r);
      circle.fill = i % 2 ? color : s.genome.secondary;
      circle.noStroke();
      return circle;
    });
    two.scene.scale = Math.min(width(), height()) / 500;
    return {
      draw: (t, beat) => {
        shapes.forEach((p, i) => {
          p.translation.y = nodes[i].y + Math.sin(t * s.visual.speed + i) * 3;
          p.scale = 1 + beat * 0.1;
        });
        two.update();
      },
      resize: (w, h) => {
        two.width = w;
        two.height = h;
        two.scene.scale = Math.min(w, h) / 500;
        two.update();
      },
      dispose: () => {
        two.clear();
        two.renderer.domElement.remove();
      },
    };
  }
  if (s.visualEngine === "p5") {
    const P5 = (await import("p5")).default;
    let time = 0,
      beat = 0;
    const p = new P5((p: any) => {
      p.setup = () => {
        p.createCanvas(width(), height());
        p.noLoop();
      };
      p.draw = () => {
        p.clear();
        p.noFill();
        p.stroke(color);
        p.strokeWeight(1.2);
        p.translate(p.width / 2, p.height / 2);
        const scale = Math.min(p.width, p.height) / 500;
        for (let j = 0; j < 8; j++) {
          p.beginShape();
          for (let i = 0; i <= 100; i++) {
            const a = (i / 100) * Math.PI * 2,
              r =
                (95 +
                  j * 15 +
                  Math.sin(a * 5 + time * s.visual.speed + j) * 9) *
                (1 + beat * 0.08);
            p.vertex(Math.cos(a) * r * scale, Math.sin(a) * r * 0.65 * scale);
          }
          p.endShape();
        }
      };
    }, host);
    return {
      draw: (t, b) => {
        time = t;
        beat = b;
        p.redraw();
      },
      resize: (w, h) => p.resizeCanvas(w, h),
      dispose: () => p.remove(),
    };
  }
  if (s.visualEngine === "spline") {
    if (!s.visual.splineAssetId)
      throw new Error("Import an owned Spline scene to use this renderer.");
    const { Application } = await import("@splinetool/runtime"),
      c = canvas(),
      app = new Application(c, { renderMode: "manual" });
    await app.load(`/api/presentations/scene-assets/${s.visual.splineAssetId}`);
    return {
      draw: () => app.requestRender(),
      resize: (w, h) => app.setSize(w, h),
      dispose: () => {
        app.dispose();
        c.remove();
      },
    };
  }
  if (s.visualEngine === "webgpu") return mountGpu(host, s);
  if (s.visualEngine === "curtains") {
    const { Curtains, Plane } = await import("curtainsjs"),
      curtains = new Curtains({
        container: host,
        autoRender: false,
        alpha: true,
        pixelRatio: Math.min(devicePixelRatio, 1.5),
      }),
      element = document.createElement("div");
    element.style.cssText = "position:absolute;inset:0";
    host.append(element);
    const plane = new Plane(curtains, element, {
      vertexShader: `precision mediump float;attribute vec3 aVertexPosition;attribute vec2 aTextureCoord;uniform mat4 uMVMatrix;uniform mat4 uPMatrix;varying vec2 vUv;void main(){vUv=aTextureCoord;gl_Position=uPMatrix*uMVMatrix*vec4(aVertexPosition,1.);}`,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        time: { name: "u_time", type: "1f", value: 0 },
        beat: { name: "u_audioBeat", type: "1f", value: 0 },
        word: { name: "u_wordEmphasis", type: "1f", value: 0 },
        brand: { name: "u_accent", type: "3f", value: rgb(color) },
      },
    });
    return {
      draw: (t, beat, word) => {
        plane.uniforms.time.value = t;
        plane.uniforms.beat.value = beat;
        plane.uniforms.word.value = word;
        curtains.render();
      },
      resize: () => curtains.resize(),
      dispose: () => {
        plane.remove();
        curtains.dispose();
        element.remove();
      },
    };
  }
  const c = canvas(),
    gl = c.getContext("webgl", { alpha: true, antialias: false });
  if (!gl) throw new Error("WebGL is unavailable.");
  const shader = (kind: number, code: string) => {
    const sh = gl.createShader(kind)!;
    gl.shaderSource(sh, code);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error("The shader could not compile.");
    return sh;
  };
  const vertex = shader(gl.VERTEX_SHADER, VERTEX_SHADER),
    fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER),
    program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error("The shader could not link.");
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const pos = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform3fv(gl.getUniformLocation(program, "u_accent"), rgb(color));
  const resize = (w: number, h: number) => {
    c.width = Math.round(w * Math.min(devicePixelRatio, 1.5));
    c.height = Math.round(h * Math.min(devicePixelRatio, 1.5));
    gl.viewport(0, 0, c.width, c.height);
  };
  resize(width(), height());
  return {
    draw: (t, beat, word) => {
      gl.uniform1f(
        gl.getUniformLocation(program, "u_time"),
        t * s.visual.speed,
      );
      gl.uniform1f(gl.getUniformLocation(program, "u_audioBeat"), beat);
      gl.uniform1f(gl.getUniformLocation(program, "u_wordEmphasis"), word);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    resize,
    memoryBytes: 48,
    dispose: () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      c.remove();
    },
  };
}
async function mountGpu(
  host: HTMLElement,
  s: SlideManifest,
): Promise<VisualHandle> {
  const gpu = (navigator as any).gpu;
  if (!gpu) throw new Error("WebGPU is not supported on this device.");
  const adapter = await gpu.requestAdapter({ powerPreference: "low-power" });
  if (!adapter) throw new Error("No WebGPU adapter.");
  const device = await adapter.requestDevice();
  let lost = false;
  void device.lost.then(() => {
    lost = true;
  });
  device.addEventListener("uncapturederror", () => {
    lost = true;
  });
  const c = document.createElement("canvas");
  host.append(c);
  const context = (c as any).getContext("webgpu");
  if (!context) throw new Error("No WebGPU context.");
  const format = gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });
  const count = Math.round(20000 + s.visual.density * 80000),
    rand = randomSeed(s.visual.seed),
    positions = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    positions[i * 4] = rand() * 2 - 1;
    positions[i * 4 + 1] = rand() * 2 - 1;
    positions[i * 4 + 2] = (rand() - 0.5) * 0.002;
    positions[i * 4 + 3] = (rand() - 0.5) * 0.002;
  }
  const storage = device.createBuffer({
    size: positions.byteLength,
    usage: 128 | 8 | 4,
    mappedAtCreation: true,
  });
  new Float32Array(storage.getMappedRange()).set(positions);
  storage.unmap();
  const clock = device.createBuffer({ size: 16, usage: 64 | 8 });
  const compute = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: `struct Point{p:vec2f,v:vec2f};@group(0) @binding(0) var<storage,read_write> points:array<Point>;@group(0) @binding(1) var<uniform> clock:vec4f;@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=${count}u){return;}let a=f32(i)*2.399963;let r=sqrt(f32(i)/${count}.);let t=clock.x*.13;points[i].p=vec2f(cos(a+t*(1.+r)),sin(a+t*(1.+r)))*r*(.9+clock.y*.08);}`,
      }),
      entryPoint: "main",
    },
  });
  const col = rgb(s.genome.accent),
    render = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: device.createShaderModule({
          code: `struct Point{p:vec2f,v:vec2f};@group(0) @binding(0) var<storage,read> points:array<Point>;@vertex fn main(@builtin(vertex_index) v:u32,@builtin(instance_index) i:u32)->@builtin(position) vec4f{let offsets=array<vec2f,6>(vec2f(-1.,-1.),vec2f(1.,-1.),vec2f(-1.,1.),vec2f(-1.,1.),vec2f(1.,-1.),vec2f(1.,1.));return vec4f(points[i].p+offsets[v]*.0015,0.,1.);}`,
        }),
        entryPoint: "main",
      },
      fragment: {
        module: device.createShaderModule({
          code: `@fragment fn main()->@location(0) vec4f{return vec4f(${col[0]},${col[1]},${col[2]},.55);}`,
        }),
        entryPoint: "main",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
  const cb = device.createBindGroup({
      layout: compute.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: storage } },
        { binding: 1, resource: { buffer: clock } },
      ],
    }),
    rb = device.createBindGroup({
      layout: render.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: storage } }],
    });
  const resize = (w: number, h: number) => {
    c.width = Math.round(w);
    c.height = Math.round(h);
  };
  resize(host.clientWidth, host.clientHeight);
  return {
    draw: (time, beat) => {
      if (lost) throw new Error("The WebGPU device became unavailable.");
      device.queue.writeBuffer(
        clock,
        0,
        new Float32Array([time * s.visual.speed, beat, 0, 0]),
      );
      const encoder = device.createCommandEncoder(),
        cp = encoder.beginComputePass();
      cp.setPipeline(compute);
      cp.setBindGroup(0, cb);
      cp.dispatchWorkgroups(Math.ceil(count / 256));
      cp.end();
      const rp = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      });
      rp.setPipeline(render);
      rp.setBindGroup(0, rb);
      rp.draw(6, count);
      rp.end();
      device.queue.submit([encoder.finish()]);
    },
    resize,
    memoryBytes: positions.byteLength + 16,
    dispose: () => {
      storage.destroy();
      clock.destroy();
      device.destroy();
      c.remove();
    },
  };
}
