export interface AudioFrame {
  raw: number[];
  windowed: number[];
  spectrum: number[]; // Magnitude spectrum
  melEnergies: number[];
  mfcc: number[];
  // Time-domain features
  zcr: number;
  energy: number;
}

export interface RecordingSession {
  id: string;
  label: string;
  blob: Blob;
  audioData: Float32Array; // The full raw audio
  frames: AudioFrame[]; // Processed frames for analysis
}

export enum AppTab {
  ANALYSIS = 'ANALYSIS',
  DTW_MATCHING = 'DTW_MATCHING'
}

export interface DtwResult {
  distance: number;
  path: [number, number][];
  referenceId: string;
  referenceLabel: string;
}