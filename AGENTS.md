# AGENTS.md - Quy Tắc & Kiến Trúc Dự Án FB Group Keyword Radar

Tài liệu này là quy tắc bất di bất dịch dành cho các AI Coding Assistant tham gia phát triển dự án này. Mọi thay đổi mã nguồn phải tuân thủ nghiêm ngặt các nguyên tắc dưới đây.

---

## 1. Cấu Trúc Thư Mục Bắt Buộc (Strict Directory Structure)

Thư mục gốc của dự án **CHỈ ĐƯỢC PHÉP CHỨA ĐÚNG 3 THƯ MỤC CON** và file chỉ dẫn:
```text
autoF/
├── AGENTS.md          # Quy tắc & kiến trúc toàn dự án cho AI
├── .gitignore         # Bỏ qua node_modules, build cache, env local
├── package.json       # Script chạy nhanh npm run dev cho toàn dự án
├── extension/         # Module Chrome Extension (Worker quét Facebook an toàn)
├── frontend/          # Module Frontend Web Dashboard (React + Tailwind CSS)
└── backend/           # Module Backend API (Next.js)
```
> **NGHIÊM CẤM:** Tuyệt đối không tạo thêm các file hoặc thư mục linh tinh ở thư mục gốc ngoài 3 thư mục trên và các file cấu hình chuẩn (`package.json`, `AGENTS.md`, `.gitignore`).

---

## 2. Quy Ước Công Nghệ Cho Từng Thư Mục (Độc Lập 100%)

Mỗi thư mục con là một dự án **hoàn toàn độc lập**, có thể chạy, build và deploy riêng biệt:

### 📁 1. `extension/` (Chrome Extension Worker)
- **Công nghệ**: JavaScript thuần (ES6+), Manifest V3, Web Audio API, Web Notifications.
- **Tính chất**: Cực kỳ gọn nhẹ, không dùng framework cồng kềnh, không bundle phức tạp.
- **Cách chạy**: Nạp trực tiếp thư mục `extension/` vào Chrome qua `chrome://extensions/` (Developer Mode -> Load Unpacked).
- **Nhiệm vụ**: Tab Treo giả lập hành vi người dùng thật (cuộn ngắt quãng, dừng đọc, Jitter delay, 1 tab luân phiên qua các nhóm). Tự động đồng bộ bài viết và nhịp tim (heartbeat) lên Supabase qua `supabase.js`.

### 📁 2. `frontend/` (Web Dashboard Client)
- **Công nghệ**: **React** + **Tailwind CSS**.
- **Quy tắc CSS**: **Chỉ sử dụng Tailwind CSS** cho toàn bộ styling giao diện. **Chỉ được viết CSS thuần khi Tailwind thực sự không làm được** (ví dụ: các animation keyframes phức tạp của sóng radar).
- **Tính chất**: Độc lập, có `package.json` riêng, chạy độc lập (`npm run dev`).
- **Nhiệm vụ**: Giao diện điều khiển trực quan từ xa:
  - Xem trạng thái Tab Treo (Online / Offline).
  - Công tắc tổng Bật / Tắt quét từ xa.
  - Quản lý từ khóa, quản lý nhóm (bật/tắt, chỉnh số bước cuộn & thời gian dừng riêng).
  - Bảng danh sách bài viết thời gian thực (Supabase Realtime) & Nút xuất file Excel (.csv UTF-8).

### 📁 3. `backend/` (Backend Server / API)
- **Công nghệ**: **Next.js** (App Router / API routes).
- **Database**: **Supabase** (PostgreSQL + REST API + Realtime).
- **Tính chất**: Độc lập, có `package.json` riêng, chạy độc lập (`npm run dev`).
- **Nhiệm vụ**: Cung cấp các API endpoints/Server actions xử lý xác thực truy cập (mã PIN/Passcode bảo vệ dashboard), quản lý webhook, proxy hoặc các tác vụ server-side an toàn.

---

## 3. Cấu Trúc Database Supabase Đã Thiết Lập

Hai bảng dữ liệu sau đã được khởi tạo và chạy trực tiếp trên Supabase (`mugaogyqtqgwhrfkfdgm.supabase.co`), mọi truy vấn từ `extension/`, `frontend/`, và `backend/` phải tuân thủ đúng tên cột:

1. **`public.fbradar_config` (id: `'default'`)**:
   - `id`: `'default'`
   - `enabled`: `boolean` (Bật / Tắt quét từ xa)
   - `keywords`: `jsonb` (Mảng từ khóa: `["tuyển dụng", "báo giá"]`)
   - `groups`: `jsonb` (Mảng nhóm: `[{ url, name, enabled, scrollSteps, reloadMinutes }]`)
   - `reload_minutes`: `numeric`
   - `jitter_percent`: `integer`
   - `scroll_speed`: `text`
   - `max_scroll_steps`: `integer`
   - `runner_status`: `text` (Trạng thái hiển thị của Tab Treo)
   - `current_running_group`: `text`
   - `last_heartbeat`: `timestamptz` (Thời điểm ping gần nhất)
   - `updated_at`: `timestamptz`

2. **`public.fbradar_posts`**:
   - `id`: `text` (Khóa chính - Post ID)
   - `group_title`: `text`
   - `group_url`: `text`
   - `matched_keyword`: `text`
   - `post_text`: `text`
   - `post_link`: `text`
   - `post_time`: `text` (VD: `5 phút trước`)
   - `post_timestamp`: `bigint` (Timestamp hỗ trợ sắp xếp bài mới nhất)
   - `detected_at`: `timestamptz`
---

## 4. Các Nguyên Tắc Bất Di Bất Dịch (Immutable Rules)

1. **Bảo toàn an toàn cho Extension**:
   - Tuyệt đối không thay đổi cơ chế 1 Tab Luân Phiên (Single-Tab Group Rotation) của Extension thành mở nhiều tab.
   - Không được gỡ bỏ thuật toán Jitter ngẫu nhiên hoặc trình cuộn chuột tự nhiên.
2. **Không xâm lấn chéo giữa các thư mục**:
   - Code của `frontend/` nằm trong `frontend/`.
   - Code của `backend/` nằm trong `backend/`.
   - Code của `extension/` nằm trong `extension/`.
3. **Bảo mật truy cập Web Dashboard**:
   - Web Dashboard điều khiển từ xa phải có lớp bảo vệ (mã PIN / Passcode) để ngăn chặn người ngoài truy cập trái phép.
