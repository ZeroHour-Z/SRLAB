import React, { useState, useRef } from 'react';
import { Mic, Square, Activity, Radio, Settings2, Trash2, CheckCircle2, Waves } from 'lucide-react';
import Visualizer from './components/Visualizer';
import AnalysisPanel from './components/AnalysisPanel';
import { AppTab, AudioFrame, RecordingSession, DtwResult } from './types';
import { FRAME_SIZE, SAMPLE_RATE, processAudioFrame, computeDTW } from './utils/dspUtils';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.ANALYSIS);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string>('Ready');
  
  // Audio Context Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sampleRateRef = useRef<number>(SAMPLE_RATE); 
  
  // Data Storage
  const rawBufferRef = useRef<number[]>([]);
  const [currentRecording, setCurrentRecording] = useState<RecordingSession | null>(null);
  const [templates, setTemplates] = useState<RecordingSession[]>([]);
  const [matchResult, setMatchResult] = useState<DtwResult | null>(null);

  // Initialize Audio
  const startRecording = async (label: string = "Recording") => {
    try {
      rawBufferRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      sampleRateRef.current = ctx.sampleRate;
      audioCtxRef.current = ctx;
      
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i++) {
            rawBufferRef.current.push(input[i]);
        }
      };
      processorRef.current = processor;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(ctx.destination);

      setIsRecording(true);
      setStatus(`Recording (${ctx.sampleRate}Hz)...`);
      setMatchResult(null);
    } catch (err) {
      console.error(err);
      setStatus('Microphone Access Denied');
    }
  };

  const stopRecording = async (saveAsTemplate: boolean = false, templateLabel: string = "Template") => {
    if (!audioCtxRef.current || !mediaStreamRef.current) return;

    mediaStreamRef.current.getTracks().forEach(track => track.stop());
    processorRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioCtxRef.current.close();

    setIsRecording(false);
    setStatus('Processing...');

    const rawData = new Float32Array(rawBufferRef.current);
    const actualSampleRate = sampleRateRef.current;
    
    const frames: AudioFrame[] = [];
    const step = FRAME_SIZE / 2;
    const silenceThreshold = 0.01;

    for (let i = 0; i < rawData.length - FRAME_SIZE; i += step) {
      const chunk = Array.from(rawData.slice(i, i + FRAME_SIZE));
      const energy = Math.sqrt(chunk.reduce((acc, val) => acc + val*val, 0) / chunk.length);
      
      if (energy > silenceThreshold) {
          frames.push(processAudioFrame(chunk, actualSampleRate));
      }
    }

    if (frames.length === 0 && rawData.length > 0) {
        const mid = Math.floor(rawData.length / 2);
        const chunk = Array.from(rawData.slice(mid, mid + FRAME_SIZE));
        frames.push(processAudioFrame(chunk, actualSampleRate));
    }

    const session: RecordingSession = {
      id: Date.now().toString(),
      label: saveAsTemplate ? templateLabel : "Input",
      blob: new Blob([rawData], { type: 'audio/wav' }),
      audioData: rawData,
      frames: frames
    };

    setCurrentRecording(session);

    if (saveAsTemplate) {
      setTemplates(prev => [...prev, session]);
      setStatus(`Saved: ${templateLabel}`);
    } else {
      setStatus('Done');
      if (activeTab === AppTab.DTW_MATCHING) {
        performDTW(session);
      }
    }
  };

  const performDTW = (input: RecordingSession) => {
    if (templates.length === 0) {
        setStatus("No templates");
        return;
    }

    let bestDist = Infinity;
    let bestMatch: RecordingSession | null = null;
    let bestPath: [number, number][] = [];

    const inputMFCCs = input.frames.map(f => f.mfcc);

    templates.forEach(template => {
        const templateMFCCs = template.frames.map(f => f.mfcc);
        const { distance, path } = computeDTW(inputMFCCs, templateMFCCs);
        const normalizedDist = distance / (inputMFCCs.length + templateMFCCs.length);

        if (normalizedDist < bestDist) {
            bestDist = normalizedDist;
            bestMatch = template;
            bestPath = path;
        }
    });

    if (bestMatch) {
        setMatchResult({
            distance: bestDist,
            path: bestPath,
            referenceId: bestMatch.id,
            referenceLabel: bestMatch.label
        });
        setStatus(`Match: ${bestMatch.label}`);
    }
  };

  return (
    <div className="min-h-screen text-gray-900 pb-20 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Apple-style Blur Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <Waves size={18} />
                </div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">
                  SRLAB
                </h1>
            </div>
            
            <div className="flex items-center space-x-3">
                <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${isRecording ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span>{status}</span>
                </div>
            </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8 space-y-8">
        
        {/* iOS Segmented Control */}
        <div className="flex justify-center">
            <div className="bg-gray-100/80 p-1 rounded-xl inline-flex space-x-1 border border-gray-200/50">
                {[
                    { id: AppTab.ANALYSIS, label: "信号分析" },
                    { id: AppTab.DTW_MATCHING, label: "语音识别" }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => !isRecording && setActiveTab(tab.id)}
                        className={`px-6 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            activeTab === tab.id 
                            ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' 
                            : 'text-gray-500 hover:text-gray-700'
                        } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Top Section: Visualizer & Controls */}
        <div className="bg-white rounded-3xl p-1 shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6 md:p-8 flex flex-col items-center justify-center space-y-6">
                <div className="w-full max-w-2xl">
                    <Visualizer analyser={analyserRef.current} isRecording={isRecording} />
                </div>
                
                <div className="flex items-center space-x-6">
                    {!isRecording ? (
                        <button 
                            onClick={() => startRecording()}
                            className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 transition-all hover:scale-105 active:scale-95"
                        >
                             <Mic className="text-white fill-current" size={28} />
                        </button>
                    ) : (
                        <button 
                            onClick={() => stopRecording(false)}
                            className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-gray-900 hover:bg-black shadow-lg shadow-gray-300 transition-all hover:scale-105 active:scale-95"
                        >
                            <Square className="text-white fill-current" size={24} />
                        </button>
                    )}
                </div>
                <div className="text-xs text-gray-400 font-medium tracking-wide">
                    {isRecording ? "点击停止" : "点击麦克风开始录制"}
                </div>
             </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Main View */}
          <div className="lg:col-span-8 space-y-6">
            
            {activeTab === AppTab.ANALYSIS && (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="mb-4 flex items-center space-x-2 text-sm text-gray-500">
                    <Activity size={16} className="text-blue-500"/>
                    <span>信号处理</span>
                 </div>
                 <AnalysisPanel frame={currentRecording?.frames[Math.floor(currentRecording.frames.length / 2)] || null} />
               </div>
            )}

            {activeTab === AppTab.DTW_MATCHING && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Card: Add Template */}
                         <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center space-x-2 mb-4">
                                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
                                        <Settings2 size={20}/>
                                    </div>
                                    <h3 className="font-semibold text-gray-900">语音数据</h3>
                                </div>
                                <p className="text-sm text-gray-500 mb-4">训练系统识别特定的语音数据。</p>
                                
                                <input 
                                    type="text" 
                                    id="templateName"
                                    placeholder="数据命名 (如：一)" 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all mb-3"
                                />
                            </div>
                            
                            <button 
                                onClick={() => {
                                    const input = document.getElementById('templateName') as HTMLInputElement;
                                    const label = input.value || `Cmd ${templates.length+1}`;
                                    if(!isRecording) {
                                        startRecording(label);
                                    } else {
                                        stopRecording(true, label);
                                    }
                                }}
                                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                                    isRecording 
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-200' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                }`}
                            >
                                {isRecording ? "停止并保存" : "录制语音数据"}
                            </button>
                         </div>

                         {/* Card: Result */}
                         <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            {matchResult ? (
                                <>
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 mb-1">{matchResult.referenceLabel}</div>
                                    <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full mt-2">
                                        相似度评分: {matchResult.distance.toFixed(4)}
                                    </div>
                                </>
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                        <Radio size={24} />
                                    </div>
                                    <p className="text-sm">录制语音以匹配现有模板</p>
                                </div>
                            )}
                         </div>
                    </div>

                    {/* Template List */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 ml-1">模板库</h3>
                        <div className="space-y-2">
                            {templates.map((t) => (
                                <div key={t.id} className="group flex justify-between items-center p-3 hover:bg-gray-50 rounded-2xl transition-colors border border-transparent hover:border-gray-200">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 text-xs font-bold">
                                            {t.label.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{t.label}</div>
                                            <div className="text-xs text-gray-500">{t.frames.length} 帧</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setTemplates(templates.filter(temp => temp.id !== t.id))}
                                        className="text-gray-300 hover:text-red-500 p-2 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {templates.length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-sm">暂无保存的模板。</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* Right Column: Info & Legend */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">规格参数</h3>
                <div className="space-y-0 divide-y divide-gray-100">
                    <InfoItem label="采样率" value={`${sampleRateRef.current || SAMPLE_RATE} Hz`} />
                    <InfoItem label="帧大小" value={`${FRAME_SIZE} samples`} />
                    <InfoItem label="特征向量" value="MFCC-13" />
                    <InfoItem label="滤波器组" value="26 Mel" />
                    <InfoItem label="窗函数" value="Hamming" />
                </div>
            </div>
            
            {activeTab === AppTab.DTW_MATCHING && matchResult && (
               <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                   <h3 className="text-sm font-semibold text-gray-900 mb-4">Alignment Path</h3>
                   <div className="aspect-square bg-gray-50 rounded-xl border border-gray-100 relative p-4">
                       <svg width="100%" height="100%" viewBox={`0 0 ${currentRecording?.frames.length || 100} ${matchResult.path.length > 0 ? Math.max(...matchResult.path.map(p => p[1])) : 100}`} className="overflow-visible">
                            <path 
                                d={`M ${matchResult.path.map(p => `${p[0]} ${p[1]}`).join(' L ')}`} 
                                fill="none" 
                                stroke="#007AFF" 
                                strokeWidth="3" 
                                strokeLinecap="round"
                            />
                       </svg>
                       <div className="absolute bottom-2 left-4 text-[10px] text-gray-400 font-medium">Input Sequence</div>
                       <div className="absolute top-4 left-2 text-[10px] text-gray-400 font-medium" style={{writingMode: 'vertical-lr'}}>Template Sequence</div>
                   </div>
               </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between items-center py-3">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm font-medium text-gray-900 font-mono">{value}</span>
    </div>
);

export default App;