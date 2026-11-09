import React, { useState, useEffect, useCallback } from 'react';
import { PinLockModal } from './components/PinLockModal';
import { Header } from './components/Header';
import { KeywordsCard } from './components/KeywordsCard';
import { GroupsCard } from './components/GroupsCard';
import { GlobalSettingsCard } from './components/GlobalSettingsCard';
import { PostsTable } from './components/PostsTable';
import {
  hasStoredPin,
  clearStoredPin,
  fetchConfig,
  updateConfig,
  fetchPosts,
  deletePost,
} from './lib/api';
import { supabase } from './lib/supabase';
import { RadarConfig, RadarPost, GroupConfig } from './types';

export const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(!hasStoredPin());
  const [config, setConfig] = useState<RadarConfig | null>(null);
  const [posts, setPosts] = useState<RadarPost[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Tải cấu hình từ Backend API
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    const data = await fetchConfig();
    if (data) {
      setConfig(data);
    }
    setLoadingConfig(false);
  }, []);

  // Tải danh sách bài viết từ Backend API
  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    const res = await fetchPosts({ limit: 150 });
    setPosts(res.data);
    setLoadingPosts(false);
  }, []);

  // Khởi tạo khi mở khóa
  useEffect(() => {
    if (!isLocked) {
      loadConfig();
      loadPosts();
    }
  }, [isLocked, loadConfig, loadPosts]);

  // Thiết lập Supabase Realtime Lắng Nghe Bài Viết Mới & Nhịp Tim Tab Treo
  useEffect(() => {
    if (isLocked) return;

    // Realtime channel cho bài viết (fbradar_posts)
    const postsChannel = supabase
      .channel('public:fbradar_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fbradar_posts' },
        (payload) => {
          const newPost = payload.new as RadarPost;
          setPosts((prev) => {
            // Tránh trùng lặp
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'fbradar_posts' },
        (payload) => {
          const deletedId = (payload.old as { id: string })?.id;
          if (deletedId) {
            setPosts((prev) => prev.filter((p) => p.id !== deletedId));
          } else {
            // Nếu xóa hết
            loadPosts();
          }
        }
      )
      .subscribe();

    // Realtime channel cho cấu hình & nhịp tim (fbradar_config)
    const configChannel = supabase
      .channel('public:fbradar_config')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fbradar_config' },
        (payload) => {
          const updated = payload.new as RadarConfig;
          setConfig((prev) => (prev ? { ...prev, ...updated } : updated));
        }
      )
      .subscribe();

    // Polling nhẹ mỗi 10 giây để tính nhịp tim Online/Offline chính xác
    const heartbeatTimer = setInterval(() => {
      loadConfig();
    }, 10000);

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(configChannel);
      clearInterval(heartbeatTimer);
    };
  }, [isLocked, loadConfig, loadPosts]);

  // Thao tác Bật/Tắt quét từ xa
  const handleToggleEnabled = async (newVal: boolean) => {
    const res = await updateConfig({ enabled: newVal });
    if (res.success && res.data) {
      setConfig(res.data);
    } else if (res.error) {
      alert(`Lỗi: ${res.error}`);
    }
  };

  // Cập nhật từ khóa
  const handleSaveKeywords = async (newKeywords: string[]) => {
    const res = await updateConfig({ keywords: newKeywords });
    if (res.success && res.data) {
      setConfig(res.data);
    } else if (res.error) {
      alert(`Lỗi: ${res.error}`);
    }
  };

  // Cập nhật danh sách nhóm
  const handleSaveGroups = async (newGroups: GroupConfig[]) => {
    const res = await updateConfig({ groups: newGroups });
    if (res.success && res.data) {
      setConfig(res.data);
    } else if (res.error) {
      alert(`Lỗi: ${res.error}`);
    }
  };

  // Cập nhật cài đặt toàn cục
  const handleSaveGlobalSettings = async (updates: Partial<RadarConfig>) => {
    const res = await updateConfig(updates);
    if (res.success && res.data) {
      setConfig(res.data);
    } else if (res.error) {
      alert(`Lỗi: ${res.error}`);
    }
  };

  // Xóa bài viết
  const handleDeletePost = async (id: string) => {
    const ok = await deletePost(id);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert('Không thể xóa bài viết. Kiểm tra lại mã PIN hoặc kết nối.');
    }
  };

  // Xóa tất cả bài viết
  const handleDeleteAllPosts = async () => {
    const ok = await deletePost(undefined, true);
    if (ok) {
      setPosts([]);
    } else {
      alert('Không thể xóa bài viết. Kiểm tra lại mã PIN hoặc kết nối.');
    }
  };

  // Khóa màn hình
  const handleLock = () => {
    clearStoredPin();
    setIsLocked(true);
  };

  if (isLocked) {
    return <PinLockModal onUnlocked={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        config={config}
        onToggleEnabled={handleToggleEnabled}
        onLock={handleLock}
        loading={loadingConfig}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <KeywordsCard
              keywords={config?.keywords || []}
              onSave={handleSaveKeywords}
              loading={loadingConfig}
            />
          </div>

          <div className="lg:col-span-2">
            <GroupsCard
              groups={config?.groups || []}
              onSave={handleSaveGroups}
              loading={loadingConfig}
              defaultScrollSteps={config?.max_scroll_steps || 10}
              defaultReloadMinutes={config?.reload_minutes || 10}
            />
          </div>
        </div>

        {/* Global Settings */}
        <GlobalSettingsCard
          config={config}
          onSave={handleSaveGlobalSettings}
          loading={loadingConfig}
        />

        {/* Posts Table */}
        <PostsTable
          posts={posts}
          onDeletePost={handleDeletePost}
          onDeleteAll={handleDeleteAllPosts}
          onRefresh={loadPosts}
          loading={loadingPosts}
        />
      </main>

      <footer className="py-4 border-t border-slate-900 text-center text-xs text-slate-500">
        FB Group Keyword Radar • Kiến trúc 3 thư mục độc lập (Extension, Frontend, Backend)
      </footer>
    </div>
  );
};

export default App;
