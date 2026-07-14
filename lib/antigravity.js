/**
 * Antigravity — vanilla Three.js port of the React Bits <Antigravity /> component.
 *
 * The particle simulation below is a line-for-line port of the original R3F
 * component. Only the framework scaffolding changed:
 *
 *   R3F                          ->  vanilla
 *   ----------------------------------------------------------------
 *   <Canvas camera={...}>        ->  WebGLRenderer + PerspectiveCamera
 *   useThree().viewport          ->  computed from fov + camera distance
 *   useFrame(cb)                 ->  requestAnimationFrame loop
 *   state.pointer                ->  pointer in NDC from mousemove
 *   state.clock.getElapsedTime() ->  THREE.Clock
 *   <instancedMesh>              ->  new THREE.InstancedMesh(...)
 *   useMemo([count, vw, vh])     ->  rebuild particles when those change
 *
 * Keeping the math identical means the Next.js version we build later from the
 * original React source will look and behave exactly like what you tune here.
 */

import * as THREE from 'three';

const CAMERA_FOV = 35;
const CAMERA_Z = 50;

export const ANTIGRAVITY_DEFAULTS = {
  count: 300,
  magnetRadius: 10,
  ringRadius: 10,
  waveSpeed: 0.4,
  waveAmplitude: 1,
  particleSize: 2,
  lerpSpeed: 0.1,
  color: '#FF9FFC',
  autoAnimate: false,
  particleVariance: 1,
  rotationSpeed: 0,
  depthFactor: 1,
  pulseSpeed: 3,
  particleShape: 'capsule',
  fieldStrength: 10,
  opacity: 1,
};

/*
 * The brand mark as a particle.
 *
 * The Sovstac logo replaces the "O" with an empty structural frame — "a secure
 * perimeter, a dedicated private server, an isolated cloud environment". These
 * build that glyph as real geometry: bracket outlines, each a vertical stroke
 * with an arm at top and bottom, extruded to give them a little depth.
 */

const BR = {
  h: 0.30,    // half height
  arm: 0.16,  // how far the top/bottom arms reach in
  t: 0.05,    // stroke thickness
  gap: 0.10,  // half the space between the two brackets in a pair
};

/**
 * One bracket outline. `dir` is +1 for "[" (opens right) and -1 for "]".
 * `offset` shifts it along x, used to place the two halves of a pair.
 */
function bracketShape(dir, offset) {
  const { h, arm, t } = BR;
  const s = new THREE.Shape();

  // Outer spine, then back along each arm. Mirroring is just dir flipping the sign.
  const o = offset - dir * (arm / 2); // outer edge (the spine)
  const i = offset + dir * (arm / 2); // inner edge (the open side)

  s.moveTo(o, -h);
  s.lineTo(i, -h);
  s.lineTo(i, -h + t);
  s.lineTo(o + dir * t, -h + t);
  s.lineTo(o + dir * t, h - t);
  s.lineTo(i, h - t);
  s.lineTo(i, h);
  s.lineTo(o, h);
  s.closePath();
  return s;
}

function extrudeBrackets(shapes) {
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.04, bevelEnabled: false });
  geo.center(); // extrusion runs 0..depth on z; recentre so it spins about itself

  // Orientation. Every particle is placed with lookAt(target) + rotateX(90°), which
  // is tuned for the capsule — a rod that should point radially at the cursor. The
  // target shares the particle's z, so the look direction lies in the XY plane, and
  // working through that basis the particle's local X axis is what ends up facing the
  // camera. A flat glyph drawn in XY (normal +Z) therefore lands edge-on and reads as
  // a sliver. Rotating 90° about Y maps the glyph's normal onto local X, so the
  // bracket faces the viewer and spins in-plane as it orbits the ring.
  //
  // This also leaves the glyph's vertical axis on local Y — which is what lets the
  // 'bracket-single' shape mirror "[" into "]" with a 180° turn about Y.
  geo.rotateY(Math.PI / 2);
  return geo;
}

/** The full "[ ]" pair — the logo's frame. */
function makeBracketPairGeometry() {
  const { gap, arm } = BR;
  const d = gap + arm / 2;
  return extrudeBrackets([bracketShape(1, -d), bracketShape(-1, d)]);
}

