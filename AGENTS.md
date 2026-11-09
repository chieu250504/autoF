# AGENTS.md - Quy Tắc & Kiến Trúc Dự Án FB Group Keyword Radar

Tài liệu này là quy tắc bất di bất dịch dành cho các AI Coding Assistant tham gia phát triển dự án này. Mọi thay đổi mã nguồn phải tuân thủ nghiêm ngặt các nguyên tắc dưới đây.

---

## 1. Tổng Quan Kiến Trúc (Architecture)

Hệ thống hoạt động theo mô hình 3 thành phần:
1. **Chrome Extension (Client Worker / Tab Treo)**:
   - Thư mục gốc (`/`): `manifest.json`, `content.js`, `background.js`, `popup.*`, `supabase.js`.
   - Nhiệm vụ: Đóng vai trò là "máy quét" an toàn trên máy tính cá nhân. Duyệt luân phiên 1 tab Facebook qua các nhóm, giả lập hành vi người thật (Jitter delay, smooth scrolling, reading pauses).
   - Giao tiếp với Supabase qua REST API (`supabase.js`).
2. **Cloud Database (Supabase)**:
   - `public.fbradar_config`: Lưu cấu hình tập trung (từ khóa, danh sách nhóm, thời gian dừng, trạng thái bật/tắt, heartbeat).
   - `public.fbradar_posts`: Lưu toàn bộ bài viết bắt được (chống trùng lặp theo `id`, có `post_time` và `post_timestamp`).
3. **Web Dashboard (Frontend & Backend điều khiển từ xa)**:
   - Thư mục: `dashboard/` (Next.js App Router + Tailwind CSS).
   - Nhiệm vụ: Bảng điều khiển trực quan từ xa qua web (truy cập từ điện thoại hoặc máy tính khác). Cho phép bật/tắt quét, thêm từ khóa, quản lý nhóm, xem bài viết realtime và xuất Excel.

---

## 2. Các Nguyên Tắc Bất Di Bất Dịch (Immutable Rules)

1. **Tuyệt đối không phá vỡ logic an toàn của Extension**:
   - Không được thay đổi cơ chế 1 Tab Luân Phiên (Single-Tab Group Rotation) của Extension thành mở nhiều tab song song.
   - Không được loại bỏ thuật toán Jitter ngẫu nhiên hoặc trình cuộn chuột gián đoạn mô phỏng người thật.
2. **Tương thích ngược Schema Supabase**:
   - Hai bảng `fbradar_config` (id: `'default'`) và `fbradar_posts` đã được thiết lập sẵn trên Supabase. Mọi truy vấn từ Web Dashboard phải khớp với các tên cột hiện có.
   - Luôn sử dụng `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` cho các truy vấn Client-side.
3. **Bảo mật truy cập Web Dashboard**:
   - Web Dashboard điều khiển từ xa phải có lớp bảo vệ (Passcode/PIN đơn giản hoặc Auth) để ngăn chặn người ngoài truy cập trái phép.
4. **Tránh Memory Leak & Throttling**:
   - Extension và Web Dashboard phải giới hạn số bản ghi tải về (tối đa 50-100 bài gần nhất), hỗ trợ phân trang hoặc cuộn vô tận nếu cần.

---

## 3. Quy Ước Công Nghệ (Tech Stack)

- **Chrome Extension**: JavaScript thuần (ES6+), Manifest V3, Web Audio API, Web Notifications.
- **Web Dashboard**: Next.js 14+ (App Router), React, Tailwind CSS, Lucide Icons, `@supabase/supabase-js`.
- **Triển khai Web**: Tương thích hoàn toàn với nền tảng Vercel (1-click deploy).
