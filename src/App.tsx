/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ControlDock } from './components/ControlDock';
import { JuliaInspector } from './components/JuliaInspector';
import { FRACTAL_PRESETS } from './data/presets';
import { FractalViewport } from './three/FractalViewport';
import { ClickZoomMode, ComplexCoord, FractalPreset, FractalState } from './types/fractal';

const INITIAL_PRESET = FRACTAL_PRESETS[0];

export default function App() {
  const [state, setState] = useState<FractalState>({
    center: { ...INITIAL_PRESET.center },
    zoom: INITIAL_PRESET.zoom,
    maxIterations: INITIAL_PRESET.recommendedIterations,
    autoIterations: true,
    paletteId: INITIAL_PRESET.paletteId,
    colorCycles: INITIAL_PRESET.colorCycles,
    colorOffset: 0.0,
    animateColors: false,
    smoothColoring: true,
    relief3D: false,
    reliefHeight: 0.34,
    reliefSpecular: 0.48,
    juliaPreview: false,
    juliaSeed: { re: -0.74364, im: 0.13182 },
    clickZoomMode: 'in',
    activePresetId: INITIAL_PRESET.id,
  });

  const [hoveredCoord, setHoveredCoord] = useState<ComplexCoord | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [captureTrigger, setCaptureTrigger] = useState(0);

  const handleUpdateView = useCallback(
    (center: ComplexCoord, zoom: number, clearPreset = false) => {
      setState((prev) => ({
        ...prev,
        center,
        zoom,
        activePresetId: clearPreset ? null : prev.activePresetId,
      }));
    },
    []
  );

  const handleHoverCoord = useCallback((coord: ComplexCoord | null) => {
    setHoveredCoord(coord);
    if (coord) {
      setState((prev) =>
        prev.juliaPreview ? { ...prev, juliaSeed: coord } : prev
      );
    }
  }, []);

  const handleSelectPreset = useCallback((preset: FractalPreset) => {
    setState((prev) => ({
      ...prev,
      center: { ...preset.center },
      zoom: preset.zoom,
      maxIterations: preset.recommendedIterations,
      paletteId: preset.paletteId,
      colorCycles: preset.colorCycles,
      activePresetId: preset.id,
    }));
  }, []);

  const handleResetZoom = useCallback(() => {
    handleSelectPreset(INITIAL_PRESET);
  }, [handleSelectPreset]);

  const handleStepZoom = useCallback((factor: number) => {
    setState((prev) => ({
      ...prev,
      zoom: Math.min(1e13, Math.max(0.35, prev.zoom * factor)),
      activePresetId: null,
    }));
  }, []);

  // Keyboard shortcuts: R to reset zoom, H to hide/show controls, + / - to zoom, 3 for 3D relief
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        handleResetZoom();
      } else if (e.key === '+' || e.key === '=') {
        handleStepZoom(2.0);
      } else if (e.key === '-' || e.key === '_') {
        handleStepZoom(0.5);
      } else if (e.key === '3') {
        setState((prev) => ({ ...prev, relief3D: !prev.relief3D }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleResetZoom, handleStepZoom]);

  const activeCoord = hoveredCoord || state.center;
  const formatComplex = (re: number, im: number) => {
    const decimals = Math.min(
      14,
      Math.max(6, Math.ceil(Math.log10(Math.max(1, state.zoom))) + 3)
    );
    const sign = im >= 0 ? '+' : '−';
    return `${re.toFixed(decimals)} ${sign} ${Math.abs(im).toFixed(decimals)}i`;
  };

  const formatZoom = (z: number) => {
    if (z < 1000) return `${z.toFixed(1)}×`;
    if (z < 1e6) return `${(z / 1e3).toFixed(2)} тыс. ×`;
    if (z < 1e9) return `${(z / 1e6).toFixed(2)} млн ×`;
    return `${z.toExponential(2)}×`;
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#07090e] select-none">
      {/* Full-Viewport WebGL / Three.js Fractal Canvas */}
      <FractalViewport
        state={state}
        onUpdateView={handleUpdateView}
        onHoverCoord={handleHoverCoord}
        captureTrigger={captureTrigger}
      />

      {/* Minimal Top-Left Scientific Telemetry Badge */}
      <header className="fixed top-4 left-4 z-20 pointer-events-none flex flex-col gap-2 max-w-[92vw]">
        <div className="pointer-events-auto inline-flex flex-wrap items-center gap-3 px-3.5 py-2 rounded-xl bg-[#0c101a]/92 border border-white/10 shadow-lg">
          <span className="font-display text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Mandelbrot Studio
          </span>
          <span className="text-white/20" aria-hidden="true">
            ·
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono-tabular">
            <span>c = {formatComplex(activeCoord.re, activeCoord.im)}</span>
            <span className="text-white/20" aria-hidden="true">
              ·
            </span>
            <span className="text-amber-400 font-medium">
              {formatZoom(state.zoom)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowShortcuts((prev) => !prev)}
            className="ml-1 text-slate-400 hover:text-white transition-colors"
            title="Справка по управлению"
            aria-label="Справка по управлению"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Concise Interaction Guide Popover */}
        {showShortcuts && (
          <div className="pointer-events-auto p-3.5 rounded-xl bg-[#0c101a]/95 border border-white/12 shadow-xl text-xs text-slate-300 space-y-1.5 max-w-xs">
            <p className="font-semibold text-white">Навигация по фракталу</p>
            <p>
              <span className="text-amber-400 font-medium">Левый клик:</span>{' '}
              приблизить выбранную точку (2.4×)
            </p>
            <p>
              <span className="text-amber-400 font-medium">Правый клик / Shift+клик:</span>{' '}
              отдалить от точки
            </p>
            <p>
              <span className="text-amber-400 font-medium">Перетаскивание:</span>{' '}
              плавное перемещение по плоскости
            </p>
            <p>
              <span className="text-amber-400 font-medium">Колесо мыши:</span>{' '}
              масштабирование относительно курсора
            </p>
            <p className="pt-1 text-[11px] text-slate-400 border-t border-white/8">
              Клавиши: <span className="font-mono-tabular text-slate-200">R</span> — сброс,{' '}
              <span className="font-mono-tabular text-slate-200">H</span> — скрыть панель,{' '}
              <span className="font-mono-tabular text-slate-200">3</span> — 3D-рельеф
            </p>
          </div>
        )}

        {/* Optional Live Julia Set Companion Inspector */}
        {state.juliaPreview && (
          <JuliaInspector
            seed={state.juliaSeed}
            paletteId={state.paletteId}
            colorCycles={state.colorCycles}
            onClose={() =>
              setState((prev) => ({ ...prev, juliaPreview: false }))
            }
          />
        )}
      </header>

      {/* Collapsible Unified Bottom Control Dock */}
      <ControlDock
        state={state}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
        onSelectPreset={handleSelectPreset}
        onResetZoom={handleResetZoom}
        onStepZoom={handleStepZoom}
        onChangeIterations={(val) =>
          setState((prev) => ({
            ...prev,
            maxIterations: val,
            autoIterations: false,
          }))
        }
        onToggleAutoIterations={() =>
          setState((prev) => ({ ...prev, autoIterations: !prev.autoIterations }))
        }
        onSelectPalette={(id) =>
          setState((prev) => ({ ...prev, paletteId: id }))
        }
        onChangeColorCycles={(val) =>
          setState((prev) => ({ ...prev, colorCycles: val }))
        }
        onToggleSmoothColoring={() =>
          setState((prev) => ({ ...prev, smoothColoring: !prev.smoothColoring }))
        }
        onToggleAnimateColors={() =>
          setState((prev) => ({ ...prev, animateColors: !prev.animateColors }))
        }
        onToggleRelief3D={() =>
          setState((prev) => ({ ...prev, relief3D: !prev.relief3D }))
        }
        onChangeReliefSpecular={(val) =>
          setState((prev) => ({ ...prev, reliefSpecular: val }))
        }
        onToggleJuliaPreview={() =>
          setState((prev) => ({ ...prev, juliaPreview: !prev.juliaPreview }))
        }
        onChangeClickZoomMode={(mode: ClickZoomMode) =>
          setState((prev) => ({ ...prev, clickZoomMode: mode }))
        }
        onCaptureScreenshot={() => setCaptureTrigger((c) => c + 1)}
      />
    </main>
  );
}
