import React, { useState } from 'react';
import { Tag, Plus, X, Hash } from 'lucide-react';

interface Props {
  keywords: string[];
  onSave: (newKeywords: string[]) => Promise<void>;
  loading: boolean;
}

export const KeywordsCard: React.FC<Props> = ({ keywords, onSave }) => {
  const [input, setInput] = useState('');

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    if (keywords.map((k) => k.toLowerCase()).includes(trimmed.toLowerCase())) {
      setInput('');
      return;
    }

    const nextKeywords = [...keywords, trimmed];
    setInput('');
    // Gọi lưu (App.tsx sẽ cập nhật UI tức thì 0ms)
    onSave(nextKeywords);
  };

  const handleRemove = (kw: string) => {
    const nextKeywords = keywords.filter((k) => k !== kw);
    // Gọi xóa (App.tsx sẽ cập nhật UI tức thì 0ms)
    onSave(nextKeywords);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <Tag className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900 text-sm">Từ Khóa Quét</h2>
          </div>
          <span className="text-[11px] font-semibold bg-teal-50 px-2 py-0.5 rounded-full text-teal-800 border border-teal-200">
            {keywords.length} từ khóa
          </span>
        </div>

        {/* Input thêm từ khóa */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Hash className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Thêm từ khóa mới..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex items-center gap-1 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm</span>
          </button>
        </form>

        {/* Danh sách từ khóa Badge */}
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          {keywords.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center w-full italic">
              Chưa có từ khóa nào.
            </div>
          ) : (
            keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-teal-50/80 border border-teal-200 text-teal-900 group hover:border-teal-300 transition"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(kw)}
                  className="text-teal-400 hover:text-rose-600 transition p-0.5"
                  title="Xóa từ khóa"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
