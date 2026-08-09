import { useState, useCallback, useRef } from 'react';

let JSZipPromise: Promise<typeof import('jszip')> | null = null;

async function loadJsZip() {
  if (!JSZipPromise) {
    JSZipPromise = import('jszip');
  }
  return JSZipPromise;
}

interface FaviconSizes {
  16: string | null;
  32: string | null;
  48: string | null;
  180: string | null;
  192: string | null;
  512: string | null;
}

export function FaviconGeneratorView() {
  const [isDragging, setIsDragging] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resizedImages, setResizedImages] = useState<FaviconSizes>({
    16: null,
    32: null,
    48: null,
    180: null,
    192: null,
    512: null
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resizeImage = useCallback((image: HTMLImageElement, width: number, height: number): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve('');
        return;
      }

      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Enable image smoothing for better quality on downscale
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Draw image centered and scaled to fit
      const ratio = Math.min(width / image.width, height / image.height);
      const newWidth = image.width * ratio;
      const newHeight = image.height * ratio;
      const x = (width - newWidth) / 2;
      const y = (height - newHeight) / 2;
      
      ctx.drawImage(image, x, y, newWidth, newHeight);
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    });
  }, []);

  const processImage = useCallback(async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setDownloadReady(false);

    try {
      // Read file as data URL
      const reader = new FileReader();
      const readFile = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(file);
      const dataUrl = await readFile;
      
      // Set original image for preview
      setOriginalImage(dataUrl);

      // Create image element to get dimensions
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      
      // Validate image size (minimum 16x16)
      if (img.width < 16 || img.height < 16) {
        throw new Error('이미지는 최소 16x16 픽셀 이상이어야 합니다.');
      }

      // Resize to all required sizes in parallel
      const sizes = [
        { name: '16' as const, width: 16, height: 16 },
        { name: '32' as const, width: 32, height: 32 },
        { name: '48' as const, width: 48, height: 48 },
        { name: '180' as const, width: 180, height: 180 },
        { name: '192' as const, width: 192, height: 192 },
        { name: '512' as const, width: 512, height: 512 }
      ] as const;

      const resizePromises = sizes.map(async ({ name, width, height }) => {
        const resized = await resizeImage(img, width, height);
        return { name, dataUrl: resized };
      });

      const results = await Promise.all(resizePromises);
      
      // Update resized images state
      const newResized: FaviconSizes = {
        16: null,
        32: null,
        48: null,
        180: null,
        192: null,
        512: null
      };
      
      results.forEach(({ name, dataUrl }) => {
        newResized[name] = dataUrl;
      });
      
      setResizedImages(newResized);
      setDownloadReady(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [resizeImage]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    await processImage(file);
  }, [processImage]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    await processImage(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processImage]);

  const triggerFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const createIcoFile = useCallback(async (): Promise<Blob | null> => {
    // ICO format: header + directory entries + image data
    // We'll create a proper multi-size ICO file with 16x16, 32x32, 48x48
    // This is a simplified implementation
    
    const icoDataUrls = [
      { size: 16, data: resizedImages[16] },
      { size: 32, data: resizedImages[32] },
      { size: 48, data: resizedImages[48] }
    ].filter(item => item.data !== null) as { size: number; data: string }[];

    if (icoDataUrls.length === 0) return null;

    try {
      // Create a canvas for each size and extract as PNG bytes
      const icoBuffers: Uint8Array[] = [];
      
      for (const item of icoDataUrls) {
        const response = await fetch(item.data);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        icoBuffers.push(new Uint8Array(arrayBuffer));
      }

      // Create a simple ICO header and directory
      // For simplicity, we'll use the 48x48 image as the main favicon.ico
      // A proper ICO would need more complex encoding
      const mainResponse = await fetch(icoDataUrls[icoDataUrls.length - 1].data);
      const mainBlob = await mainResponse.blob();
      const mainArrayBuffer = await mainBlob.arrayBuffer();
      
      return new Blob([mainArrayBuffer], { type: 'image/x-icon' });
    } catch (err) {
      console.error('ICO 생성 실패:', err);
      return null;
    }
  }, [resizedImages]);

  const downloadAsZip = useCallback(async () => {
    if (!downloadReady) return;

    try {
      const { default: JSZip } = await loadJsZip();
      const zip = new JSZip();
      
      // Add favicon.ico (using 48x48 as base, rename to .ico)
      if (resizedImages[48]) {
        const response = await fetch(resizedImages[48]);
        const blob = await response.blob();
        zip.file('favicon.ico', blob, { binary: true });
      }
      
      // Add PNG files
      if (resizedImages[16]) {
        const response = await fetch(resizedImages[16]);
        const blob = await response.blob();
        zip.file('favicon-16x16.png', blob, { binary: true });
      }
      if (resizedImages[32]) {
        const response = await fetch(resizedImages[32]);
        const blob = await response.blob();
        zip.file('favicon-32x32.png', blob, { binary: true });
      }
      if (resizedImages[180]) {
        const response = await fetch(resizedImages[180]);
        const blob = await response.blob();
        zip.file('apple-touch-icon.png', blob, { binary: true });
      }
      if (resizedImages[192]) {
        const response = await fetch(resizedImages[192]);
        const blob = await response.blob();
        zip.file('android-chrome-192x192.png', blob, { binary: true });
      }
      if (resizedImages[512]) {
        const response = await fetch(resizedImages[512]);
        const blob = await response.blob();
        zip.file('android-chrome-512x512.png', blob, { binary: true });
      }

      // Generate ZIP file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `favicon-${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError('ZIP 파일 생성 중 오류가 발생했습니다. JSZip 라이브러리가 로드되지 않았습니다.');
      console.error('ZIP 생성 실패:', err);
    }
  }, [downloadReady, resizedImages]);

  const downloadAllFiles = useCallback(() => {
    const timestamp = new Date().getTime();
    
    // Download each file individually
    const downloads = [
      { name: 'favicon.ico', data: resizedImages[48] || resizedImages[32] || resizedImages[16] },
      { name: 'favicon-16x16.png', data: resizedImages[16] },
      { name: 'favicon-32x32.png', data: resizedImages[32] },
      { name: 'apple-touch-icon.png', data: resizedImages[180] },
      { name: 'android-chrome-192x192.png', data: resizedImages[192] },
      { name: 'android-chrome-512x512.png', data: resizedImages[512] }
    ];

    downloads.forEach(download => {
      if (download.data) {
        const link = document.createElement('a');
        link.href = download.data;
        link.download = download.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }, [resizedImages]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#1E293B] border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-2">파비콘 만들기</h2>
        <p className="text-slate-400 text-sm">
          이미지를 드래그 앤 드랍하거나 클릭하여 업로드하세요. <br />
          자동으로 다양한 크기의 파비콘 이미지들이 생성됩니다.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          <span className="material-symbols-outlined text-red-400 mr-2">error</span>
          {error}
        </div>
      )}

      <div 
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-all ${
          isDragging ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-[#1E293B]'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        style={{ cursor: 'pointer' }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="text-slate-300">이미지 처리 중...</p>
          </div>
        ) : originalImage ? (
          <div className="flex flex-col items-center gap-4">
            <img 
              src={originalImage} 
              alt="Preview"
              className="max-w-full max-h-64 object-contain rounded"
            />
            <p className="text-slate-300">이미지가 업로드되었습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-6xl text-slate-500">upload</span>
            <p className="text-slate-400">이미지를 여기에 드래그 앤 드랍하세요</p>
            <p className="text-slate-500 text-sm">또는 클릭하여 파일 선택</p>
          </div>
        )}
      </div>

      {downloadReady && (
        <div className="bg-[#1E293B] border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">생성된 파비콘 미리보기</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">16x16</span>
              {resizedImages[16] && (
                <img src={resizedImages[16]} alt="16x16" className="w-8 h-8 object-contain bg-slate-800 rounded p-1" />
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">32x32</span>
              {resizedImages[32] && (
                <img src={resizedImages[32]} alt="32x32" className="w-8 h-8 object-contain bg-slate-800 rounded p-1" />
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">48x48</span>
              {resizedImages[48] && (
                <img src={resizedImages[48]} alt="48x48" className="w-12 h-12 object-contain bg-slate-800 rounded p-1" />
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">180x180</span>
              {resizedImages[180] && (
                <img src={resizedImages[180]} alt="180x180" className="w-16 h-16 object-contain bg-slate-800 rounded p-1" />
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">192x192</span>
              {resizedImages[192] && (
                <img src={resizedImages[192]} alt="192x192" className="w-20 h-20 object-contain bg-slate-800 rounded p-1" />
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">512x512</span>
              {resizedImages[512] && (
                <img src={resizedImages[512]} alt="512x512" className="w-24 h-24 object-contain bg-slate-800 rounded p-1" />
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadAsZip}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
            >
              <span className="material-symbols-outlined">download</span>
              <span>모두 ZIP으로 다운로드</span>
            </button>
            <button
              onClick={downloadAllFiles}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
            >
              <span className="material-symbols-outlined">file_download</span>
              <span>개별 파일 다운로드</span>
            </button>
          </div>
        </div>
      )}

      {originalImage && !downloadReady && !isProcessing && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-yellow-300">
          <span className="material-symbols-outlined text-yellow-400 mr-2">info</span>
          이미지가 업로드되었지만, 파비콘 생성이 완료되지 않았습니다.
        </div>
      )}
    </div>
  );
}
