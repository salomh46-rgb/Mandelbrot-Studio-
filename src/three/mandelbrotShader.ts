/**
 * High-Precision GLSL Shaders for Mandelbrot & Julia Set Exploration
 * Uses CPU 64-bit Reference Orbit Perturbation Theory + Zhuoran's Glitch-Free Rebasing
 * for razor-sharp, artifact-free rendering from 1x up to 10^13x zoom.
 */

export const MAX_ORBIT_TEX_SIZE = 4096;

export const MANDELBROT_VERTEX_SHADER = /* glsl */ `
  uniform sampler2D uRefOrbitTex;
  uniform int uRefOrbitLength;
  uniform vec2 uRefOffset;
  uniform float uZoom;
  uniform float uAspect;
  uniform int uMaxIterations;
  uniform float uRelief3D;
  uniform float uReliefHeight;

  varying vec2 vUv;
  varying float vPotential;
  varying vec3 vWorldPos;

  // Vertex-level escape potential sample using perturbation theory for 3D topographical displacement
  float samplePotential(vec2 uv) {
    if (uRelief3D < 0.001) return 0.0;

    vec2 screenOffset = (uv - 0.5) * 2.0;
    screenOffset.x *= uAspect;
    float scale = 1.65 / max(uZoom, 1e-6);

    vec2 dc = screenOffset * scale - uRefOffset;
    vec2 dz = vec2(0.0);
    int m = 0;
    int maxIt = min(uMaxIterations, 256);

    for (int i = 0; i < 256; i++) {
      if (i >= maxIt) break;

      vec2 Zm = texture2D(uRefOrbitTex, vec2((float(m) + 0.5) / 4096.0, 0.5)).xy;
      vec2 z = Zm + dz;
      float mag2 = dot(z, z);

      if (mag2 > 64.0) {
        float log_zn = log(mag2) * 0.5;
        float nu = log(max(log_zn / log(2.0), 1e-4)) / log(2.0);
        float iter = float(i) + 1.0 - nu;
        return clamp(log(max(iter, 1.0) + 1.0) / log(float(maxIt) + 1.0), 0.0, 1.0);
      }

      if (mag2 < dot(dz, dz) || m >= uRefOrbitLength) {
        dz = z;
        m = 0;
        Zm = vec2(0.0);
      }

      vec2 twoZmPlusDz = 2.0 * Zm + dz;
      dz = vec2(
        dz.x * twoZmPlusDz.x - dz.y * twoZmPlusDz.y,
        dz.x * twoZmPlusDz.y + dz.y * twoZmPlusDz.x
      ) + dc;
      m++;
    }
    return 1.0;
  }

  void main() {
    vUv = uv;
    float pot = samplePotential(uv);
    vPotential = pot;

    vec3 displaced = position;
    if (uRelief3D > 0.001) {
      float ridge = pow(pot, 1.35) * uReliefHeight * uRelief3D;
      if (pot > 0.995) {
        ridge = (uReliefHeight * 0.78) * uRelief3D;
      }
      displaced.z += ridge;
    }

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const MANDELBROT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uRefOrbitTex;
  uniform int uRefOrbitLength;
  uniform vec2 uRefOffset;
  uniform float uZoom;
  uniform float uAspect;
  uniform int uMaxIterations;
  uniform bool uSmoothColoring;
  uniform float uColorCycles;
  uniform float uColorOffset;
  uniform vec3 uPalA;
  uniform vec3 uPalB;
  uniform vec3 uPalC;
  uniform vec3 uPalD;
  uniform float uRelief3D;
  uniform float uReliefSpecular;

  varying vec2 vUv;
  varying float vPotential;
  varying vec3 vWorldPos;

  // Cosine palette generator (Inigo Quilez formula)
  vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318530718 * (c * t + d));
  }

  void main() {
    vec2 screenOffset = (vUv - 0.5) * 2.0;
    screenOffset.x *= uAspect;

    float scale = 1.65 / max(uZoom, 1e-6);

    // Pixel offset relative to the 64-bit CPU reference point C_ref.
    // Because both terms are small viewport offsets (~1/zoom), there is zero catastrophic cancellation!
    vec2 dc = screenOffset * scale - uRefOffset;

    vec2 dz = vec2(0.0);
    vec2 dzDeriv = vec2(1.0, 0.0);
    vec2 z = vec2(0.0);

    int m = 0;
    bool escaped = false;
    int escapedIter = 0;
    float mag2 = 0.0;

    for (int i = 0; i < 4000; i++) {
      if (i >= uMaxIterations) break;

      vec2 Zm = texture2D(uRefOrbitTex, vec2((float(m) + 0.5) / 4096.0, 0.5)).xy;
      z = Zm + dz;
      mag2 = dot(z, z);

      if (mag2 > 256.0) {
        escaped = true;
        escapedIter = i;
        break;
      }

      // Zhuoran's Glitch-Free Rebasing:
      // Whenever the true iterate z gets closer to the origin (0,0) than the perturbation delta dz,
      // or when the reference orbit reaches its escape limit, rebase relative to Z_0 = (0,0).
      if (mag2 < dot(dz, dz) || m >= uRefOrbitLength) {
        dz = z;
        m = 0;
        Zm = vec2(0.0);
      }

      // Derivative update for normal-mapped filament lighting (rescaled to prevent float32 overflow)
      dzDeriv = 2.0 * vec2(
        z.x * dzDeriv.x - z.y * dzDeriv.y,
        z.x * dzDeriv.y + z.y * dzDeriv.x
      );
      float derivMag2 = dot(dzDeriv, dzDeriv);
      if (derivMag2 < 1e12) {
        dzDeriv.x += 1.0;
      } else if (derivMag2 > 1e18) {
        dzDeriv *= 1e-9;
      }

      // Perturbation step: dz_{n+1} = dz_n * (2 * Z_m + dz_n) + dc
      vec2 twoZmPlusDz = 2.0 * Zm + dz;
      dz = vec2(
        dz.x * twoZmPlusDz.x - dz.y * twoZmPlusDz.y,
        dz.x * twoZmPlusDz.y + dz.y * twoZmPlusDz.x
      ) + dc;

      m++;
    }

    if (!escaped) {
      float interiorGlow = clamp(length(z) * 0.35, 0.0, 1.0);
      vec3 coreColor = mix(vec3(0.015, 0.02, 0.04), uPalA * 0.22, interiorGlow);
      gl_FragColor = vec4(coreColor, 1.0);
      return;
    }

    // Continuous smooth iteration count
    float smoothIter = float(escapedIter);
    if (uSmoothColoring) {
      float log_zn = log(max(mag2, 1.0001)) * 0.5;
      float nu = log(max(log_zn / log(2.0), 0.0001)) / log(2.0);
      smoothIter = float(escapedIter) + 1.0 - nu;
    }

    float normalizedT = log(max(smoothIter, 1.0)) * 0.18 * uColorCycles + uColorOffset;
    vec3 color = cosinePalette(normalizedT, uPalA, uPalB, uPalC, uPalD);

    // Safe complex normal direction from z / dzDeriv = z * conj(dzDeriv)
    vec2 normalDir = vec2(
      z.x * dzDeriv.x + z.y * dzDeriv.y,
      z.y * dzDeriv.x - z.x * dzDeriv.y
    );
    float normLen = length(normalDir);
    vec2 u = normLen > 1e-20 ? (normalDir / normLen) : vec2(0.7071, 0.7071);

    // 45-degree key light direction in complex plane
    vec2 lightDir = vec2(0.70710678, 0.70710678);
    float lambert = clamp(dot(u, lightDir) * 0.5 + 0.5, 0.18, 1.0);

    float specIntensity = mix(0.16, uReliefSpecular, uRelief3D);
    float spec = pow(max(lambert, 0.0), 6.0) * specIntensity;
    float ambientBlend = mix(0.88, 1.08, lambert);

    vec3 finalColor = color * ambientBlend + vec3(1.0, 0.94, 0.82) * spec;

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
  }
`;
