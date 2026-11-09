import React, { useState } from 'react';
import { Tag, Plus, X, Hash } from 'lucide-react';

interface Props {
  keywords: string[];
  onSave: (newKeywords: string[]) => Promise<void>;
  loading: boolean;
}

export const KeywordsCard: React.FC<Props> = ({ keywords, onSave, loading }) => {
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    if (keywords.map((k) => k.toLowerCase()).includes(trimmed.toLowerCase())) {
      setInput('');
      return;
    }

    const nextKeywords = [...keywords, trimmed];
    setSaving(true);
    await onSave(nextKeywords);
    setSaving(false);
    setInput('');
  };

  const handleRemove = async (kw: string) => {
    const nextKeywords = keywords.filter((k) => k !== kw);
    setSaving(true);
    await onSave(nextKeywords);
    setSaving(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-sm">Từ Khóa Quét Radar</h2>
              <p className="text-xs text-slate-400">Các từ khóa bài viết sẽ được tự động bắt</p>
            </div>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded-full text-teal-400 border border-slate-700">
            {keywords.length} từ khóa
          </span>
        </div>

        {/* Input thêm từ khóa */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Hash className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="VD: tuyển dụng, báo giá, cần tìm..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={saving || loading || !input.trim()}
            className="flex items-center gap-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-xs font-medium transition shadow-md shadow-teal-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm</span>
          </button>
        </form>

        {/* Danh sách từ khóa Badge */}
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
          {keywords.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center w-full italic">
              Chưa có từ khóa nào. Hãy thêm từ khóa phía trên!
            </div>
          ) : (
            keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-teal-300 group hover:border-teal-500/50 transition"
              >
                <span>{kw}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(kw)}
                  disabled={saving || loading}
                  className="text-slate-500 hover:text-rose-400 transition"
                  title="Xóa từ khóa này"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
