import React, { useState } from 'react';
import { Radar, Power, LogOut } from 'lucide-react';
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

    const willTurnOn = !config.enabled;
    // Nếu Chrome hiện đang đóng hoàn toàn (Offline)
    if (willTurnOn && !isTabOnline) {
      const confirmOpen = window.confirm(
        "⚠️ Trình duyệt Chrome hiện đang tắt (Offline).\n\nBạn có muốn lưu lệnh BẬT quét từ xa không?\n(Ngay khi bạn mở trình duyệt Google Chrome lên, Extension sẽ tự động mở tab Facebook và bắt đầu quét ngay lập tức)."
      );
      if (!confirmOpen) return;
    }

    setToggling(true);
    await onToggleEnabled(willTurnOn);
    setToggling(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-bold shadow-sm">
            <Radar className={`w-4 h-4 sm:w-5 sm:h-5 text-white ${config?.enabled && isTabOnline ? 'animate-radar-sweep' : ''}`} />
            {config?.enabled && isTabOnline && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">FB Radar</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Multi-User
            </span>
          </div>
        </div>

        {/* User Info & Controls */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Tab Treo Heartbeat Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 border border-slate-200 text-xs">
            <span className="relative flex h-2 w-2">
              {isTabOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
              )}
            </span>
            <span className="font-semibold text-slate-800 text-[11px]">
              {isTabOnline ? 'Online' : 'Offline'}
            </span>
            {isTabOnline && config?.runner_status && (
              <span className="hidden md:inline text-[10px] text-slate-500 truncate max-w-[140px]" title={config.runner_status}>
                • {config.runner_status}
              </span>
            )}
          </div>

          {/* Công Tắc Bật / Tắt Quét */}
          <button
            onClick={handleToggle}
            disabled={toggling || loading}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 disabled:opacity-50 ${
              config?.enabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${toggling ? 'animate-spin' : ''}`} />
            <span>{config?.enabled ? 'Đang bật' : 'Tạm tắt'}</span>
          </button>

          {/* User Account Profile Pill */}
          {currentUser && (
            <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-slate-200">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px] border border-teal-200">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-800 truncate max-w-[90px] sm:max-w-[120px]" title={currentUser.displayName}>
                  {currentUser.displayName}
                </span>
              </div>

              {/* Nút Đăng Xuất */}
              <button
                onClick={onLogout}
                title="Đăng xuất"
                className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
