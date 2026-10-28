import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLOR_PALETTES } from '../data/presets';
import {
  MANDELBROT_FRAGMENT_SHADER,
  MANDELBROT_VERTEX_SHADER,
  MAX_ORBIT_TEX_SIZE,
} from './mandelbrotShader';
import { buildObservatoryFrame } from './observatoryFrame';
import { ComplexCoord, FractalState } from '../types/fractal';

interface FractalViewportProps {
  state: FractalState;
  onUpdateView: (center: ComplexCoord, zoom: number, clearPreset?: boolean) => void;
  onHoverCoord: (coord: ComplexCoord | null) => void;
  captureTrigger: number;
}

// Candidate screen grid offsets in [-0.7, 0.7] to find a non-escaping or deepest reference point
const CANDIDATE_GRID = [-0.65, -0.32, 0.0, 0.32, 0.65];

/**
 * Computes a 64-bit IEEE-754 reference orbit Z_m on the CPU for Perturbation Theory.
 * Searches a 5x5 grid around the viewport center to pick the highest-iteration reference point.
 */
function updateReferenceOrbit(
  centerRe: number,
  centerIm: number,
  zoom: number,
  aspect: number,
  maxIterations: number,
  orbitBuffer: Float32Array
): { refOffsetRe: number; refOffsetIm: number; refOrbitLength: number } {
  const scale = 1.65 / Math.max(zoom, 1e-6);
  const limit = Math.min(maxIterations, MAX_ORBIT_TEX_SIZE - 1);

  let bestOffRe = 0.0;
  let bestOffIm = 0.0;
  let bestIter = -1;

  // Test center first; if it doesn't escape, use it immediately!
  for (let gy = 0; gy < CANDIDATE_GRID.length; gy++) {
    for (let gx = 0; gx < CANDIDATE_GRID.length; gx++) {
      // Prioritize (0,0) on first check
      const u = gx === 0 && gy === 0 ? 0.0 : CANDIDATE_GRID[gx];
      const v = gx === 0 && gy === 0 ? 0.0 : CANDIDATE_GRID[gy];
      if (gx === 2 && gy === 2 && (u !== 0 || v !== 0)) continue;

      const offRe = u * aspect * scale;
      const offIm = v * scale;
      const cRe = centerRe + offRe;
      const cIm = centerIm + offIm;

      let zr = 0.0;
      let zi = 0.0;
      let it = 0;
      while (it < limit) {
        const zr2 = zr * zr;
        const zi2 = zi * zi;
        if (zr2 + zi2 > 1024.0) break;
        zi = 2.0 * zr * zi + cIm;
        zr = zr2 - zi2 + cRe;
        it++;
      }

      if (it > bestIter) {
        bestIter = it;
        bestOffRe = offRe;
        bestOffIm = offIm;
        if (it >= limit) break;
      }
    }
    if (bestIter >= limit) break;
  }

  // Populate the full 64-bit reference orbit for the winning candidate C_ref
  const cRefRe = centerRe + bestOffRe;
  const cRefIm = centerIm + bestOffIm;

  let zr = 0.0;
  let zi = 0.0;
  let length = limit;

  for (let m = 0; m < limit; m++) {
    const base = m * 4;
    orbitBuffer[base] = zr;
    orbitBuffer[base + 1] = zi;
    orbitBuffer[base + 2] = 0;
    orbitBuffer[base + 3] = 1;

    const zr2 = zr * zr;
    const zi2 = zi * zi;
    if (zr2 + zi2 > 65536.0) {
      length = m;
      break;
    }
    zi = 2.0 * zr * zi + cRefIm;
    zr = zr2 - zi2 + cRefRe;
  }

  return {
    refOffsetRe: bestOffRe,
    refOffsetIm: bestOffIm,
    refOrbitLength: Math.max(1, length),
  };
}

