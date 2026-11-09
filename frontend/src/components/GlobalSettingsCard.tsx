import React, { useState, useEffect } from 'react';
import { Sliders, Save, Check } from 'lucide-react';
import { RadarConfig } from '../types';

interface Props {
  config: RadarConfig | null;
  onSave: (updates: Partial<RadarConfig>) => Promise<void>;
  loading: boolean;
}

export const GlobalSettingsCard: React.FC<Props> = ({ config, onSave, loading }) => {
  const [reloadMinutes, setReloadMinutes] = useState(10);
  const [scrollSteps, setScrollSteps] = useState(10);
  const [scrollSpeed, setScrollSpeed] = useState('medium');
  const [jitterPercent, setJitterPercent] = useState(20);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setReloadMinutes(config.reload_minutes ?? 10);
      setScrollSteps(config.max_scroll_steps ?? 10);
      setScrollSpeed(config.scroll_speed ?? 'medium');
      setJitterPercent(config.jitter_percent ?? 20);
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      reload_minutes: Number(reloadMinutes),
      max_scroll_steps: Number(scrollSteps),
      scroll_speed: scrollSpeed,
      jitter_percent: Number(jitterPercent),
    });
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <form onSubmit={handleSave}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Cài Đặt Quét Mặc Định</h2>
              <p className="text-xs text-slate-500">Các tham số áp dụng khi nhóm không cài đặt riêng</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>Đã Lưu!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu Cài Đặt</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Chu kỳ mặc định (phút):</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="120"
              value={reloadMinutes}
              onChange={(e) => setReloadMinutes(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Số bước cuộn mặc định:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={scrollSteps}
              onChange={(e) => setScrollSteps(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Tốc độ cuộn chuột:</label>
            <select
              value={scrollSpeed}
              onChange={(e) => setScrollSpeed(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="slow">Chậm (Slow - An toàn)</option>
              <option value="medium">Vừa (Medium - Tự nhiên)</option>
              <option value="fast">Nhanh (Fast)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Độ lệch Jitter ngẫu nhiên:</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={jitterPercent}
                onChange={(e) => setJitterPercent(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-xs font-mono font-semibold text-indigo-700 min-w-[32px] text-right">
                {jitterPercent}%
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
