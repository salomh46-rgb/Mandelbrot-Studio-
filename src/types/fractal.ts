export interface ComplexCoord {
  re: number;
  im: number;
}

export interface FractalPreset {
  id: string;
  name: string;
  subtitle: string;
  center: ComplexCoord;
  zoom: number;
  recommendedIterations: number;
  paletteId: number;
  colorCycles: number;
  description: string;
}

export interface ColorPalette {
  id: number;
  name: string;
  swatch: [string, string, string, string];
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  d: [number, number, number];
}

export type ClickZoomMode = 'in' | 'out';

export interface FractalState {
  center: ComplexCoord;
  zoom: number;
  maxIterations: number;
  autoIterations: boolean;
  paletteId: number;
  colorCycles: number;
  colorOffset: number;
  animateColors: boolean;
  smoothColoring: boolean;
  relief3D: boolean;
  reliefHeight: number;
  reliefSpecular: number;
  juliaPreview: boolean;
  juliaSeed: ComplexCoord;
  clickZoomMode: ClickZoomMode;
  activePresetId: string | null;
}
