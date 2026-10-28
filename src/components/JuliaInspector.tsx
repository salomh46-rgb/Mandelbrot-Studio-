import React, { useEffect, useRef } from 'react';
import { COLOR_PALETTES } from '../data/presets';
import { ComplexCoord } from '../types/fractal';

interface JuliaInspectorProps {
  seed: ComplexCoord;
  paletteId: number;
  colorCycles: number;
  onClose: () => void;
}

/**
 * Real-time Companion Julia Set Preview for the currently hovered or centered complex coordinate c
 */
export const JuliaInspector: React.FC<JuliaInspectorProps> = ({
  seed,
  paletteId,
  colorCycles,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    const pal = COLOR_PALETTES[paletteId] || COLOR_PALETTES[0];
    const maxIter = 96;
    const cRe = seed.re;
    const cIm = seed.im;

    let idx = 0;
    for (let py = 0; py < h; py++) {
      const zIm0 = ((h - 1 - py) / h - 0.5) * 3.1;
      for (let px = 0; px < w; px++) {
        let zRe = (px / w - 0.5) * 3.1;
        let zIm = zIm0;

        let iter = 0;
        let mag2 = 0;
        while (iter < maxIter) {
          const r2 = zRe * zRe;
          const i2 = zIm * zIm;
          mag2 = r2 + i2;
          if (mag2 > 16.0) break;
          zIm = 2.0 * zRe * zIm + cIm;
          zRe = r2 - i2 + cRe;
          iter++;
        }

        if (iter === maxIter) {
          data[idx++] = 7;
          data[idx++] = 10;
          data[idx++] = 18;
          data[idx++] = 255;
        } else {
          const log_zn = Math.log(Math.max(mag2, 1.0001)) * 0.5;
          const nu = Math.log(Math.max(log_zn / Math.LN2, 0.0001)) / Math.LN2;
          const smooth = Math.max(1, iter + 1 - nu);
          const t = Math.log(smooth) * 0.22 * colorCycles;

          const r =
            pal.a[0] + pal.b[0] * Math.cos(6.28318 * (pal.c[0] * t + pal.d[0]));
          const g =
            pal.a[1] + pal.b[1] * Math.cos(6.28318 * (pal.c[1] * t + pal.d[1]));
          const b =
            pal.a[2] + pal.b[2] * Math.cos(6.28318 * (pal.c[2] * t + pal.d[2]));

          data[idx++] = Math.min(255, Math.max(0, Math.round(r * 255)));
          data[idx++] = Math.min(255, Math.max(0, Math.round(g * 255)));
          data[idx++] = Math.min(255, Math.max(0, Math.round(b * 255)));
          data[idx++] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [seed.re, seed.im, paletteId, colorCycles]);

  const formatNum = (n: number) => (n >= 0 ? `+${n.toFixed(5)}` : n.toFixed(5));

  return (
    <div className="rounded-xl bg-[#0c101a]/95 border border-white/10 p-3 shadow-2xl w-52 pointer-events-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-200">Множество Жюлиа</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-white transition-colors px-1"
          title="Закрыть превью Жюлиа"
        >
          ✕
        </button>
      </div>
      <div className="relative rounded-lg overflow-hidden border border-white/10 bg-[#07090e]">
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          className="w-full h-auto block"
        />
      </div>
      <div className="mt-2 text-[11px] font-mono-tabular text-slate-400 truncate">
        c = { seed.re.toFixed(5) } { formatNum(seed.im) }i
      </div>
    </div>
  );
};
