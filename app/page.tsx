'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Copy, Share2, RefreshCw, Image as ImageIcon, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const BackgroundBlobs = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 mix-blend-multiply opacity-20 dark:mix-blend-screen dark:opacity-60 pointer-events-none">
        {[1, 2, 3].map((i) => (
            <motion.div
                key={i}
                className="absolute rounded-full bg-orange filter blur-[100px] md:blur-[140px] opacity-30"
                style={{
                    width: i === 1 ? '45vw' : i === 2 ? '35vw' : '50vw',
                    height: i === 1 ? '45vw' : i === 2 ? '35vw' : '50vw',
                    top: i === 1 ? '10%' : i === 2 ? '40%' : '-10%',
                    left: i === 1 ? '10%' : i === 2 ? 'auto' : '30%',
                    right: i === 2 ? '10%' : 'auto',
                }}
                animate={{
                    x: ['0%', i === 1 ? '15%' : i === 2 ? '-20%' : '10%', i === 1 ? '-5%' : '10%', '0%'],
                    y: ['0%', i === 1 ? '10%' : '-15%', i === 3 ? '5%' : '10%', '0%'],
                }}
                transition={{
                    duration: 30 + i * 10,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
        ))}
    </div>
);

export default function Page() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dotSize, setDotSize] = useState(8);
  const [contrast, setContrast] = useState(1);
  const [circleCrop, setCircleCrop] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(() => {
    if (!imageSrc || !canvasRef.current) return;

    setIsProcessing(true);
    setError(null);

    // Use a timeout to allow the UI to update the loading state before synchronous canvas work blocks the main thread
    setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_SIZE = 800; // Limit processing resolution for performance
          let width = img.width;
          let height = img.height;
          
          if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            } else {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          // Offscreen hidden canvas for scaling and reading data
          const hiddenCanvas = document.createElement('canvas');
          hiddenCanvas.width = width;
          hiddenCanvas.height = height;
          const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
          if (!hiddenCtx) throw new Error("Could not get 2D context");

          // Draw scaled image
          hiddenCtx.drawImage(img, 0, 0, width, height);

          // Get image data for processing
          const imgData = hiddenCtx.getImageData(0, 0, width, height);
          const data = imgData.data;

          // Output canvas settings
          const canvas = canvasRef.current;
          if (!canvas) return;

          let outWidth = width;
          let outHeight = height;
          let offsetX = 0;
          let offsetY = 0;

          if (circleCrop) {
            const size = Math.min(width, height);
            outWidth = size;
            outHeight = size;
            offsetX = (width - size) / 2;
            offsetY = (height - size) / 2;
          }
          
          canvas.width = outWidth;
          canvas.height = outHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("Could not get output 2D context");

          // Fill Canvas Background
          ctx.clearRect(0, 0, outWidth, outHeight);
          
          if (circleCrop) {
            ctx.beginPath();
            ctx.arc(outWidth / 2, outHeight / 2, outWidth / 2, 0, Math.PI * 2);
            ctx.clip(); // Mask the output to a circle
            ctx.fillStyle = '#F5E6D3'; // Cream
            ctx.fill();
          } else {
            ctx.fillStyle = '#F5E6D3'; // Cream
            ctx.fillRect(0, 0, outWidth, outHeight);
          }

          ctx.fillStyle = '#E8622A'; // Orange for dots

          // Apply Halftone Dot-Matrix
          for (let y = offsetY; y < offsetY + outHeight; y += dotSize) {
            for (let x = offsetX; x < offsetX + outWidth; x += dotSize) {
              
              let totalBrightness = 0;
              let pixelCount = 0;

              // Read average brightness from source area
              for (let cy = 0; cy < dotSize; cy++) {
                for (let cx = 0; cx < dotSize; cx++) {
                  const px = Math.floor(x + cx);
                  const py = Math.floor(y + cy);
                  if (px < width && py < height) {
                     const i = (py * width + px) * 4;
                     const r = data[i];
                     const g = data[i + 1];
                     const b = data[i + 2];
                     
                     // simple average brightness
                     totalBrightness += (r + g + b) / 3;
                     pixelCount++;
                  }
                }
              }

              if (pixelCount === 0) continue;

              let avgBrightness = totalBrightness / pixelCount; // 0-255

              // Apply contrast
              // scale to -0.5 to 0.5 roughly, apply multiplier, scale back
              let normalized = avgBrightness / 255;
              normalized = (normalized - 0.5) * contrast + 0.5;
              normalized = Math.max(0, Math.min(1, normalized)); // clamp

              // In halftone, darker areas = larger dots
              let radius = (1 - normalized) * (dotSize / 1.414); // Allow slight overlap for full coverage of pitch black
              radius = Math.max(0, Math.min(dotSize * 0.8, radius)); // Limit max size

              if (radius > 0.5) {
                ctx.beginPath();
                ctx.arc((x - offsetX) + dotSize/2, (y - offsetY) + dotSize/2, radius, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        } catch (err: any) {
          setError(err.message || "Failed to process image");
        } finally {
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        setError("Failed to load image");
        setIsProcessing(false);
      };
      img.src = imageSrc;
    }, 50);

  }, [imageSrc, dotSize, contrast, circleCrop]);

  useEffect(() => {
    if (imageSrc) {
      processImage();
    }
  }, [imageSrc, dotSize, contrast, circleCrop, processImage]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
        setError("Please upload a valid image file.");
        return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDownload = () => {
    if (canvasRef.current) {
        const url = canvasRef.current.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'midend-pfp.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
  };

  const handleCopy = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => {
        if (blob) {
            navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            }).catch(err => {
                console.error("Failed to copy", err);
            });
        }
    });
  };

  const reset = () => {
    setImageSrc(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <main className="min-h-screen relative bg-page text-text-main flex flex-col p-4 md:p-8 overflow-x-hidden font-sans selection:bg-orange selection:text-page transition-colors duration-300">
      <BackgroundBlobs />
      <header className="relative z-10 flex flex-wrap justify-between items-center mb-8 border-b border-border-subtle pb-4 w-full max-w-6xl mx-auto gap-4">
        <div className="flex flex-col">
          <h1 className="text-4xl md:text-5xl font-space font-bold text-orange tracking-tighter uppercase">Get Miden&apos;d</h1>
          <p className="text-xs text-text-muted tracking-[0.2em] uppercase mt-1">Turn your pfp into Miden themed Pixel Art</p>
        </div>
        <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-full border border-border-subtle bg-surface hover:bg-surface-hover transition-colors text-text-main"
            title="Toggle theme"
        >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-sm font-medium max-w-6xl w-full mx-auto">
              {error}
          </div>
      )}

      {!imageSrc ? (
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className={`w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center items-center border border-dashed rounded-3xl p-12 lg:p-24 text-center transition-all duration-300 min-h-[400px] cursor-pointer group relative z-10 shadow-sm ${isDragging ? 'border-orange bg-orange/5 scale-[1.02]' : 'border-border-strong bg-surface/50 hover:bg-surface'}`}
           onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
           onDragLeave={() => setIsDragging(false)}
           onDrop={handleDrop}
           onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={onFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <Upload className="w-8 h-8 text-text-muted mb-4 group-hover:block transition-all group-hover:scale-110 group-hover:text-orange" />
          <p className="text-[11px] uppercase tracking-widest text-text-muted">Drag image to start over, or click to browse</p>
        </motion.div>
      ) : (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="w-full max-w-6xl mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-h-0 relative z-10"
        >
            <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="relative flex flex-col md:flex-row gap-6 w-full items-center justify-center bg-surface p-6 lg:p-8 rounded-3xl border border-border-subtle group overflow-hidden min-h-[400px] shadow-sm">
                    <div className="absolute inset-0 halftone-preview opacity-[0.15] dark:opacity-90 pointer-events-none transition-opacity duration-500"></div>
                    
                    {/* Resolution badge */}
                    <div className="absolute bottom-4 right-4 bg-black/40 px-3 py-1 rounded text-[10px] text-white/50 border border-white/5 z-20 font-mono">
                        1024 x 1024 PX
                    </div>
                    {/* Engine badge */}
                    <div className="absolute top-4 left-4 text-[10px] font-mono text-text-muted z-20 hidden md:block mix-blend-difference text-white">RENDER_ENGINE: MIDEN_DOT_V1.0</div>
                    
                    {/* Central pill for before/after layout */}
                    <div className="absolute z-20 top-4 pt-1 bg-page/80 backdrop-blur-md px-6 py-2 rounded-full border border-border-subtle hidden md:flex items-center gap-4 shadow-xl">
                         <span className="text-xs font-semibold uppercase tracking-wider text-orange flex items-center gap-2">
                             After {isProcessing && <RefreshCw className="w-3 h-3 animate-spin"/>}
                         </span>
                         <div className="h-4 w-[1px] bg-border-strong"></div>
                         <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Before</span>
                    </div>

                    {/* After */}
                    <div className="w-full max-w-[320px] lg:max-w-[400px] flex flex-col gap-3 items-center z-10">
                        <div className="relative w-full aspect-square flex items-center justify-center rounded-2xl ring-1 ring-border-strong bg-black/50 overflow-hidden group shadow-2xl">
                            <canvas 
                                ref={canvasRef} 
                                className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${isProcessing ? 'opacity-40' : 'opacity-100'} ${circleCrop ? 'rounded-full' : 'rounded-2xl'}`} 
                            />
                            <AnimatePresence>
                                {isProcessing && (
                                    <motion.div 
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex items-center justify-center bg-page/50 backdrop-blur-sm"
                                    >
                                        <div className="flex flex-col items-center gap-4">
                                            <RefreshCw className="w-8 h-8 text-orange animate-spin" />
                                            <span className="text-[10px] font-mono text-orange animate-pulse bg-page/80 px-2 py-1 rounded">RENDERING...</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <span className="md:hidden text-[10px] uppercase tracking-widest text-[#E8622A] font-bold font-space flex items-center gap-2 mt-2">
                            After
                            {isProcessing && <RefreshCw className="w-3 h-3 animate-spin"/>}
                        </span>
                    </div>

                    {/* Before */}
                    <div className="w-full max-w-[120px] md:max-w-[160px] flex flex-col gap-3 items-center z-10 md:absolute md:bottom-8 md:bg-page/60 md:p-3 md:rounded-2xl md:backdrop-blur-sm md:border md:border-border-subtle md:left-8">
                        <div className="relative w-full aspect-square rounded-xl overflow-hidden ring-1 ring-border-strong bg-black/50 shadow-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imageSrc} className={`w-full h-full object-cover transition-all ${circleCrop ? 'rounded-full scale-[0.98]' : 'rounded-xl'}`} alt="Original" />
                        </div>
                        <span className="md:hidden text-[10px] uppercase tracking-widest text-text-muted font-bold font-space text-center w-full">Before</span>
                    </div>
                </div>

                <div className="flex gap-4 justify-center items-center py-2 md:-translate-y-2 hidden md:flex">
                    <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full border-2 border-page bg-cream flex items-center justify-center relative overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://picsum.photos/seed/face1/100/100" alt="Avatar" className="w-full h-full object-cover absolute inset-0 opacity-40 mix-blend-luminosity" />
                            <div className="w-4 h-4 rounded-full bg-orange z-10"></div>
                        </div>
                        <div className="w-8 h-8 rounded-full border-2 border-page bg-cream flex items-center justify-center relative overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://picsum.photos/seed/face2/100/100" alt="Avatar" className="w-full h-full object-cover absolute inset-0 opacity-40 mix-blend-luminosity" />
                            <div className="w-2 h-2 rounded-full bg-orange z-10"></div>
                        </div>
                        <div className="w-8 h-8 rounded-full border-2 border-page bg-cream flex items-center justify-center relative overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="https://picsum.photos/seed/face3/100/100" alt="Avatar" className="w-full h-full object-cover absolute inset-0 opacity-40 mix-blend-luminosity" />
                            <div className="w-6 h-6 rounded-full bg-orange z-10"></div>
                        </div>
                    </div>
                    <p className="text-[11px] text-text-muted italic uppercase tracking-wider">Your pfp could look like this &rarr;</p>
                </div>
            </div>

            {/* Controls */}
            <div className="lg:col-span-4 flex flex-col gap-6 w-full max-w-sm mx-auto lg:max-w-none">
                <div className="bg-surface p-6 rounded-3xl border border-border-subtle flex flex-col gap-6 shadow-sm">
                    <div className="space-y-5">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">Dot Size</label>
                                <span className="text-[11px] text-[#E8622A] font-mono">{dotSize}px</span>
                            </div>
                            <input 
                                type="range" min="4" max="20" step="1" 
                                value={dotSize} 
                                onChange={e => setDotSize(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">Contrast</label>
                                <span className="text-[11px] text-[#E8622A] font-mono">{Math.round(contrast * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0.1" max="3" step="0.1" 
                                value={contrast} 
                                onChange={e => setContrast(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-border-subtle mt-4">
                            <label className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">Circular Crop</label>
                            <label className="relative flex items-center justify-center cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={circleCrop} 
                                    onChange={e => setCircleCrop(e.target.checked)}
                                    className="hidden"
                                />
                                <div className={`w-10 h-5 rounded-full relative p-1 transition-colors ${circleCrop ? 'bg-orange' : 'bg-border-strong group-hover:bg-border-strong/80'}`}>
                                    <div className={`absolute top-1 w-3 h-3 rounded-full transition-all duration-300 shadow-sm ${circleCrop ? 'right-1 bg-page' : 'left-1 bg-page'}`}></div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-2">
                    <button 
                        onClick={handleDownload}
                        disabled={isProcessing}
                        className="btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] uppercase tracking-widest text-[11px] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        <Download className="w-4 h-4"/>
                        DOWNLOAD PNG
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleCopy}
                            title="Copy to Clipboard"
                            disabled={isProcessing}
                            className={`btn-secondary py-3 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[11px] disabled:opacity-50 hover:bg-surface-hover hover:text-text-main transition-all ${copySuccess ? 'border-green-500/50 text-green-600 dark:text-green-400' : ''}`}
                        >
                            <Copy className="w-3 h-3"/>
                            {copySuccess ? 'Copied' : 'Copy'}
                        </button>

                        <a 
                            href="https://twitter.com/intent/tweet?text=Just+got+Miden'd!+https://get-midend.vercel.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary py-3 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-[11px] hover:bg-surface-hover hover:text-text-main transition-all"
                        >
                            <Share2 className="w-3 h-3"/>
                            Share to X
                        </a>
                    </div>

                    <button 
                         onClick={reset}
                         className="btn-secondary py-4 mt-1 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-surface-hover hover:text-text-main transition-all border-dashed"
                    >
                        Try Another Image
                    </button>
                </div>
            </div>
        </motion.div>
      )}
      
      <footer className="w-full max-w-6xl mx-auto mt-12 flex justify-between items-center text-[10px] text-text-muted font-mono border-t border-border-subtle pt-6 uppercase tracking-widest pb-6 relative z-10">
        <div className="flex gap-4">
          <a href="https://twitter.com/0x___Ygen" target="_blank" rel="noopener noreferrer" className="hover:text-orange transition-colors">@0x___Ygen</a>
          <span>|</span>
          <a href="https://twitter.com/0xMiden" target="_blank" rel="noopener noreferrer" className="hover:text-orange transition-colors">@0xMiden</a>
        </div>
        <div>&copy; {new Date().getFullYear()} MIDEN_STUDIOS</div>
      </footer>
    </main>
  );

}
