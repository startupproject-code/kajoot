import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X } from 'lucide-react';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  open,
  onClose,
  onDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId = 0;

    const extractRoomCode = (raw: string): string | null => {
      const trimmed = raw.trim();
      if (/^\d{4}$/.test(trimmed)) return trimmed;
      try {
        const parsed = new URL(trimmed);
        const joinParam = parsed.searchParams.get('join');
        if (joinParam && /^\d{4}$/.test(joinParam)) {
          return joinParam;
        }
      } catch {
        // fallback regex
      }
      const match = trimmed.match(/join=(\d{4})|\b(\d{4})\b/);
      return match ? match[1] || match[2] : null;
    };

    const startCamera = async () => {
      setErrorMsg(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง กรุณากรอกรหัสห้อง 4 หลักด้วยตนเอง');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = () => {
          if (cancelled) return;
          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (v && canvas && v.readyState === v.HAVE_ENOUGH_DATA) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qr = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (qr && qr.data) {
                const code = extractRoomCode(qr.data);
                if (code) {
                  onDetected(code);
                  onClose();
                  return;
                }
              }
            }
          }
          rafId = window.requestAnimationFrame(tick);
        };
        rafId = window.requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setErrorMsg(
            'ไม่สามารถเข้าถึงกล้องได้ (โปรดอนุญาตสิทธิ์กล้อง หรือใช้กล้องมือถือสแกน QR ของโฮสต์โดยตรง)'
          );
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [open, onClose, onDetected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="สแกน QR Code เพื่อเข้าห้อง"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
            <Camera className="w-5 h-5 text-indigo-600" />
            <span>สแกน QR Code เข้าห้อง</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างสแกน"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            {errorMsg}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-slate-900 aspect-square flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-8 border-2 border-indigo-400 rounded-2xl" />
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500 text-center">
          ส่องกล้องไปที่ QR Code บนหน้าจอของ Moderator เพื่อเข้าห้องอัตโนมัติ
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition-colors"
        >
          กลับไปกรอกรหัส 4 หลัก
        </button>
      </div>
    </div>
  );
};
