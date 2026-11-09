import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2, ExternalLink, X } from 'lucide-react';
import { GroupConfig } from '../types';

interface Props {
  groups: GroupConfig[];
  onSave: (newGroups: GroupConfig[]) => Promise<void>;
  loading: boolean;
  defaultScrollSteps: number;
  defaultReloadMinutes: number;
}

export const GroupsCard: React.FC<Props> = ({
  groups,
  onSave,
  loading,
  defaultScrollSteps,
  defaultReloadMinutes,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [scrollSteps, setScrollSteps] = useState<number>(defaultScrollSteps || 10);
  const [reloadMinutes, setReloadMinutes] = useState<number>(defaultReloadMinutes || 10);

  const resetForm = () => {
    setName('');
    setUrl('');
    setScrollSteps(defaultScrollSteps || 10);
    setReloadMinutes(defaultReloadMinutes || 10);
    setEditingIndex(null);
    setShowAddForm(false);
  };

  const extractGroupNameFromUrl = (targetUrl: string) => {
    try {
      const m = targetUrl.match(/\/groups\/([^\/?#]+)/);
      return m ? `Nhóm: ${m[1]}` : 'Nhóm Facebook';
    } catch {
      return 'Nhóm Facebook';
    }
  };

  const handleStartEdit = (idx: number) => {
    const g = groups[idx];
    setName(g.name || '');
    setUrl(g.url || '');
    setScrollSteps(g.scrollSteps ?? defaultScrollSteps ?? 10);
    setReloadMinutes(g.reloadMinutes ?? defaultReloadMinutes ?? 10);
    setEditingIndex(idx);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    let updatedGroups = [...groups];
    const finalName = name.trim() || extractGroupNameFromUrl(url.trim());

    const groupData: GroupConfig = {
      name: finalName,
      url: url.trim(),
      enabled: editingIndex !== null ? groups[editingIndex].enabled ?? true : true,
      scrollSteps: Number(scrollSteps) || defaultScrollSteps,
      reloadMinutes: Number(reloadMinutes) || defaultReloadMinutes,
    };

    if (editingIndex !== null) {
      updatedGroups[editingIndex] = groupData;
    } else {
      updatedGroups.push(groupData);
    }

    setSaving(true);
    await onSave(updatedGroups);
    setSaving(false);
    resetForm();
  };

  const handleToggleGroup = async (idx: number) => {
    const updated = [...groups];
    updated[idx] = {
      ...updated[idx],
      enabled: !(updated[idx].enabled ?? true),
    };
    setSaving(true);
    await onSave(updated);
    setSaving(false);
  };

  const handleDeleteGroup = async (idx: number) => {
    const displayName = groups[idx].name || groups[idx].url;
    if (!window.confirm(`Bạn có chắc muốn xóa nhóm "${displayName}"?`)) return;
    const updated = groups.filter((_, i) => i !== idx);
    setSaving(true);
    await onSave(updated);
    setSaving(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900 text-sm">Hội Nhóm Quét</h2>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
            disabled={saving || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Nhóm</span>
          </button>
        </div>

        {/* Add/Edit Group Form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="mb-3 p-3 sm:p-4 bg-slate-50 border border-blue-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-blue-800">
              <span>{editingIndex !== null ? 'Chỉnh Sửa Nhóm' : 'Thêm Nhóm Facebook Mới'}</span>
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="url"
                placeholder="URL nhóm (bắt buộc, VD: https://facebook.com/groups/...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Tên nhóm (không bắt buộc)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Số bước cuộn:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={scrollSteps}
                  onChange={(e) => setScrollSteps(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Thời gian dừng (phút):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="120"
                  value={reloadMinutes}
                  onChange={(e) => setReloadMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || !url.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                {editingIndex !== null ? 'Lưu' : 'Thêm'}
              </button>
            </div>
          </form>
        )}

        {/* Groups List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center italic">
              Chưa có nhóm nào trong danh sách.
            </div>
          ) : (
            groups.map((g, idx) => {
              const isEnabled = g.enabled ?? true;
              return (
                <div
                  key={idx}
                  className={`p-2.5 sm:p-3 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                    isEnabled
                      ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                      : 'bg-slate-50/40 border-slate-200/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleGroup(idx)}
                      disabled={saving || loading}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-0 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800 text-xs truncate max-w-[150px] sm:max-w-[240px]" title={g.name || g.url}>
                          {g.name || g.url}
                        </span>
                        <a
                          href={g.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-blue-600 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                          {g.scrollSteps ?? defaultScrollSteps ?? 10} cuộn
                        </span>
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                          {g.reloadMinutes ?? defaultReloadMinutes ?? 10}p
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(idx)}
                      disabled={saving || loading}
                      title="Sửa"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(idx)}
                      disabled={saving || loading}
                      title="Xóa"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
