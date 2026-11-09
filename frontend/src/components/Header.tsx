import React, { useState } from 'react';
import { Radar, Power, LogOut, User, Activity } from 'lucide-react';
import { RadarConfig, UserAccount } from '../types';

interface Props {
  currentUser: UserAccount | null;
  config: RadarConfig | null;
  onToggleEnabled: (newVal: boolean) => Promise<void>;
  onLogout: () => void;
  loading: boolean;
}

export const Header: React.FC<Props> = ({ currentUser, config, onToggleEnabled, onLogout, loading }) => {
  const [toggling, setToggling] = useState(false);

  // Tính toán trạng thái Tab Treo (Online nếu có heartbeat trong vòng 2.5 phút)
  const isTabOnline = React.useMemo(() => {
    if (!config?.last_heartbeat) return false;
    const last = new Date(config.last_heartbeat).getTime();
    const diffSeconds = (Date.now() - last) / 1000;
    return diffSeconds <= 150; // 2.5 phút
  }, [config?.last_heartbeat]);

  const handleToggle = async () => {
    if (!config || toggling) return;
    setToggling(true);
    await onToggleEnabled(!config.enabled);
    setToggling(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-bold shadow-md shadow-emerald-500/20">
            <Radar className={`w-5 h-5 text-white ${config?.enabled && isTabOnline ? 'animate-radar-sweep' : ''}`} />
            {config?.enabled && isTabOnline && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">FB Group Radar</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Multi-User
              </span>
            </div>
            <p className="text-xs text-slate-500">Hệ thống quét luân phiên thông minh không trùng lặp</p>
          </div>
        </div>

        {/* User Info & Controls */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Tab Treo Heartbeat Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              {isTabOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400"></span>
              )}
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-800 text-[11px]">
                {isTabOnline ? 'Tab Treo Online' : 'Tab Treo Offline'}
              </span>
              {isTabOnline && config?.runner_status && (
                <span className="text-[10px] text-slate-500 truncate max-w-[130px] sm:max-w-[180px]" title={config.runner_status}>
                  {config.runner_status}
                </span>
              )}
            </div>
          </div>

          {/* Công Tắc Bật / Tắt Quét Của Tài Khoản Này */}
          <button
            onClick={handleToggle}
            disabled={toggling || loading}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-50 ${
              config?.enabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 ring-2 ring-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${toggling ? 'animate-spin' : ''}`} />
            <span>{config?.enabled ? 'ĐANG BẬT QUÉT' : 'TẠM TẮT QUÉT'}</span>
          </button>

          {/* User Account Profile Pill */}
          {currentUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs border border-teal-200">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]" title={currentUser.displayName}>
                    {currentUser.displayName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">@{currentUser.username}</span>
                </div>
              </div>

              {/* Nút Đăng Xuất */}
              <button
                onClick={onLogout}
                title="Đăng xuất / Đổi tài khoản"
                className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition shadow-sm"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
