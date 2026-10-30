<div align="center">

# рџЊЂ Mandelbrot Studio вЂ” Interactive GPU Fractal Explorer

> **Deep-zoom, arbitrary-precision fractal computation studio powered by WebGL fragment shaders and TypeScript.**

[![WebGL](https://img.shields.io/badge/WebGL-2.0_GLSL-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-NextGen_Tooling-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00f0ff?style=for-the-badge)](LICENSE)

</div>

---

## рџ”¬ Scientific & Visual Engine

**Mandelbrot Studio** transforms mathematical chaos theory into an ultra-smooth, interactive visualization playground. By offloading complex iterative polynomial calculations ($z_{n+1} = z_n^2 + c$) directly to GPU compute shaders, it achieves real-time $10^{14}$ depth zoom with zero frame jitter.

---

## вњЁ Features

- рџЋЁ **Dynamic Color Palettes:** Procedural palette cycling (Cosine gradients, Electric Neon, Obsidian Fire).
- рџ–±пёЏ **Kinematic Smooth Zoom:** Inertial pinch-to-zoom and multi-touch panning with sub-pixel interpolation.
- вљ™пёЏ **Configurable Iteration Depth:** Dynamic iteration scaling based on magnification level to balance FPS and precision.
- рџ“ё **Ultra-HD Snapshot Exporter:** Render 4K resolution fractal wallpapers directly to PNG.

---

## рџљЂ Getting Started

```bash
git clone https://github.com/salomh46-rgb/Mandelbrot-Studio-.git
cd Mandelbrot-Studio-

bun install
bun run dev
```

---

<div align="center">
  <sub>Developed by <b>Javohirbek Asqarov (Jasper)</b> вЂ” Creative Computing & Mathematical Visualizations.</sub>
</div>