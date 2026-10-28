import * as THREE from 'three';

// Module-scope reusable scratch objects to avoid GC in loops
const _dummy = new THREE.Object3D();

/**
 * Generates a procedural radial contact shadow texture using HTML5 2D Canvas
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a procedural brushed metal & complex coordinate scale ring texture
 */
function createScaleRingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141923';
  ctx.fillRect(0, 0, 1024, 128);

  // Fine brushed lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 128; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Sub-graduation ticks
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  for (let x = 0; x < 1024; x += 8) {
    const isMajor = x % 64 === 0;
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 16 : 36);
    ctx.lineTo(x, 92);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Builds an 8-part composite procedural 3D Complex Plane Astrolabe / Stage Frame
 * that surrounds the fractal relief sculpture when inspecting in 3D Relief mode.
 */
export function buildObservatoryFrame(
  isSoftwareGl: boolean,
  maxAnisotropy: number
): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'ComplexObservatoryFrame';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const scaleTex = createScaleRingTexture(maxAnisotropy);
  const shadowTex = createContactShadowTexture();
  textures.push(scaleTex, shadowTex);

  // 1. Primary Silhouette: LatheGeometry Profiled Outer Brass/Titanium Bezel Ring
  const lathePoints: THREE.Vector2[] = [
    new THREE.Vector2(2.35, -0.08),
    new THREE.Vector2(2.62, -0.08),
    new THREE.Vector2(2.68, -0.02),
    new THREE.Vector2(2.65, 0.06),
    new THREE.Vector2(2.42, 0.08),
    new THREE.Vector2(2.35, 0.02),
    new THREE.Vector2(2.35, -0.08),
  ];
  const outerBezelGeo = new THREE.LatheGeometry(lathePoints, 96);
  outerBezelGeo.rotateX(Math.PI / 2);
  outerBezelGeo.computeTangents();
  geometries.push(outerBezelGeo);

  const brushedBrassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d99b38'),
    metalness: 0.92,
    roughness: 0.22,
    anisotropy: 0.75,
    clearcoat: 0.3,
  });
  materials.push(brushedBrassMat);

  const outerBezelMesh = new THREE.Mesh(outerBezelGeo, brushedBrassMat);
  outerBezelMesh.castShadow = true;
  outerBezelMesh.receiveShadow = true;
  group.add(outerBezelMesh);

  // 2. Secondary Read: Dark Obsidian Titanium Inner Graduated Ring
  const innerRingGeo = new THREE.RingGeometry(2.12, 2.36, 96, 1);
  geometries.push(innerRingGeo);

  const darkTitaniumMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e293b'),
    map: scaleTex,
    metalness: 0.65,
    roughness: 0.48,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  materials.push(darkTitaniumMat);

  const innerRingMesh = new THREE.Mesh(innerRingGeo, darkTitaniumMat);
  innerRingMesh.position.z = 0.01;
  innerRingMesh.receiveShadow = true;
  group.add(innerRingMesh);

  // 3. Secondary Read: ExtrudeGeometry Beveled Cardinal Caliper Brackets (4x)
  const bracketShape = new THREE.Shape();
  bracketShape.moveTo(-0.14, 0);
  bracketShape.lineTo(0.14, 0);
  bracketShape.lineTo(0.1, 0.34);
  bracketShape.lineTo(-0.1, 0.34);
  bracketShape.closePath();

  const bracketGeo = new THREE.ExtrudeGeometry(bracketShape, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 3,
  });
  geometries.push(bracketGeo);

  const steelBracketMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#64748b'),
    metalness: 0.88,
    roughness: 0.25,
    anisotropy: 0.6,
  });
  materials.push(steelBracketMat);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const bracket = new THREE.Mesh(bracketGeo, steelBracketMat);
    bracket.position.set(
      Math.cos(angle) * 2.28,
      Math.sin(angle) * 2.28,
      -0.02
    );
    bracket.rotation.z = angle - Math.PI / 2;
    bracket.castShadow = true;
    bracket.receiveShadow = true;
    group.add(bracket);
  }

  // 4. Accent Detail: InstancedMesh Vernier Degree Pins (72 instances around perimeter)
  const tickCount = 72;
  const tickGeo = new THREE.BoxGeometry(0.018, 0.075, 0.035);
  geometries.push(tickGeo);

  const tickMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbbf24'),
    metalness: 0.95,
    roughness: 0.18,
  });
  materials.push(tickMat);

  const tickInstanced = new THREE.InstancedMesh(tickGeo, tickMat, tickCount);
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    const radius = 2.48;
    _dummy.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0.075
    );
    _dummy.rotation.set(0, 0, angle - Math.PI / 2);
    _dummy.scale.set(isMajor ? 1.45 : 0.85, isMajor ? 1.35 : 0.85, 1.0);
    _dummy.updateMatrix();
    tickInstanced.setMatrixAt(i, _dummy.matrix);
  }
  tickInstanced.instanceMatrix.needsUpdate = true;
  tickInstanced.computeBoundingSphere();
  group.add(tickInstanced);

  // 5. Accent Detail: Optical Sapphire Glass Reticle Ring
  const glassRingGeo = new THREE.TorusGeometry(2.14, 0.028, 20, 96);
  geometries.push(glassRingGeo);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e0f2fe'),
    transmission: isSoftwareGl ? 0 : 0.92,
    transparent: true,
    opacity: isSoftwareGl ? 0.35 : 1.0,
    ior: 1.76,
    thickness: 0.4,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    depthWrite: false,
  });
  materials.push(glassMat);

  const glassRingMesh = new THREE.Mesh(glassRingGeo, glassMat);
  glassRingMesh.position.z = 0.06;
  glassRingMesh.renderOrder = 2;
  group.add(glassRingMesh);

  // 6. Base Pedestal Plate beneath the Fractal Plane
  const basePlateGeo = new THREE.CylinderGeometry(2.58, 2.72, 0.12, 64);
  basePlateGeo.rotateX(Math.PI / 2);
  geometries.push(basePlateGeo);

  const basePlateMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f141f'),
    metalness: 0.55,
    roughness: 0.62,
  });
  materials.push(basePlateMat);

  const basePlateMesh = new THREE.Mesh(basePlateGeo, basePlateMat);
  basePlateMesh.position.z = -0.14;
  basePlateMesh.receiveShadow = true;
  group.add(basePlateMesh);

  // 7. Grounding Contact Shadow Plane
  const shadowPlaneGeo = new THREE.PlaneGeometry(6.4, 6.4);
  geometries.push(shadowPlaneGeo);

  const shadowPlaneMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
  });
  materials.push(shadowPlaneMat);

  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.position.z = -0.22;
  group.add(shadowPlane);

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return { group, dispose };
}
