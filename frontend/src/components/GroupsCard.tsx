import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2, ExternalLink, Sliders, Check, X } from 'lucide-react';
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
    if (!name.trim() || !url.trim()) return;

    let updatedGroups = [...groups];
    const groupData: GroupConfig = {
      name: name.trim(),
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
    if (!window.confirm(`Bạn có chắc muốn xóa nhóm "${groups[idx].name}"?`)) return;
    const updated = groups.filter((_, i) => i !== idx);
    setSaving(true);
    await onSave(updated);
    setSaving(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-sm">Quản Lý Danh Sách Nhóm</h2>
              <p className="text-xs text-slate-400">Tự động xoay vòng 1 tab luân phiên qua từng nhóm</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
            disabled={saving || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-medium transition shadow-md shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Nhóm</span>
          </button>
        </div>

        {/* Add/Edit Group Modal/Form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="mb-4 p-3.5 bg-slate-950/80 border border-blue-500/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-400">
              <span>{editingIndex !== null ? 'Chỉnh Sửa Nhóm' : 'Thêm Nhóm Facebook Mới'}</span>
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="Tên nhóm (VD: Lập Trình Viên Hà Nội)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="url"
                placeholder="URL nhóm (VD: https://facebook.com/groups/...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Số bước cuộn riêng (steps):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={scrollSteps}
                  onChange={(e) => setScrollSteps(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Thời gian dừng/reload riêng (phút):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="120"
                  value={reloadMinutes}
                  onChange={(e) => setReloadMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim() || !url.trim()}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow"
              >
                {editingIndex !== null ? 'Lưu Thay Đổi' : 'Xác Nhận Thêm'}
              </button>
            </div>
          </form>
        )}

        {/* Groups List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center italic">
              Chưa có nhóm nào trong danh sách quét. Bấm "Thêm Nhóm" để thêm nhóm đầu tiên!
            </div>
          ) : (
            groups.map((g, idx) => {
              const isEnabled = g.enabled ?? true;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    isEnabled
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-900/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleGroup(idx)}
                      disabled={saving || loading}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-200 text-xs truncate max-w-[180px] sm:max-w-[240px]">
                          {g.name}
                        </span>
                        <a
                          href={g.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-blue-400"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {g.scrollSteps ?? defaultScrollSteps ?? 10} cuộn
                        </span>
                        <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {g.reloadMinutes ?? defaultReloadMinutes ?? 10} phút
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(idx)}
                      disabled={saving || loading}
                      title="Sửa thông số nhóm"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(idx)}
                      disabled={saving || loading}
                      title="Xóa nhóm"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
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
