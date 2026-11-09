export default function HomePage() {
  return (
    <main style={{ maxWidth: '720px', margin: '40px auto', lineHeight: 1.6 }}>
      <h1 style={{ color: '#38bdf8', fontSize: '1.8rem', marginBottom: '8px' }}>
        🎯 FB Group Keyword Radar — Backend API
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
        Cổng API Next.js độc lập xử lý xác thực và kết nối Supabase cho hệ thống Radar.
      </p>

      <section style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#e2e8f0' }}>📡 Các API Endpoints:</h2>
        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', color: '#cbd5e1' }}>
          <li><code style={{ color: '#a7f3d0' }}>GET /api/health</code> - Kiểm tra trạng thái server & database</li>
          <li><code style={{ color: '#a7f3d0' }}>GET /api/config</code> - Lấy cấu hình hệ thống hiện tại</li>
          <li><code style={{ color: '#a7f3d0' }}>PATCH /api/config</code> - Cập nhật cấu hình (yêu cầu mã PIN)</li>
          <li><code style={{ color: '#a7f3d0' }}>GET /api/posts</code> - Truy vấn danh sách bài viết quét được</li>
          <li><code style={{ color: '#a7f3d0' }}>DELETE /api/posts</code> - Xóa bài viết hoặc xóa toàn bộ (yêu cầu mã PIN)</li>
          <li><code style={{ color: '#a7f3d0' }}>POST /api/auth/verify</code> - Xác thực mã PIN truy cập</li>
        </ul>
      </section>
    </main>
  );
}
