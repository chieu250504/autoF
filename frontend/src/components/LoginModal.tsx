import React, { useState } from 'react';
import { User, Lock, AlertCircle, LogIn, Sparkles, Briefcase, FileText } from 'lucide-react';
import { login } from '../lib/api';
import { UserAccount } from '../types';

interface Props {
  onLoggedIn: (user: UserAccount) => void;
}

export const LoginModal: React.FC<Props> = ({ onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const u = (customUser !== undefined ? customUser : username).trim();
    const p = (customPass !== undefined ? customPass : password).trim();

    if (!u || !p) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);
    setError('');

    const res = await login(u, p);
    setLoading(false);

    if (res.success && res.account) {
      onLoggedIn(res.account);
    } else {
      setError(res.error || 'Đăng nhập không thành công');
    }
  };

  const handleQuickLogin = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    handleSubmit(undefined, u, p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Logo Badge */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
          <LogIn className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-center">
          FB Radar Dashboard
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-6 text-center">
          Đăng nhập tài khoản để quản lý từ khóa, nhóm và xem bài viết riêng của bạn
        </p>

        {/* Quick Account Selector */}
        <div className="w-full mb-6">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Chọn nhanh tài khoản có sẵn:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickLogin('user1', '123456')}
              className="p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-2xl text-left transition flex items-center gap-2.5 group shadow-sm hover:shadow"
            >
              <div className="p-2 rounded-xl bg-emerald-100/70 text-emerald-700 border border-emerald-200 shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700 truncate">
                  User 1 (Tuyển dụng)
                </div>
                <div className="text-[11px] text-slate-500">user1 / 123456</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('user2', '123456')}
              className="p-3 bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 rounded-2xl text-left transition flex items-center gap-2.5 group shadow-sm hover:shadow"
            >
              <div className="p-2 rounded-xl bg-teal-100/70 text-teal-700 border border-teal-200 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 group-hover:text-teal-700 truncate">
                  User 2 (Báo giá)
                </div>
                <div className="text-[11px] text-slate-500">user2 / 123456</div>
              </div>
            </button>
          </div>
        </div>

        <div className="relative w-full flex items-center justify-center mb-6">
          <div className="border-t border-slate-200 w-full"></div>
          <span className="bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider absolute">
            Hoặc tự điền
          </span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên đăng nhập</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                placeholder="user1 hoặc user2"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Mật khẩu (VD: 123456)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-700 text-xs bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition duration-150 mt-3"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập Vào Bảng Điều Khiển</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