export const FractalViewport: React.FC<FractalViewportProps> = ({
  state,
  onUpdateView,
  onHoverCoord,
  captureTrigger,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<FractalState>(state);
  stateRef.current = state;

  const callbacksRef = useRef({ onUpdateView, onHoverCoord });
  callbacksRef.current = { onUpdateView, onHoverCoord };

  const [isDragging, setIsDragging] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Target animated values for silky-smooth exponential damping
  const animTargetsRef = useRef({
    centerRe: state.center.re,
    centerIm: state.center.im,
    zoom: state.zoom,
    relief3D: state.relief3D ? 1 : 0,
    colorOffset: state.colorOffset,
  });

  // Current interpolated values
  const animCurrentRef = useRef({
    centerRe: state.center.re,
    centerIm: state.center.im,
    zoom: state.zoom,
    relief3D: state.relief3D ? 1 : 0,
    colorOffset: state.colorOffset,
  });

  const requestRenderRef = useRef<() => void>(() => {});
  const exportScreenshotRef = useRef<() => void>(() => {});

  // Sync incoming React state changes to animation targets and trigger render
  useEffect(() => {
    animTargetsRef.current.centerRe = state.center.re;
    animTargetsRef.current.centerIm = state.center.im;
    animTargetsRef.current.zoom = state.zoom;
    animTargetsRef.current.relief3D = state.relief3D ? 1 : 0;
    if (!state.animateColors) {
      animTargetsRef.current.colorOffset = state.colorOffset;
    }
    requestRenderRef.current();
  }, [
    state.center.re,
    state.center.im,
    state.zoom,
    state.maxIterations,
    state.autoIterations,
    state.paletteId,
    state.colorCycles,
    state.colorOffset,
    state.animateColors,
    state.smoothColoring,
    state.relief3D,
    state.reliefHeight,
    state.reliefSpecular,
  ]);

  // Handle screenshot export request
  useEffect(() => {
    if (captureTrigger > 0) {
      exportScreenshotRef.current();
    }
  }, [captureTrigger]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(height, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    const domCanvas = renderer.domElement;
    domCanvas.className = 'w-full h-full block touch-none';
    container.appendChild(domCanvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    domCanvas.addEventListener('webglcontextlost', handleContextLost);
    domCanvas.addEventListener('webglcontextrestored', handleContextRestored);

    // 2. Scene, Studio RoomEnvironment & Atmosphere
    const scene = new THREE.Scene();
    const bgColor = new THREE.Color('#07090e');
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2('#07090e', 0.085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Studio 3-Point PBR Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#93c5fd', '#1e1b4b', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fffbeb', 2.4);
    keyLight.position.set(3.5, -3.2, 4.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    const d = 3.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.25);
    rimLight.position.set(-4.0, 3.5, 2.2);
    scene.add(rimLight);

    // 4. Camera setup
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.set(0, 0, 2.58);
    camera.lookAt(0, 0, 0);

    // 5. Reference Orbit Float32 DataTexture (4096 x 1 RGBA32F)
    const orbitBuffer = new Float32Array(MAX_ORBIT_TEX_SIZE * 4);
    const orbitTexture = new THREE.DataTexture(
      orbitBuffer,
      MAX_ORBIT_TEX_SIZE,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    orbitTexture.minFilter = THREE.NearestFilter;
    orbitTexture.magFilter = THREE.NearestFilter;
    orbitTexture.wrapS = THREE.ClampToEdgeWrapping;
    orbitTexture.wrapT = THREE.ClampToEdgeWrapping;
    orbitTexture.needsUpdate = true;

    // 6. Fractal Shader Plane
    const segs = isSoftwareGl ? 96 : 180;
    const fractalGeo = new THREE.PlaneGeometry(2.0, 2.0, segs, segs);

    const initPal = COLOR_PALETTES[stateRef.current.paletteId] || COLOR_PALETTES[0];

    const uniforms = {
      uRefOrbitTex: { value: orbitTexture },
      uRefOrbitLength: { value: 200 },
      uRefOffset: { value: new THREE.Vector2(0, 0) },
      uZoom: { value: stateRef.current.zoom },
      uAspect: { value: aspect },
      uMaxIterations: { value: stateRef.current.maxIterations },
      uSmoothColoring: { value: stateRef.current.smoothColoring },
      uColorCycles: { value: stateRef.current.colorCycles },
      uColorOffset: { value: stateRef.current.colorOffset },
      uPalA: { value: new THREE.Vector3(...initPal.a) },
      uPalB: { value: new THREE.Vector3(...initPal.b) },
      uPalC: { value: new THREE.Vector3(...initPal.c) },
      uPalD: { value: new THREE.Vector3(...initPal.d) },
      uRelief3D: { value: stateRef.current.relief3D ? 1.0 : 0.0 },
      uReliefHeight: { value: stateRef.current.reliefHeight },
      uReliefSpecular: { value: stateRef.current.reliefSpecular },
    };

    const fractalMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: MANDELBROT_VERTEX_SHADER,
      fragmentShader: MANDELBROT_FRAGMENT_SHADER,
      side: THREE.DoubleSide,
    });

    const fractalMesh = new THREE.Mesh(fractalGeo, fractalMat);
    scene.add(fractalMesh);

    // 7. Composite 7-Part 3D Observatory Astrolabe Frame
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const observatory = buildObservatoryFrame(isSoftwareGl, maxAnisotropy);
    observatory.group.visible = false;
    scene.add(observatory.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 8. Frame pacing & On-Demand Render Loop with Software WebGL sync
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        const syncState = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (syncState === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepAndDraw() {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const s = stateRef.current;
      const targ = animTargetsRef.current;
      const curr = animCurrentRef.current;

      const dampingLambda = isSoftwareGl ? 28 : 14;
      curr.centerRe = THREE.MathUtils.damp(curr.centerRe, targ.centerRe, dampingLambda, dt);
      curr.centerIm = THREE.MathUtils.damp(curr.centerIm, targ.centerIm, dampingLambda, dt);

      const logCurrZoom = Math.log(Math.max(curr.zoom, 1e-6));
      const logTargZoom = Math.log(Math.max(targ.zoom, 1e-6));
      const nextLogZoom = THREE.MathUtils.damp(logCurrZoom, logTargZoom, dampingLambda, dt);
      curr.zoom = Math.exp(nextLogZoom);

      curr.relief3D = THREE.MathUtils.damp(curr.relief3D, targ.relief3D, 9, dt);

      if (s.animateColors) {
        curr.colorOffset = (curr.colorOffset + dt * 0.18) % 10.0;
      } else {
        curr.colorOffset = THREE.MathUtils.damp(curr.colorOffset, targ.colorOffset, 12, dt);
      }

      const curAspect = domCanvas.clientWidth / Math.max(domCanvas.clientHeight, 1);

      // Calculate effective iterations (Auto-iterations scales smoothly with zoom depth)
      const effectiveIter = s.autoIterations
        ? Math.min(
            4000,
            Math.max(
              s.maxIterations,
              Math.round(220 + Math.log10(Math.max(1, curr.zoom)) * 240)
            )
          )
        : s.maxIterations;

      // Compute 64-bit Reference Orbit on CPU and update Float32 DataTexture
      const refInfo = updateReferenceOrbit(
        curr.centerRe,
        curr.centerIm,
        curr.zoom,
        curAspect,
        effectiveIter,
        orbitBuffer
      );
      orbitTexture.needsUpdate = true;

      uniforms.uRefOffset.value.set(refInfo.refOffsetRe, refInfo.refOffsetIm);
      uniforms.uRefOrbitLength.value = refInfo.refOrbitLength;
      uniforms.uZoom.value = curr.zoom;
      uniforms.uAspect.value = curAspect;
      uniforms.uMaxIterations.value = effectiveIter;
      uniforms.uSmoothColoring.value = s.smoothColoring;
      uniforms.uColorCycles.value = s.colorCycles;
      uniforms.uColorOffset.value = curr.colorOffset;
      uniforms.uRelief3D.value = curr.relief3D;
      uniforms.uReliefHeight.value = s.reliefHeight;
      uniforms.uReliefSpecular.value = s.reliefSpecular;

      const pal = COLOR_PALETTES[s.paletteId] || COLOR_PALETTES[0];
      uniforms.uPalA.value.set(...pal.a);
      uniforms.uPalB.value.set(...pal.b);
      uniforms.uPalC.value.set(...pal.c);
      uniforms.uPalD.value.set(...pal.d);

      // Update plane & camera geometry for 2D full-bleed vs 3D sculptural relief
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const planeH = 2 * Math.tan(fovRad / 2) * 2.58;
      const planeW = planeH * curAspect;

      const reliefFactor = curr.relief3D;
      if (reliefFactor > 0.01) {
        observatory.group.visible = true;
        const discScale = Math.min(planeW, planeH) * 0.42;
        fractalMesh.scale.set(
          THREE.MathUtils.lerp(planeW * 0.5, discScale, reliefFactor),
          THREE.MathUtils.lerp(planeH * 0.5, discScale, reliefFactor),
          1
        );
        observatory.group.scale.setScalar(discScale * 0.43);
        camera.position.set(0, -2.55 * reliefFactor, 2.58 - 0.35 * reliefFactor);
        camera.lookAt(0, 0, 0.08 * reliefFactor);
      } else {
        observatory.group.visible = false;
        fractalMesh.scale.set(planeW * 0.5, planeH * 0.5, 1);
        camera.position.set(0, 0, 2.58);
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);

      const scaleStep = 1.65 / Math.max(curr.zoom, 1);
      const stillMoving =
        s.animateColors ||
        Math.abs(curr.centerRe - targ.centerRe) > scaleStep * 1e-5 ||
        Math.abs(curr.centerIm - targ.centerIm) > scaleStep * 1e-5 ||
        Math.abs(logCurrZoom - logTargZoom) > 1e-3 ||
        Math.abs(curr.relief3D - targ.relief3D) > 1e-3;

      return stillMoving;
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      lastTime = performance.now();
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const needsMoreFrames = stepAndDraw();
        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;

    exportScreenshotRef.current = () => {
      renderer.render(scene, camera);
      const dataUrl = domCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `mandelbrot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    };

    // 9. Pointer / Mouse / Wheel Interaction Handlers
    let pointerDown = false;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let totalDragDist = 0;

    function screenToComplex(clientX: number, clientY: number): ComplexCoord {
      const rect = domCanvas.getBoundingClientRect();
      const nx = (clientX - rect.left) / Math.max(rect.width, 1);
      const ny = 1.0 - (clientY - rect.top) / Math.max(rect.height, 1);
      const curAspect = rect.width / Math.max(rect.height, 1);

      const curr = animCurrentRef.current;
      const scale = 1.65 / Math.max(curr.zoom, 1e-6);

      return {
        re: curr.centerRe + (nx - 0.5) * 2.0 * curAspect * scale,
        im: curr.centerIm + (ny - 0.5) * 2.0 * scale,
      };
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      pointerDown = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      totalDragDist = 0;
      domCanvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const hoverComplex = screenToComplex(e.clientX, e.clientY);
      callbacksRef.current.onHoverCoord(hoverComplex);

      if (!pointerDown || e.pointerId !== pointerId) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      totalDragDist += Math.hypot(dx, dy);

      if (totalDragDist > 4) {
        setIsDragging(true);
        const rect = domCanvas.getBoundingClientRect();
        const curAspect = rect.width / Math.max(rect.height, 1);
        const currZoom = animTargetsRef.current.zoom;
        const scale = 1.65 / Math.max(currZoom, 1e-6);

        const deltaRe = -(dx / Math.max(rect.width, 1)) * 2.0 * curAspect * scale;
        const deltaIm = (dy / Math.max(rect.height, 1)) * 2.0 * scale;

        const nextRe = animTargetsRef.current.centerRe + deltaRe;
        const nextIm = animTargetsRef.current.centerIm + deltaIm;

        animTargetsRef.current.centerRe = nextRe;
        animTargetsRef.current.centerIm = nextIm;
        animCurrentRef.current.centerRe = nextRe;
        animCurrentRef.current.centerIm = nextIm;

        callbacksRef.current.onUpdateView({ re: nextRe, im: nextIm }, currZoom, true);
        requestRender();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown || e.pointerId !== pointerId) return;
      pointerDown = false;
      setIsDragging(false);
      if (domCanvas.hasPointerCapture(e.pointerId)) {
        domCanvas.releasePointerCapture(e.pointerId);
      }

      const moveDist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (moveDist <= 5) {
        const clickedCoord = screenToComplex(e.clientX, e.clientY);
        const isZoomOut =
          e.button === 2 || e.shiftKey || stateRef.current.clickZoomMode === 'out';
        const zoomFactor = isZoomOut ? 1 / 2.4 : 2.4;
        const nextZoom = THREE.MathUtils.clamp(
          animTargetsRef.current.zoom * zoomFactor,
          0.35,
          1e13
        );

        const nextCenter = {
          re: clickedCoord.re,
          im: clickedCoord.im,
        };

        animTargetsRef.current.centerRe = nextCenter.re;
        animTargetsRef.current.centerIm = nextCenter.im;
        animTargetsRef.current.zoom = nextZoom;

        callbacksRef.current.onUpdateView(nextCenter, nextZoom, true);
        requestRender();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = domCanvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / Math.max(rect.width, 1);
      const ny = 1.0 - (e.clientY - rect.top) / Math.max(rect.height, 1);
      const curAspect = rect.width / Math.max(rect.height, 1);

      const oldZoom = animTargetsRef.current.zoom;
      const wheelFactor = Math.exp(-e.deltaY * 0.0016);
      const newZoom = THREE.MathUtils.clamp(oldZoom * wheelFactor, 0.35, 1e13);

      const oldScale = 1.65 / oldZoom;
      const newScale = 1.65 / newZoom;

      const cursorRe =
        animTargetsRef.current.centerRe + (nx - 0.5) * 2.0 * curAspect * oldScale;
      const cursorIm =
        animTargetsRef.current.centerIm + (ny - 0.5) * 2.0 * oldScale;

      const nextRe = cursorRe - (nx - 0.5) * 2.0 * curAspect * newScale;
      const nextIm = cursorIm - (ny - 0.5) * 2.0 * newScale;

      animTargetsRef.current.centerRe = nextRe;
      animTargetsRef.current.centerIm = nextIm;
      animTargetsRef.current.zoom = newZoom;

      callbacksRef.current.onUpdateView({ re: nextRe, im: nextIm }, newZoom, true);
      requestRender();
    };

    const onPointerLeave = () => {
      callbacksRef.current.onHoverCoord(null);
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };

    domCanvas.addEventListener('pointerdown', onPointerDown);
    domCanvas.addEventListener('pointermove', onPointerMove);
    domCanvas.addEventListener('pointerup', onPointerUp);
    domCanvas.addEventListener('pointerleave', onPointerLeave);
    domCanvas.addEventListener('contextmenu', onContextMenu);
    domCanvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);

    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domCanvas.removeEventListener('pointerdown', onPointerDown);
      domCanvas.removeEventListener('pointermove', onPointerMove);
      domCanvas.removeEventListener('pointerup', onPointerUp);
      domCanvas.removeEventListener('pointerleave', onPointerLeave);
      domCanvas.removeEventListener('contextmenu', onContextMenu);
      domCanvas.removeEventListener('wheel', onWheel);
      domCanvas.removeEventListener('webglcontextlost', handleContextLost);
      domCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      window.removeEventListener('resize', onResize);

      orbitTexture.dispose();
      fractalGeo.dispose();
      fractalMat.dispose();
      observatory.dispose();
      renderer.dispose();
    };
  }, []);

  const cursorClass = isDragging
    ? 'cursor-grabbing'
    : state.clickZoomMode === 'out'
    ? 'cursor-zoom-out'
    : 'cursor-zoom-in';

  return (
    <div className={`relative w-screen h-screen overflow-hidden ${cursorClass}`}>
      <div ref={canvasMountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#07090e]/95 text-slate-200 z-30">
          <div className="max-w-md p-6 rounded-xl bg-[#111622] border border-white/10 text-center space-y-2">
            <p className="text-base font-semibold">Восстановление графического контекста WebGL</p>
            <p className="text-xs text-slate-400">
              Графический драйвер перезапускает шейдер множества Мандельброта...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
