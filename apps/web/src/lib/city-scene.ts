// The living 3D city behind the public pages (ported from the living-3d-site kit).
// Buildings rise on load; scrolling flies the camera through the city and turns dusk
// into night. Colours come from CSS custom properties on the `root` element:
// --lp-bg, --lp-accent, --lp-scene-base, --lp-scene-window, --lp-surface-solid.
//
// This module is loaded with a dynamic import() so three.js stays out of the main bundle.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export type CityOptions = {
  seed?: number
  skyline?: 'low' | 'mixed' | 'towers'
  landmark?: boolean
  /** Calmer fixed-height camera for inner pages. */
  mini?: boolean
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Starts the scene. Returns a stop function, or null when WebGL is not available. */
export function startCityScene(canvas: HTMLCanvasElement, root: HTMLElement, opts: CityOptions = {}): (() => void) | null {
  const SEED = opts.seed ?? 19
  const SKYLINE = opts.skyline ?? 'low'
  const LANDMARK = opts.landmark !== false
  const mini = !!opts.mini
  const css = getComputedStyle(root)
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const small = innerWidth < 760
  // Light mode: a cream sky with sage-green buildings (no bloom, no night).
  const LIGHT = token('--lp-scene-light', '0') === '1'

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' })
  } catch {
    return null
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75))
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.toneMapping = LIGHT ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping

  const FOG = new THREE.Color(token('--lp-bg', '#160f0b'))
  const ACCENT = token('--lp-accent', '#f08a3c')
  const scene = new THREE.Scene()
  scene.background = FOG
  const camera = new THREE.PerspectiveCamera(small ? 55 : 42, innerWidth / innerHeight, 0.1, 400)

  // ---------- Buildings (one instanced mesh) ----------
  const N = small ? 15 : mini ? 19 : 23
  const STEP = 1.7
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const seeds: number[] = []
  const heights: number[] = []
  const mats: THREE.Matrix4[] = []
  const dummy = new THREE.Object3D()
  const rand = mulberry32(SEED)

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = (i - (N - 1) / 2) * STEP
      const z = (j - (N - 1) / 2) * STEP
      if (i % 5 === 2 || j % 6 === 3) continue
      if (LANDMARK && Math.abs(x) < 2.6 && Math.abs(z) < 2.6) continue
      if (rand() < 0.08) continue
      const d = Math.hypot(x, z)
      let h: number
      if (SKYLINE === 'towers') {
        h = 1 + rand() * 2 + Math.max(0, 9 - d * 0.55) * (0.4 + rand() * 0.8)
      } else if (SKYLINE === 'mixed') {
        h = 0.6 + rand() * 2.2
        if (rand() < 0.15 && d < 16) h = 3.5 + rand() * 5
      } else {
        h = 0.5 + rand() * 1.4
        if (rand() < 0.06 && d < 14) h = 3 + rand() * 4
      }
      dummy.position.set(x + (rand() - 0.5) * 0.25, 0, z + (rand() - 0.5) * 0.25)
      dummy.rotation.y = 0
      dummy.scale.set(0.8 + rand() * 0.55, 1, 0.8 + rand() * 0.55)
      dummy.updateMatrix()
      mats.push(dummy.matrix.clone())
      seeds.push(rand())
      heights.push(h)
    }
  }
  const count = mats.length
  const uniforms = {
    uGrow: { value: reduce ? 1 : 0 },
    uTime: { value: 0 },
    uNight: { value: LIGHT ? 0.5 : 0.35 },
    uLight: { value: LIGHT ? 1 : 0 },
    uBase: { value: new THREE.Color(token('--lp-scene-base', '#4a3322')) },
    uGlow: { value: new THREE.Color(ACCENT) },
    uWin: { value: new THREE.Color(token('--lp-scene-window', '#ffd9a0')) },
    uFog: { value: FOG },
    uFogNear: { value: 18 },
    uFogFar: { value: 70 },
  }
  const bmat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aSeed; attribute float aHeight;
      uniform float uGrow;
      varying vec3 vPos; varying vec3 vN; varying float vSeed; varying float vLy; varying float vDepth; varying float vTop; varying vec3 vUnit;
      void main(){
        vUnit = position;
        float d = length(instanceMatrix[3].xz);
        float g = clamp(uGrow * 1.8 - d / 28.0, 0.0, 1.0);
        g = g * g * (3.0 - 2.0 * g);
        vec3 p = position;
        p.y *= aHeight * max(g, 0.002);
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vPos = wp.xyz; vLy = position.y * aHeight; vSeed = aSeed; vTop = aHeight;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vec4 mv = viewMatrix * wp; vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uGlow, uWin, uFog; uniform float uTime, uNight, uFogNear, uFogFar, uLight;
      varying vec3 vPos; varying vec3 vN; varying float vSeed; varying float vLy; varying float vDepth; varying float vTop; varying vec3 vUnit;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        vec3 n = normalize(vN);
        float side = 1.0 - step(0.5, abs(n.y));
        float along = abs(n.x) > 0.5 ? vPos.z : vPos.x;
        float fy = fract(vLy * 3.2), fx = fract(along * 2.4);
        float win = step(0.3, fy) * step(fy, 0.72) * step(0.25, fx) * step(fx, 0.75) * side;
        float cell = floor(vLy * 3.2) * 17.0 + floor(along * 2.4) * 3.0 + vSeed * 91.0;
        float r = hash(cell);
        float on = step(1.0 - 0.55 * uNight, r) * (0.75 + 0.25 * sin(uTime * 0.7 + r * 30.0));
        vec3 warm = mix(uWin, uGlow, step(0.86, r));
        vec3 col = uBase * (0.5 + 0.6 * max(dot(n, normalize(vec3(0.5, 0.9, 0.3))), 0.0));
        col += warm * win * on * (0.35 + 1.25 * uNight);
        float roof = step(0.5, n.y);
        col = mix(col, uGlow * 0.22, roof * 0.35);
        col += uGlow * 0.10 * (1.0 - clamp(vLy / 2.0, 0.0, 1.0)) * side;
        vec2 e2 = abs(vUnit.xz) * 2.0;
        float vEdge = side * smoothstep(0.94, 0.995, max(abs(n.x) > 0.5 ? e2.y : e2.x, 0.0));
        float rEdge = roof * smoothstep(0.90, 0.99, max(e2.x, e2.y));
        float topBand = side * smoothstep(0.975, 1.0, vUnit.y);
        float edgeGlow = max(max(vEdge, rEdge), topBand);
        float flick = 0.75 + 0.25 * sin(uTime * 1.3 + vSeed * 40.0);
        col += uGlow * edgeGlow * (0.22 + 0.38 * vSeed) * flick;
        if (uLight > 0.5) {
          // Daylight: shaded sage walls, small warm lit windows, green roof and edge lines
          vec3 lc = uBase * (0.62 + 0.5 * max(dot(n, normalize(vec3(0.5, 0.9, 0.3))), 0.0));
          lc *= mix(0.78, 1.0, clamp(vLy / 2.0, 0.0, 1.0));
          lc = mix(lc, uWin, win * step(0.45, r) * 0.9);
          lc = mix(lc, uGlow, roof * 0.35);
          lc = mix(lc, uGlow, edgeGlow * 0.55 * flick);
          col = lc;
        }
        float f = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(col, uFog, f), 1.0);
      }`,
  })
  const ig = geo.clone()
  ig.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1))
  ig.setAttribute('aHeight', new THREE.InstancedBufferAttribute(new Float32Array(heights), 1))
  const town = new THREE.InstancedMesh(ig, bmat, count)
  mats.forEach((m, k) => town.setMatrixAt(k, m))
  town.frustumCulled = false
  scene.add(town)

  // ---------- Landmark: a glowing outline at the centre ----------
  const station = new THREE.Group()
  const stGeo = new THREE.BoxGeometry(3.4, 1.3, 1.6).translate(0, 0.65, 0)
  const stMesh = new THREE.Mesh(stGeo, new THREE.MeshBasicMaterial({ color: token('--lp-surface-solid', '#1f1610') }))
  const stLines = new THREE.LineSegments(new THREE.EdgesGeometry(stGeo), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.95 }))
  station.add(stMesh, stLines)
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 14, 6, 1, true).translate(0, 7, 0),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.35 }),
  )
  station.add(beacon)
  station.scale.y = reduce ? 1 : 0.001
  if (LANDMARK) scene.add(station)

  // ---------- Ground: grid, roads and a scanning pulse ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uFog: uniforms.uFog, uGlow: uniforms.uGlow, uNight: uniforms.uNight, uLight: uniforms.uLight },
      transparent: false,
      vertexShader: `varying vec3 vP; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vP=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `
      uniform float uTime, uNight, uLight; uniform vec3 uFog, uGlow; varying vec3 vP; varying float vD;
      float line(float c, float w){ float f = abs(fract(c - 0.5) - 0.5) / fwidth(c); return 1.0 - min(f / w, 1.0); }
      void main(){
        vec2 p = vP.xz / 1.7;
        float g = max(line(p.x, 1.0), line(p.y, 1.0)) * 0.10;
        float big = max(line(p.x / 5.0, 1.2), line(p.y / 6.0, 1.2)) * 0.28;
        float r = length(vP.xz);
        float wave = fract(r / 46.0 - uTime * 0.09);
        float pulse = smoothstep(0.0, 0.015, wave) * (1.0 - smoothstep(0.015, 0.06, wave)) * 0.9;
        vec3 col = vec3(0.035, 0.022, 0.012) + uGlow * (g + big + pulse * (0.4 + big * 2.0));
        col += uGlow * 0.16 * exp(-r * 0.22);
        if (uLight > 0.5) {
          col = mix(uFog, uGlow, clamp((g + big + pulse * (0.4 + big * 2.0)) * 0.9, 0.0, 0.5));
        }
        float f = smoothstep(14.0, 80.0, vD);
        gl_FragColor = vec4(mix(col, uFog, f), 1.0);
      }`,
    }),
  )
  ground.position.y = -0.001
  scene.add(ground)

  // ---------- Particles drifting upwards ----------
  const P = small ? 260 : 700
  const pPos = new Float32Array(P * 3)
  const pSpd = new Float32Array(P)
  for (let k = 0; k < P; k++) {
    pPos[k * 3] = (rand() - 0.5) * 70
    pPos[k * 3 + 1] = rand() * 16
    pPos[k * 3 + 2] = (rand() - 0.5) * 70
    pSpd[k] = 0.2 + rand() * 0.6
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  const dots = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: new THREE.Color(ACCENT).lerp(new THREE.Color('#ffffff'), LIGHT ? 0 : 0.35), size: small ? 0.09 : 0.07, transparent: true, opacity: LIGHT ? 0.5 : 0.75, depthWrite: false, blending: LIGHT ? THREE.NormalBlending : THREE.AdditiveBlending }),
  )
  scene.add(dots)

  // ---------- Bloom (desktop only) ----------
  let composer: EffectComposer | null = null
  if (!small && !LIGHT) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.3))
    composer.addPass(new OutputPass())
  }

  // ---------- Camera: mouse parallax + scroll ----------
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
  const onPointer = (e: PointerEvent) => {
    mouse.tx = e.clientX / innerWidth - 0.5
    mouse.ty = e.clientY / innerHeight - 0.5
  }
  addEventListener('pointermove', onPointer, { passive: true })

  const state = { hero: 0, page: 0 }
  const readScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight)
    state.page = scrollY / max
    state.hero = Math.min(1, scrollY / innerHeight)
  }
  readScroll()
  addEventListener('scroll', readScroll, { passive: true })

  let stopped = false
  let frame = 0
  if (!reduce) {
    const t0 = performance.now()
    const rise = () => {
      if (stopped) return
      const k = Math.min(1, (performance.now() - t0) / 2600)
      const e = 1 - Math.pow(1 - k, 3)
      uniforms.uGrow.value = e
      station.scale.y = Math.max(0.001, Math.min(1, (k - 0.35) / 0.4))
      if (k < 1) requestAnimationFrame(rise)
    }
    rise()
  }
  root.classList.add('scene-ready')

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight, false)
    composer?.setSize(innerWidth, innerHeight)
    readScroll()
  }
  addEventListener('resize', onResize)

  const clock = new THREE.Clock()
  let running = true
  const onVisibility = () => {
    running = !document.hidden
    if (running && !stopped) {
      clock.getDelta()
      loop()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  function loop() {
    if (!running || stopped) return
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime
    uniforms.uTime.value = t
    mouse.x += (mouse.tx - mouse.x) * 0.05
    mouse.y += (mouse.ty - mouse.y) * 0.05

    // Time of day follows the page: dusk at the top, deep night further down.
    uniforms.uNight.value = LIGHT ? 0.5 : mini ? 0.6 : 0.35 + 0.65 * Math.min(1, state.page * 1.6 + state.hero * 0.3)

    const drift = reduce ? 0 : t * 0.025
    const ang = 0.75 + state.page * Math.PI * 1.1 + drift + mouse.x * 0.25
    const radius = mini ? 30 : 34 - state.hero * 12 + Math.sin(state.page * Math.PI) * 4
    const height = mini ? 15 : 19 - state.hero * 9 + state.page * 4
    camera.position.set(Math.cos(ang) * radius, height - mouse.y * 3, Math.sin(ang) * radius)
    camera.lookAt(0, mini ? 0 : 1.2 + state.hero * 0.8, 0)

    if (!reduce) {
      const pa = pGeo.attributes.position.array as Float32Array
      for (let k = 0; k < P; k++) {
        pa[k * 3 + 1] += pSpd[k] * dt * 0.6
        if (pa[k * 3 + 1] > 16) pa[k * 3 + 1] = 0
      }
      pGeo.attributes.position.needsUpdate = true
      ;(stLines.material as THREE.LineBasicMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 2.2)
    }

    if (composer) composer.render()
    else renderer.render(scene, camera)
    if (!reduce) frame = requestAnimationFrame(loop)
  }
  loop()

  // With reduced motion the scene only redraws when the page scrolls or resizes.
  const redraw = () => requestAnimationFrame(loop)
  if (reduce) {
    addEventListener('scroll', redraw, { passive: true })
    addEventListener('resize', redraw)
  }

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    removeEventListener('pointermove', onPointer)
    removeEventListener('scroll', readScroll)
    removeEventListener('resize', onResize)
    removeEventListener('scroll', redraw)
    removeEventListener('resize', redraw)
    document.removeEventListener('visibilitychange', onVisibility)
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose?.()
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m?.dispose?.()
    })
    composer?.dispose?.()
    renderer.dispose()
    root.classList.remove('scene-ready')
  }
}
