import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Layers,
  Minus,
  Palette,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { COLOR_PALETTES, FRACTAL_PRESETS } from '../data/presets';
import { ClickZoomMode, FractalPreset, FractalState } from '../types/fractal';

interface ControlDockProps {
  state: FractalState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectPreset: (preset: FractalPreset) => void;
  onResetZoom: () => void;
  onStepZoom: (factor: number) => void;
  onChangeIterations: (val: number) => void;
  onToggleAutoIterations: () => void;
  onSelectPalette: (id: number) => void;
  onChangeColorCycles: (val: number) => void;
  onToggleSmoothColoring: () => void;
  onToggleAnimateColors: () => void;
  onToggleRelief3D: () => void;
  onChangeReliefSpecular: (val: number) => void;
  onToggleJuliaPreview: () => void;
  onChangeClickZoomMode: (mode: ClickZoomMode) => void;
  onCaptureScreenshot: () => void;
}

type ActiveTab = 'presets' | 'parameters' | 'coloring';

export const ControlDock: React.FC<ControlDockProps> = ({
  state,
  collapsed,
  onToggleCollapse,
  onSelectPreset,
  onResetZoom,
  onStepZoom,
  onChangeIterations,
  onToggleAutoIterations,
  onSelectPalette,
  onChangeColorCycles,
  onToggleSmoothColoring,
  onToggleAnimateColors,
  onToggleRelief3D,
  onChangeReliefSpecular,
  onToggleJuliaPreview,
  onChangeClickZoomMode,
  onCaptureScreenshot,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('presets');

  const effectiveIter = state.autoIterations
    ? Math.min(
        4000,
        Math.max(
          state.maxIterations,
          Math.round(220 + Math.log10(Math.max(1, state.zoom)) * 240)
        )
      )
    : state.maxIterations;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(940px,95vw)] pointer-events-none flex flex-col items-center"
      role="region"
      aria-label="Панель управления фракталом"
    >
      {/* Collapse / Expand Handle (Zen Mode Toggle) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto mb-1.5 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0d121d]/95 border border-white/12 text-xs font-medium text-slate-300 hover:text-white hover:border-amber-500/40 transition-colors shadow-lg whitespace-nowrap shrink-0"
        title="Скрыть или показать панель управления (клавиша H)"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Показать панель</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Скрыть панель</span>
          </>
        )}
      </button>

      {/* Main Dock Panel */}
      {!collapsed && (
        <div className="pointer-events-auto w-full rounded-2xl bg-[#0c101a]/96 border border-white/12 shadow-2xl p-3.5 transition-transform duration-150">
          {/* Top Row: Mode Tabs + Primary Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/8">
            {/* Segmented Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#07090e] border border-white/6">
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'presets'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Локации ({FRACTAL_PRESETS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('parameters')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'parameters'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Итерации и масштаб</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('coloring')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'coloring'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Раскраска и 3D</span>
              </button>
            </div>

            {/* Direct Zoom & Reset Controls */}
            <div className="flex items-center gap-1.5">
              {/* Click Zoom Direction Toggle */}
              <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-[#07090e] border border-white/8 text-xs">
                <button
                  type="button"
                  onClick={() => onChangeClickZoomMode('in')}
                  className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    state.clickZoomMode === 'in'
                      ? 'bg-white/12 text-amber-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Щелчок мыши приближает область"
                >
                  Клик: +Масштаб
                </button>
                <button
                  type="button"
                  onClick={() => onChangeClickZoomMode('out')}
                  className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    state.clickZoomMode === 'out'
                      ? 'bg-white/12 text-amber-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Щелчок мыши отдаляет область"
                >
                  Клик: −Масштаб
                </button>
              </div>

              <button
                type="button"
                onClick={() => onStepZoom(2.2)}
                className="p-2 rounded-lg bg-[#141b2d] hover:bg-[#1e2942] border border-white/10 text-slate-200 transition-colors"
                title="Приблизить (Zoom In)"
                aria-label="Приблизить"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onStepZoom(1 / 2.2)}
                className="p-2 rounded-lg bg-[#141b2d] hover:bg-[#1e2942] border border-white/10 text-slate-200 transition-colors"
                title="Отдалить (Zoom Out)"
                aria-label="Отдалить"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onResetZoom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141b2d] hover:bg-amber-500 hover:text-slate-950 border border-white/10 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
                title="Сбросить масштаб к начальному виду (клавиша R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Сброс масштаба</span>
              </button>

              <button
                type="button"
                onClick={onCaptureScreenshot}
                className="p-2 rounded-lg bg-[#141b2d] hover:bg-[#1e2942] border border-white/10 text-slate-200 transition-colors"
                title="Сохранить снимок экрана (PNG)"
                aria-label="Сохранить снимок"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tab 1: Presets */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {FRACTAL_PRESETS.map((preset) => {
                const isSelected = state.activePresetId === preset.id;
                const pal = COLOR_PALETTES[preset.paletteId] || COLOR_PALETTES[0];
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className={`group text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#172036] border-amber-500/70 shadow-sm'
                        : 'bg-[#07090e]/90 border-white/8 hover:border-white/20 hover:bg-[#111726]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-0.5">
                          {pal.swatch.map((hex, i) => (
                            <span
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono-tabular text-slate-400">
                          {preset.zoom >= 1000
                            ? `${(preset.zoom / 1000).toFixed(1)}k×`
                            : `${preset.zoom}×`}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition-colors truncate">
                        {preset.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {preset.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 2: Iterations & Precision Controls */}
          {activeTab === 'parameters' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-1">
              <div className="md:col-span-6 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="iter-slider" className="text-slate-300 font-medium">
                    Глубина расчёта (макс. итераций)
                  </label>
                  <span className="font-mono-tabular text-amber-400 font-semibold">
                    {effectiveIter} итер.
                  </span>
                </div>
                <input
                  id="iter-slider"
                  type="range"
                  min={64}
                  max={4000}
                  step={16}
                  value={state.maxIterations}
                  onChange={(e) => onChangeIterations(Number(e.target.value))}
                  className="w-full fractal-slider"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-mono-tabular">
                  <span>64 (быстро)</span>
                  <span>1000</span>
                  <span>2500</span>
                  <span>4000 (глубоко)</span>
                </div>
              </div>

              <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onToggleAutoIterations}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    state.autoIterations
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                      : 'bg-[#07090e] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  Авто-адаптация итераций: {state.autoIterations ? 'Вкл' : 'Выкл'}
                </button>

                <button
                  type="button"
                  onClick={onToggleJuliaPreview}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    state.juliaPreview
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                      : 'bg-[#07090e] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Инспектор Жюлиа: {state.juliaPreview ? 'Вкл' : 'Выкл'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Smooth Coloring, Palettes & 3D Relief */}
          {activeTab === 'coloring' && (
            <div className="space-y-3">
              {/* Palette Selector Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {COLOR_PALETTES.map((pal) => {
                  const active = state.paletteId === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => onSelectPalette(pal.id)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-[#172036] border-amber-500/70'
                          : 'bg-[#07090e] border-white/8 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1.5">
                        {pal.swatch.map((hex, idx) => (
                          <span
                            key={idx}
                            className="h-2.5 flex-1 first:rounded-l-sm last:rounded-r-sm"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] font-medium text-slate-200 truncate">
                        {pal.name}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Smooth Coloring & 3D Relief Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                  <span className="text-xs text-slate-300 whitespace-nowrap">
                    Плотность спектра:
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    value={state.colorCycles}
                    onChange={(e) => onChangeColorCycles(Number(e.target.value))}
                    className="w-full max-w-[180px] fractal-slider"
                  />
                  <span className="text-xs font-mono-tabular text-amber-400">
                    {state.colorCycles.toFixed(1)}×
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleSmoothColoring}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      state.smoothColoring
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                        : 'bg-[#07090e] border-white/10 text-slate-400'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Плавный градиент: {state.smoothColoring ? 'Вкл' : 'Выкл'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleAnimateColors}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      state.animateColors
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                        : 'bg-[#07090e] border-white/10 text-slate-400'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Фазовый цикл: {state.animateColors ? 'Вкл' : 'Выкл'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleRelief3D}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      state.relief3D
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                        : 'bg-[#07090e] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>3D-рельеф потенциала: {state.relief3D ? 'Вкл' : 'Выкл'}</span>
                  </button>
                </div>
              </div>

              {/* Conditional 3D Relief Specular / Illumination Slider */}
              {state.relief3D && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 mt-1 border-t border-white/8">
                  <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                    <label
                      htmlFor="relief-specular-slider"
                      className="text-xs text-amber-300 font-medium whitespace-nowrap"
                    >
                      Освещённость 3D-рельефа (спекулярные блики):
                    </label>
                    <input
                      id="relief-specular-slider"
                      type="range"
                      min={0.0}
                      max={1.2}
                      step={0.05}
                      value={state.reliefSpecular}
                      onChange={(e) => onChangeReliefSpecular(Number(e.target.value))}
                      className="w-full max-w-[220px] fractal-slider"
                    />
                    <span className="text-xs font-mono-tabular text-amber-400 font-semibold">
                      {Math.round((state.reliefSpecular / 1.2) * 100)}%
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Интенсивность отражения ключевого источника света на гребнях потенциала
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
