// Constants for DSP
export const SAMPLE_RATE = 16000; // Default/Target sample rate
export const FRAME_SIZE = 512;
export const HOP_SIZE = 256;
export const MEL_FILTERS = 26;
export const NUM_CEPSTRA = 13;

// --- 1. Windowing Function (Hamming) ---
export const hammingWindow = (frame: number[]): number[] => {
  return frame.map((sample, i) => {
    return sample * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frame.length - 1)));
  });
};

// --- Time Domain Features ---
export const computeShortTimeEnergy = (frame: number[]): number => {
  let sum = 0;
  for (let x of frame) sum += x * x;
  return sum; // Total energy of frame
};

export const computeZCR = (frame: number[]): number => {
  let zcr = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i] >= 0 && frame[i - 1] < 0) || (frame[i] < 0 && frame[i - 1] >= 0)) {
      zcr++;
    }
  }
  return zcr / (frame.length - 1);
};

// --- 2. FFT (Cooley-Tukey Recursive) ---
class Complex {
  constructor(public real: number, public imag: number) {}
}

const fft = (x: Complex[]): Complex[] => {
  const N = x.length;
  if (N <= 1) return x;

  const even = new Array(N / 2);
  const odd = new Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    even[i] = x[2 * i];
    odd[i] = x[2 * i + 1];
  }

  const evenFFT = fft(even);
  const oddFFT = fft(odd);

  const combined = new Array(N);
  for (let k = 0; k < N / 2; k++) {
    const angle = -2 * Math.PI * k / N;
    const tReal = Math.cos(angle) * oddFFT[k].real - Math.sin(angle) * oddFFT[k].imag;
    const tImag = Math.cos(angle) * oddFFT[k].imag + Math.sin(angle) * oddFFT[k].real;

    combined[k] = new Complex(evenFFT[k].real + tReal, evenFFT[k].imag + tImag);
    combined[k + N / 2] = new Complex(evenFFT[k].real - tReal, evenFFT[k].imag - tImag);
  }
  return combined;
};

// Returns Magnitude Spectrum (First N/2 bins)
export const computeSpectrum = (buffer: number[]): number[] => {
  const n = buffer.length;
  // Pad to power of 2 if necessary (though FRAME_SIZE 512 is pow 2)
  const complexBuffer = buffer.map(v => new Complex(v, 0));
  
  const fftResult = fft(complexBuffer);
  
  // Return magnitude of first N/2
  const magnitude = [];
  for(let i=0; i < n/2; i++) {
      const c = fftResult[i];
      magnitude.push(Math.sqrt(c.real * c.real + c.imag * c.imag));
  }
  
  return magnitude;
};

// --- 3. Mel Filterbank ---
const hzToMel = (f: number) => 1127 * Math.log(1 + f / 700);
const melToHz = (m: number) => 700 * (Math.exp(m / 1127) - 1);

// Precompute filterbank (simplified)
export const computeMelEnergies = (spectrum: number[], sampleRate: number): number[] => {
  const numFilters = MEL_FILTERS;
  const minMel = hzToMel(0);
  const maxMel = hzToMel(sampleRate / 2);
  const melStep = (maxMel - minMel) / (numFilters + 1);
  
  const melPoints = Array.from({ length: numFilters + 2 }, (_, i) => melToHz(minMel + i * melStep));
  const binPoints = melPoints.map(hz => Math.floor((frameSizeToBin(hz, sampleRate, spectrum.length * 2))));

  const energies = new Array(numFilters).fill(0);

  for (let m = 1; m <= numFilters; m++) {
    const start = binPoints[m - 1];
    const center = binPoints[m];
    const end = binPoints[m + 1];

    for (let k = start; k < center; k++) {
      if (k < spectrum.length)
        energies[m - 1] += spectrum[k] * ((k - start) / (center - start));
    }
    for (let k = center; k < end; k++) {
      if (k < spectrum.length)
        energies[m - 1] += spectrum[k] * ((end - k) / (end - center));
    }
  }

  // Log energies
  return energies.map(e => Math.log(Math.max(e, 1e-6)));
};

const frameSizeToBin = (hz: number, sampleRate: number, fftSize: number) => {
  return (hz * fftSize) / sampleRate;
};

// --- 4. DCT (Discrete Cosine Transform) for MFCC ---
// Type-II DCT
export const computeDCT = (logEnergies: number[]): number[] => {
  const N = logEnergies.length;
  const mfccs = new Array(NUM_CEPSTRA).fill(0);
  
  for (let k = 0; k < NUM_CEPSTRA; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += logEnergies[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    // Orthogonal normalization scaling could be applied here
    mfccs[k] = sum;
  }
  return mfccs; 
};

// --- 5. Full Pipeline Helper ---
export const processAudioFrame = (rawFrame: number[], sampleRate: number = 16000): any => {
    const zcr = computeZCR(rawFrame);
    const energy = computeShortTimeEnergy(rawFrame);
    
    const windowed = hammingWindow(rawFrame);
    const spectrum = computeSpectrum(windowed);
    const melEnergies = computeMelEnergies(spectrum, sampleRate);
    const mfcc = computeDCT(melEnergies);
    
    return { raw: rawFrame, windowed, spectrum, melEnergies, mfcc, zcr, energy };
};

// --- 6. DTW (Dynamic Time Warping) ---
// Euclidean distance between two vectors
const euclideanDist = (v1: number[], v2: number[]): number => {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) { 
        // Often skip 0th (energy) coeff in MFCC for matching, but keeping it here is fine for simple demo
        const diff = v1[i] - v2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
};

export const computeDTW = (seq1: number[][], seq2: number[][]): { distance: number, path: [number, number][] } => {
    const n = seq1.length;
    const m = seq2.length;
    
    // Initialize cost matrix
    const dtw = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
    dtw[0][0] = 0;
    
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = euclideanDist(seq1[i-1], seq2[j-1]);
            dtw[i][j] = cost + Math.min(
                dtw[i-1][j],   // insertion
                dtw[i][j-1],   // deletion
                dtw[i-1][j-1]  // match
            );
        }
    }
    
    // Backtrack for path
    const path: [number, number][] = [];
    let i = n;
    let j = m;
    while(i > 0 && j > 0) {
        path.push([i-1, j-1]);
        const minPrev = Math.min(dtw[i-1][j], dtw[i][j-1], dtw[i-1][j-1]);
        if (minPrev === dtw[i-1][j-1]) { i--; j--; }
        else if (minPrev === dtw[i-1][j]) { i--; }
        else { j--; }
    }

    return { distance: dtw[n][m], path: path.reverse() };
};