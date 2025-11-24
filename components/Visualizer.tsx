import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
  color?: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isRecording, color = '#007AFF' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!analyser || !isRecording) {
        // Draw flat line if not recording - Clean look for light mode
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Optional: Draw a faint grid or center line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = '#E5E5EA'; // System Gray 5
        ctx.lineWidth = 1;
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      // Light mode fade effect: Fill with semi-transparent WHITE
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isRecording, color]);

  return (
    <div className="w-full h-40 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={160} 
        className="w-full h-full"
      />
      {/* Glossy reflection overlay hint */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/50 to-transparent opacity-50"></div>
    </div>
  );
};

export default Visualizer;