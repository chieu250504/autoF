import React, { useState } from 'react';
import { Radar, Power, Radio, Lock, Activity, ExternalLink } from 'lucide-react';
import { RadarConfig } from '../types';

interface Props {
  config: RadarConfig | null;
  onToggleEnabled: (newVal: boolean) => Promise<void>;
  onLock: () => void;
  loading: boolean;
}

export const Header: React.FC<Props> = ({ config, onToggleEnabled, onLock, loading }) => {
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
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <Radar className={`w-6 h-6 text-slate-950 ${config?.enabled && isTabOnline ? 'animate-radar-sweep' : ''}`} />
            {config?.enabled && isTabOnline && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">FB Group Radar</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-800 text-emerald-400 border border-slate-700">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Điều khiển từ xa & Bắt bài viết Facebook thời gian thực</p>
          </div>
        </div>

        {/* Runner Status & Master Switch */}
        <div className="flex items-center flex-wrap gap-3 sm:gap-4">
          {/* Tab Treo Heartbeat Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              {isTabOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
              )}
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-200">
                {isTabOnline ? 'Tab Treo Online' : 'Tab Treo Offline'}
              </span>
              {isTabOnline && config?.runner_status && (
                <span className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[220px]" title={config.runner_status}>
                  {config.runner_status}
                </span>
              )}
            </div>
          </div>

          {/* Công Tắc Tổng Quét Từ Xa */}
          <button
            onClick={handleToggle}
            disabled={toggling || loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all duration-200 active:scale-95 disabled:opacity-50 ${
              config?.enabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 ring-2 ring-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Power className={`w-4 h-4 ${toggling ? 'animate-spin' : ''}`} />
            <span>{config?.enabled ? 'ĐANG BẬT QUÉT' : 'ĐANG TẮT QUÉT'}</span>
          </button>

          {/* Nút Khóa Dashboard */}
          <button
            onClick={onLock}
            title="Khóa Dashboard"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

