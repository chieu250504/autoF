import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, ShieldCheck } from 'lucide-react';
import { verifyPin, setStoredPin } from '../lib/api';

interface Props {
  onUnlocked: () => void;
}

export const PinLockModal: React.FC<Props> = ({ onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Vui lòng nhập mã PIN');
      return;
    }

    setLoading(true);
    setError('');

    const ok = await verifyPin(pin.trim());
    setLoading(false);

    if (ok) {
      setStoredPin(pin.trim());
      onUnlocked();
    } else {
      setError('Mã PIN không đúng. Vui lòng thử lại!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-slate-100 tracking-tight text-center">
          FB Radar Dashboard
        </h2>
        <p className="text-sm text-slate-400 mt-1 mb-6 text-center">
          Nhập mã PIN bảo mật để mở khóa bảng điều khiển từ xa
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <input
              type="password"
              maxLength={12}
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError('');
              }}
              placeholder="Nhập mã PIN..."
              className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition tracking-widest text-center text-lg font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/30 transition duration-150"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Mở Khóa Bảng Điều Khiển</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-500 text-center">
          Mã PIN mặc định: <span className="font-mono text-slate-400">250504</span> (hoặc cấu hình trong <code className="text-slate-400">.env.local</code>)
        </div>
      </div>
    </div>
  );
};

