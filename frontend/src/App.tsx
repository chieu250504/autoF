import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import {
  fetchConfig,
  updateConfig,
  fetchPosts,
  deletePost,
  getStoredUser,
  clearStoredSession,
} from './lib/api';
import { RadarConfig, RadarPost, UserAccount, GroupConfig } from './types';
import { Header } from './components/Header';
import { KeywordsCard } from './components/KeywordsCard';
import { GroupsCard } from './components/GroupsCard';
import { GlobalSettingsCard } from './components/GlobalSettingsCard';
import { PostsTable } from './components/PostsTable';
import { LoginModal } from './components/LoginModal';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getStoredUser());
  const [config, setConfig] = useState<RadarConfig | null>(null);
  const [posts, setPosts] = useState<RadarPost[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Tải cấu hình tài khoản từ backend
  const loadConfig = useCallback(async () => {
    if (!currentUser) return;
    setLoadingConfig(true);
    const data = await fetchConfig();
    if (data) {
      setConfig(data);
    }
    setLoadingConfig(false);
  }, [currentUser]);

  // Tải danh sách bài viết từ backend
  const loadPosts = useCallback(async () => {
    if (!currentUser) return;
    setLoadingPosts(true);
    const res = await fetchPosts({ limit: 100 });
    setPosts(res.data);
    setLoadingPosts(false);
  }, [currentUser]);

  // Khởi tạo và thiết lập Supabase Realtime Channels
  useEffect(() => {
    if (!currentUser) return;

    loadConfig();
    loadPosts();

    // Realtime channel cho bài viết mới
    const postsChannel = supabase
      .channel(`public:fbradar_posts:${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fbradar_posts' },
        (payload) => {
          const newPost = payload.new as RadarPost;
          const targetAccounts = Array.isArray(newPost.account_ids) ? newPost.account_ids : [];
          const isForMe = targetAccounts.length === 0 || targetAccounts.includes(currentUser.id);

          if (isForMe) {
            setPosts((prev) => {
              if (prev.some((p) => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          }
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
            loadPosts();
          }
        }
      )
      .subscribe();

    // Realtime channel cho nhịp tim Tab Treo (fbradar_config)
    const runnerChannel = supabase
      .channel('public:fbradar_runner_status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fbradar_config' },
        (payload) => {
          const updated = payload.new as any;
          setConfig((prev) => (prev ? {
            ...prev,
            runner_status: updated.runner_status,
            current_running_group: updated.current_running_group,
            last_heartbeat: updated.last_heartbeat,
          } : prev));
        }
      )
      .subscribe();

    // Polling mỗi 10 giây để nhịp tim Online/Offline luôn chính xác
    const heartbeatTimer = setInterval(() => {
      loadConfig();
    }, 10000);

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(runnerChannel);
      clearInterval(heartbeatTimer);
    };
  }, [currentUser, loadConfig, loadPosts]);

  // Thao tác Bật/Tắt quét của tài khoản
  const handleToggleEnabled = async (newVal: boolean) => {
    const res = await updateConfig({ enabled: newVal });
    if (res.success && res.data) {
      setConfig((prev) => (prev ? { ...prev, enabled: newVal } : res.data!));
    } else if (res.error) {
      alert(`Lỗi: ${res.error}`);
    }
  };

  // Cập nhật từ khóa của tài khoản
  const handleSaveKeywords = async (newKeywords: string[]) => {
    const res = await updateConfig({ keywords: newKeywords });
    if (res.success && res.data) {
      setConfig((prev) => (prev ? { ...prev, keywords: newKeywords } : res.data!));
    } else if (res.error) {
      alert(`Lỗi: ${res.error}`);
    }
  };

  // Cập nhật danh sách nhóm của tài khoản
  const handleSaveGroups = async (newGroups: GroupConfig[]) => {
    const res = await updateConfig({ groups: newGroups });
    if (res.success && res.data) {
      setConfig((prev) => (prev ? { ...prev, groups: newGroups } : res.data!));
    } else if (res.error) {
      alert(`Lỗi: ${res.error}`);
    }
  };

  // Cập nhật cài đặt mặc định
  const handleSaveGlobalSettings = async (updates: Partial<RadarConfig>) => {
    const res = await updateConfig(updates);
    if (res.success && res.data) {
      setConfig((prev) => (prev ? { ...prev, ...updates } : res.data!));
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
      alert('Không thể xóa bài viết. Kiểm tra lại kết nối.');
    }
  };

  // Xóa tất cả bài viết của tài khoản
  const handleDeleteAllPosts = async () => {
    const ok = await deletePost(undefined, true);
    if (ok) {
      setPosts([]);
    } else {
      alert('Không thể xóa bài viết. Kiểm tra lại kết nối.');
    }
  };

  // Đăng xuất
  const handleLogout = () => {
    clearStoredSession();
    setCurrentUser(null);
    setConfig(null);
    setPosts([]);
  };

  if (!currentUser) {
    return <LoginModal onLoggedIn={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        currentUser={currentUser}
        config={config}
        onToggleEnabled={handleToggleEnabled}
        onLogout={handleLogout}
        loading={loadingConfig}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-3.5 sm:space-y-6">
        {/* Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-6">
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

      <footer className="py-3 border-t border-slate-200 text-center text-xs text-slate-400">
        FB Group Radar
      </footer>
    </div>
  );
};

export default App;
