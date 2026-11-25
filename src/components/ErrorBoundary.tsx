import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = 'ระบบเชื่อมต่อข้อมูลขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง';
      if (this.state.message.includes('Quota exceeded')) {
        friendlyMsg = 'ใช้งานโควตาฐานข้อมูลครบกำหนดประจำวันแล้ว กรุณาลองใหม่ในวันถัดไป';
      } else if (this.state.message.includes('Missing or insufficient permissions')) {
        friendlyMsg = 'สิทธิ์การเข้าถึงห้องไม่ถูกต้อง กรุณาเข้าสู่ระบบด้วย Google ใหม่อีกครั้ง';
      }

      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-800 border border-slate-700 p-7 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>
            <h1 className="text-xl font-extrabold text-white">เกิดข้อผิดพลาดในการเชื่อมต่อ</h1>
            <p className="text-sm text-slate-300 leading-relaxed">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>โหลดหน้าใหม่</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
