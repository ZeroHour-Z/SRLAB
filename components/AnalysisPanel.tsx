import React from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AudioFrame } from '../types';

interface AnalysisPanelProps {
  frame: AudioFrame | null;
}

const ChartCard: React.FC<{ title: string; children: React.ReactNode; info?: string }> = ({ title, children, info }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-72 transition-shadow hover:shadow-md">
    <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">{title}</h3>
        {info && <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{info}</span>}
    </div>
    <div className="flex-1 min-h-0">
        {children}
    </div>
  </div>
);

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ frame }) => {
  if (!frame) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
        Select a recording to analyze its signal properties.
      </div>
    );
  }

  // Prepare data for Recharts
  const timeData = frame.windowed.map((v, i) => ({ i, raw: frame.raw[i], windowed: v }));
  const spectrumData = frame.spectrum.map((v, i) => ({ f: i, mag: v }));
  const melData = frame.melEnergies.map((v, i) => ({ idx: i, energy: v }));
  const mfccData = frame.mfcc.map((v, i) => ({ idx: i, value: v }));

  // Classification Logic
  let classification = "Silence/Noise";
  if (frame.energy > 0.1) {
      if (frame.zcr > 0.4) classification = "Unvoiced (Fricative)";
      else classification = "Voiced (Vowel)";
  }

  return (
    <div className="space-y-6 mt-6">
        {/* Row 1: Time Domain Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="md:col-span-2">
                <ChartCard title="Time Domain" info={`Samples: ${frame.raw.length}`}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis hide />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip 
                                contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none', fontSize: '12px', color: '#1d1d1f'}} 
                                itemStyle={{color: '#1d1d1f'}}
                            />
                            <Line type="monotone" dataKey="raw" stroke="#C7C7CC" dot={false} strokeWidth={1} name="Raw Signal" />
                            <Line type="monotone" dataKey="windowed" stroke="#007AFF" dot={false} strokeWidth={2} name="Hamming Window" />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
             </div>
             
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-72 justify-between">
                 <h3 className="text-sm font-semibold text-gray-900 mb-2">Signal Features</h3>
                 
                 <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-500">Short-Time Energy</span>
                            <span className="text-sm font-mono font-semibold text-blue-600">{frame.energy.toFixed(4)}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{width: `${Math.min(frame.energy * 20, 100)}%`}}></div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-500">Zero Crossing Rate</span>
                            <span className="text-sm font-mono font-semibold text-pink-500">{frame.zcr.toFixed(3)}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 rounded-full transition-all duration-300" style={{width: `${frame.zcr * 100}%`}}></div>
                        </div>
                    </div>
                 </div>

                 <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mt-auto">
                     <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Classification</div>
                     <div className="text-base font-bold text-gray-800">{classification}</div>
                 </div>
             </div>
        </div>

        {/* Row 2: Frequency Domain */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ChartCard title="FFT Spectrum" info="Magnitude">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spectrumData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis hide />
                        <YAxis hide />
                        <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none'}} />
                        <Area type="monotone" dataKey="mag" stroke="#5856D6" fill="#5856D6" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Mel Filterbank" info="Log Energy">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={melData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="idx" tick={{fill: '#86868b', fontSize: 10}} interval={4} axisLine={false} tickLine={false}/>
                        <YAxis hide />
                        <Tooltip cursor={{fill: '#f5f5f7'}} contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none'}} />
                        <Bar dataKey="energy" fill="#AF52DE" radius={[4, 4, 4, 4]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="MFCC" info="DCT Output">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mfccData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="idx" tick={{fill: '#86868b', fontSize: 10}} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: '#f5f5f7'}} contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none'}} />
                        <Bar dataKey="value" fill="#FF9500" radius={[4, 4, 4, 4]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>
        </div>
    </div>
  );
};

export default AnalysisPanel;