/**
 * A single bracket, centred on itself. Instances are randomly flipped 180° about
 * their vertical axis at draw time, which turns "[" into "]" — so one geometry
 * gives a field of mixed opening and closing brackets. (An InstancedMesh shares
 * one geometry across every instance, so per-particle variety has to come from
 * the transform, not from swapping meshes.)
 */
function makeBracketSingleGeometry() {
  return extrudeBrackets([bracketShape(1, 0)]);
}

function makeGeometry(shape) {
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(0.2, 16, 16);
    case 'box':
      return new THREE.BoxGeometry(0.3, 0.3, 0.3);
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(0.3);
    case 'bracket':
      return makeBracketPairGeometry();
    case 'bracket-single':
      return makeBracketSingleGeometry();
    case 'capsule':
    default:
      return new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
  }
}

export function createAntigravity(container, userOpts = {}) {
  let opts = { ...ANTIGRAVITY_DEFAULTS, ...userOpts };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, {
    display: 'block',
    width: '100%',
    height: '100%',
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
  camera.position.set(0, 0, CAMERA_Z);

  // THREE.Clock is deprecated in r185; this is the same value it produced.
  const startedAt = performance.now();
  const elapsed = () => (performance.now() - startedAt) / 1000;

  const dummy = new THREE.Object3D();

  // r3f's `viewport` = visible world-space extent at the z=0 plane.
  const viewport = { width: 0, height: 0 };
  // r3f's `pointer` = normalised device coords, y-up, range [-1, 1].
  const pointer = { x: 0, y: 0 };

  const lastMousePos = { x: 0, y: 0 };
  let lastMouseMoveTime = 0;
  const virtualMouse = { x: 0, y: 0 };

  let particles = [];
  let mesh = null;
  let geometry = null;
  let material = null;
  let raf = null;
  let disposed = false;

  function buildParticles() {
    const temp = [];
    const width = viewport.width || 100;
    const height = viewport.height || 100;

    for (let i = 0; i < opts.count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -50 + Math.random() * 100;
      const yFactor = -50 + Math.random() * 100;
      const zFactor = -50 + Math.random() * 100;

      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      const z = (Math.random() - 0.5) * 20;

      const randomRadiusOffset = (Math.random() - 0.5) * 2;

      temp.push({
        t, factor, speed, xFactor, yFactor, zFactor,
        mx: x, my: y, mz: z,
        cx: x, cy: y, cz: z,
        vx: 0, vy: 0, vz: 0,
        randomRadiusOffset,
        // Decided once, here, rather than per-frame — otherwise a bracket would
        // flicker between "[" and "]" every tick. Only 'bracket-single' reads it.
        flipped: Math.random() < 0.5,
      });
    }
    particles = temp;
  }

  function buildMesh() {
    if (mesh) {
      scene.remove(mesh);
      mesh.dispose();
    }
    if (geometry) geometry.dispose();
    if (material) material.dispose();

    geometry = makeGeometry(opts.particleShape);
    material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.color),
      transparent: opts.opacity < 1,
      opacity: opts.opacity,
    });

    mesh = new THREE.InstancedMesh(geometry, material, opts.count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Particles fly far past the frustum bounds three would infer; skip the test.
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const prevW = viewport.width;
    const prevH = viewport.height;

    // Visible extent at the z=0 plane, the same quantity r3f exposes as `viewport`.
    viewport.height = 2 * Math.tan((CAMERA_FOV * Math.PI) / 180 / 2) * CAMERA_Z;
    viewport.width = viewport.height * camera.aspect;

    // Mirrors useMemo([count, viewport.width, viewport.height]) in the original.
    if (viewport.width !== prevW || viewport.height !== prevH) buildParticles();
  }

  function onPointerMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }

  /* ---- the simulation: ported verbatim from the R3F useFrame ---- */
  function frame() {
    const {
      magnetRadius, ringRadius, waveSpeed, waveAmplitude, particleSize,
      lerpSpeed, autoAnimate, particleVariance, rotationSpeed, depthFactor,
      pulseSpeed, fieldStrength,
    } = opts;

    const singleBracket = opts.particleShape === 'bracket-single';

    const v = viewport;
    const m = pointer;

    const mouseDist = Math.sqrt(
      Math.pow(m.x - lastMousePos.x, 2) + Math.pow(m.y - lastMousePos.y, 2)
    );

    if (mouseDist > 0.001) {
      lastMouseMoveTime = Date.now();
      lastMousePos.x = m.x;
      lastMousePos.y = m.y;
    }

    let destX = (m.x * v.width) / 2;
    let destY = (m.y * v.height) / 2;

    if (autoAnimate && Date.now() - lastMouseMoveTime > 2000) {
      const time = elapsed();
      destX = Math.sin(time * 0.5) * (v.width / 4);
      destY = Math.cos(time * 0.5 * 2) * (v.height / 4);
    }

    const smoothFactor = 0.05;
    virtualMouse.x += (destX - virtualMouse.x) * smoothFactor;
    virtualMouse.y += (destY - virtualMouse.y) * smoothFactor;

    const targetX = virtualMouse.x;
    const targetY = virtualMouse.y;

    const globalRotation = elapsed() * rotationSpeed;

    particles.forEach((particle, i) => {
      let { t, speed, mx, my, mz, cz, randomRadiusOffset } = particle;

      t = particle.t += speed / 2;

      const projectionFactor = 1 - cz / 50;
      const projectedTargetX = targetX * projectionFactor;
      const projectedTargetY = targetY * projectionFactor;

      const dx = mx - projectedTargetX;
      const dy = my - projectedTargetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const targetPos = { x: mx, y: my, z: mz * depthFactor };

      if (dist < magnetRadius) {
        const angle = Math.atan2(dy, dx) + globalRotation;

        const wave = Math.sin(t * waveSpeed + angle) * (0.5 * waveAmplitude);
        const deviation = randomRadiusOffset * (5 / (fieldStrength + 0.1));

        const currentRingRadius = ringRadius + wave + deviation;

        targetPos.x = projectedTargetX + currentRingRadius * Math.cos(angle);
        targetPos.y = projectedTargetY + currentRingRadius * Math.sin(angle);
        targetPos.z = mz * depthFactor + Math.sin(t) * (1 * waveAmplitude * depthFactor);
      }

      particle.cx += (targetPos.x - particle.cx) * lerpSpeed;
      particle.cy += (targetPos.y - particle.cy) * lerpSpeed;
      particle.cz += (targetPos.z - particle.cz) * lerpSpeed;

      dummy.position.set(particle.cx, particle.cy, particle.cz);

      dummy.lookAt(projectedTargetX, projectedTargetY, particle.cz);
      dummy.rotateX(Math.PI / 2);

      // Half the single brackets face the other way. rotateY turns the glyph about
      // its own vertical axis, mirroring "[" into "]".
      if (singleBracket && particle.flipped) dummy.rotateY(Math.PI);

      const currentDistToMouse = Math.sqrt(
        Math.pow(particle.cx - projectedTargetX, 2) +
          Math.pow(particle.cy - projectedTargetY, 2)
      );

      const distFromRing = Math.abs(currentDistToMouse - ringRadius);
      let scaleFactor = 1 - distFromRing / 10;

      scaleFactor = Math.max(0, Math.min(1, scaleFactor));

      const finalScale =
        scaleFactor *
        (0.8 + Math.sin(t * pulseSpeed) * 0.2 * particleVariance) *
        particleSize;
      dummy.scale.set(finalScale, finalScale, finalScale);

      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    frame();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  window.addEventListener('pointermove', onPointerMove);

  resize();
  buildParticles();
  buildMesh();
  loop();

  return {
    /** Apply new options, rebuilding only what actually needs rebuilding. */
    update(next = {}) {
      const prev = opts;
      opts = { ...opts, ...next };

      const countChanged = opts.count !== prev.count;
      const shapeChanged = opts.particleShape !== prev.particleShape;

      if (countChanged) buildParticles();
      if (countChanged || shapeChanged) {
        buildMesh();
      } else {
        material.color.set(opts.color);
        material.opacity = opts.opacity;
        material.transparent = opts.opacity < 1;
      }
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      if (mesh) {
        scene.remove(mesh);
        mesh.dispose();
      }
      geometry?.dispose();
      material?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
