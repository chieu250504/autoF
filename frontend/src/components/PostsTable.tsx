import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Trash2,
  Search,
  ExternalLink,
  Clock,
  Tag,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { RadarPost } from '../types';

interface Props {
  posts: RadarPost[];
  onDeletePost: (id: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onRefresh: () => Promise<void>;
  loading: boolean;
}

export const PostsTable: React.FC<Props> = ({
  posts,
  onDeletePost,
  onDeleteAll,
  onRefresh,
  loading,
}) => {
  const [search, setSearch] = useState('');
  const [selectedKeyword, setSelectedKeyword] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Danh sách từ khóa và nhóm duy nhất để làm bộ lọc
  const uniqueKeywords = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.matched_keyword) set.add(p.matched_keyword);
    });
    return Array.from(set);
  }, [posts]);

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.group_title) set.add(p.group_title);
    });
    return Array.from(set);
  }, [posts]);

  // Lọc bài viết
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (selectedKeyword !== 'all' && p.matched_keyword !== selectedKeyword) {
        return false;
      }
      if (selectedGroup !== 'all' && p.group_title !== selectedGroup) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesText = p.post_text?.toLowerCase().includes(q);
        const matchesKw = p.matched_keyword?.toLowerCase().includes(q);
        const matchesGrp = p.group_title?.toLowerCase().includes(q);
        return matchesText || matchesKw || matchesGrp;
      }
      return true;
    });
  }, [posts, selectedKeyword, selectedGroup, search]);

  // Xuất file CSV UTF-8 (Excel friendly)
  const exportToExcel = () => {
    if (filteredPosts.length === 0) {
      alert('Không có bài viết nào để xuất file.');
      return;
    }

    const headers = ['STT', 'Thời Gian Phát Hiện', 'Tên Nhóm', 'Từ Khóa Bắt Được', 'Nội Dung Bài Viết', 'Link Bài Viết', 'Link Nhóm'];
    const rows = filteredPosts.map((p, idx) => [
      idx + 1,
      p.detected_at ? new Date(p.detected_at).toLocaleString('vi-VN') : '',
      `"${(p.group_title || '').replace(/"/g, '""')}"`,
      `"${(p.matched_keyword || '').replace(/"/g, '""')}"`,
      `"${(p.post_text || '').replace(/"/g, '""')}"`,
      p.post_link || '',
      p.group_url || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    // Thêm BOM UTF-8 (\uFEFF) để Microsoft Excel hiển thị tiếng Việt có dấu chuẩn 100%
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    link.href = url;
    link.setAttribute('download', `fb_radar_posts_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ bài viết đã quét được không?')) {
      return;
    }
    await onDeleteAll();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-100">Bài Viết Quét Được (Realtime)</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {filteredPosts.length} / {posts.length} bài
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Tự động cập nhật tức thời khi Tab Treo phát hiện bài viết mới</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Tải lại danh sách"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Nút Xuất Excel */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-900/20 transition active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel (.csv)</span>
          </button>

          {/* Nút Xóa Toàn Bộ */}
          {posts.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-semibold transition active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa Hết</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung, từ khóa, tên nhóm..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter Keyword */}
        <div className="flex items-center gap-1 text-xs">
          <Tag className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedKeyword}
            onChange={(e) => setSelectedKeyword(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tất cả từ khóa</option>
            {uniqueKeywords.map((kw) => (
              <option key={kw} value={kw}>
                {kw}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Group */}
        <div className="flex items-center gap-1 text-xs">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500 max-w-[200px]"
          >
            <option value="all">Tất cả nhóm</option>
            {uniqueGroups.map((grp) => (
              <option key={grp} value={grp}>
                {grp}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950/90 sticky top-0 z-10 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 w-12 text-center">STT</th>
              <th className="py-3 px-4 w-40">Thời Gian</th>
              <th className="py-3 px-4 w-48">Nhóm Facebook</th>
              <th className="py-3 px-4 w-36">Từ Khóa Khớp</th>
              <th className="py-3 px-4">Nội Dung Bài Viết</th>
              <th className="py-3 px-4 w-24 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filteredPosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                  Chưa có bài viết nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredPosts.map((post, idx) => {
                const isExpanded = expandedId === post.id;
                const formattedTime = post.detected_at
                  ? new Date(post.detected_at).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })
                  : '';

                return (
                  <tr
                    key={post.id || idx}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3 px-4 text-center text-slate-500 font-mono">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{formattedTime}</span>
                      </div>
                      {post.post_time && (
                        <span className="text-[10px] text-slate-500 block pl-5">
                          ({post.post_time})
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-200">
                      <div className="truncate max-w-[180px]" title={post.group_title}>
                        {post.group_title || 'Chưa rõ'}
                      </div>
                      {post.group_url && (
                        <a
                          href={post.group_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-slate-500 hover:text-blue-400 truncate max-w-[180px] block"
                        >
                          Xem nhóm
                        </a>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        #{post.matched_keyword}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      <div
                        className={`text-xs leading-relaxed ${
                          isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
                        }`}
                      >
                        {post.post_text}
                      </div>
                      {post.post_text && post.post_text.length > 120 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : post.id)}
                          className="text-[11px] text-emerald-400 hover:underline mt-1 inline-flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <>
                              Thu gọn <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              Xem thêm <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {post.post_link && (
                          <a
                            href={post.post_link}
                            target="_blank"
                            rel="noreferrer"
                            title="Mở bài viết trên Facebook"
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => onDeletePost(post.id)}
                          title="Xóa bài này"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
