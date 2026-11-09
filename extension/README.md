# FB Group Keyword Radar (Chrome Extension - Manifest V3)

Tiện ích mở rộng Chrome giúp tự động theo dõi, phát hiện bài đăng mới trong nhiều hội nhóm Facebook theo từ khóa với **cơ chế 1 Tab Luân Phiên (Single-Tab Group Rotation)** – **An toàn tuyệt đối 100% (0% nguy cơ checkpoint/ban), cực kỳ nhẹ máy và đồng bộ đa tab**.

---

## 🌟 Cơ Chế 1 Tab Luân Phiên (Đã Nâng Cấp Mới)

Thay vì phải mở 3–5 tab gây ngốn RAM và khiến Facebook nghi ngờ hành vi bot đồng thời:
1. **Chỉ cần duy nhất 1 Tab Treo**:
   - Tab Treo sẽ ghé thăm **Nhóm 1** $\rightarrow$ Quét & lướt mô phỏng người đọc $\rightarrow$ Chờ theo thời gian cài đặt (+ Jitter ngẫu nhiên) $\rightarrow$ Tự động chuyển mượt sang **Nhóm 2** $\rightarrow$ **Nhóm 3**... rồi lặp lại vòng luân phiên.
2. **Không ảnh hưởng công việc ở các tab khác**:
   - Tab cá nhân của bạn (chat Messenger, lướt Newfeed) **không hề bị tự động chuyển trang hay can thiệp**.
   - Chỉ duy nhất tab được gắn nhãn `Tab Treo` mới thực hiện luân phiên.
3. **Đồng bộ hóa dữ liệu thời gian thực (Multi-tab Sync)**:
   - Dù bạn đang ở bất kỳ tab nào (Youtube, Google Docs hay tab FB khác), khi bấm vào biểu tượng Extension, toàn bộ:
     - Trạng thái hiện tại của Tab Treo (đang quét nhóm nào, còn bao lâu đổi nhóm).
     - Danh sách bài viết vừa bắt được (Logs).
     - Âm thanh và thông báo Desktop.
     đều hiển thị đồng bộ tức thì!

---

## 🚀 Hướng Dẫn Cài Đặt Vào Chrome

1. Mở trình duyệt Chrome (hoặc Edge / Cốc Cốc / Brave).
2. Truy cập vào trang quản lý tiện ích:  
   👉 `chrome://extensions/`
3. Ở góc trên cùng bên phải, bật công tắc **Chế độ dành cho nhà phát triển** (Developer mode).
4. Bấm nút **Tải tiện ích đã giải nén** (Load unpacked) ở góc trên bên trái.
5. Chọn thư mục dự án: `d:\Git\autoF`.
6. Ghim biểu tượng chữ **R** màu xanh của tiện ích lên thanh công cụ trình duyệt.

---

## 🛠️ Hướng Dẫn Sử Dụng Chi Tiết

### Bước 1: Cấu hình Từ khóa & Nhóm
1. Bấm vào icon tiện ích trên thanh công cụ.
2. Ở tab **Mục tiêu**:
   - Nhập các từ khóa cần tìm (ví dụ: `tuyển dụng`, `báo giá`, `freelancer`) $\rightarrow$ Bấm **Thêm**.
   - Nhập các link nhóm Facebook bạn muốn theo dõi $\rightarrow$ Bấm **Thêm**.
   - *(Mỗi nhóm đều có ô tích chọn `[✓]` riêng để bật/tắt, và biểu tượng bánh răng **`⚙️`** để **cài đặt riêng số nhịp cuộn & thời gian dừng** cho từng nhóm).*
   - **Mẹo tối ưu:** Nhóm nào có lượng bài đăng nhiều, bạn bấm `⚙️` rồi tăng số nhịp cuộn (ví dụ: `10`–`15` nhịp) và giảm thời gian dừng xuống (ví dụ: `1.5` phút). Nhóm nào ít bài thì để mặc định.

### Bước 2: Tinh chỉnh Tần suất & Hành vi
1. Chuyển sang tab **Hành vi**:
   - **Thời gian dừng ở mỗi nhóm**: Khuyên dùng từ `2` đến `5` phút.
   - **Biên độ Jitter**: Mặc định `±30%` (giúp mỗi lượt dừng có thời lượng ngẫu nhiên khác nhau).
   - **Tốc độ cuộn**: `Chậm & Tự nhiên` hoặc `Vừa phải`.

### Bước 3: Bật Giám sát & Mở Tab Treo
1. Bật công tắc **Master Toggle** sang trạng thái **ĐANG CHẠY** và bấm **Lưu Cài Đặt**.
2. Bấm nút **🚀 Mở Tab Treo** ngay ở thanh trạng thái trên đầu Extension:
   - Trình duyệt sẽ mở một tab Facebook chuyên dụng và bắt đầu tự động quét luân phiên qua các nhóm đã chọn.
   - Bạn có thể thu nhỏ tab này hoặc chuyển sang các tab khác làm việc bình thường!

---

## 🔔 Cảnh Báo Khi Có Bài Viết Mới
- **Desktop Notification**: Click vào thông báo sẽ mở ngay bài viết.
- **Chuông báo âm thanh**: Tiếng chuông 2 nốt nhẹ nhàng phát từ trình duyệt.
- **Telegram (Tùy chọn)**: Gửi tin nhắn về điện thoại kèm link bài viết nếu bạn đã điền Bot Token & Chat ID ở tab *Thông báo*.
- **Lịch sử bắt bài**: Xem lại toàn bộ các bài viết đã bắt được ở tab *Lịch sử*, tự động sắp xếp bài mới đăng nhất lên đầu kèm thời gian đăng bài thực tế (VD: `5 phút trước`, `1 giờ trước`).
- **Xuất dữ liệu Excel**: Nút **📥 Xuất Excel** trong tab *Lịch sử* giúp tải file `.csv` chuẩn UTF-8 BOM, mở trực tiếp trên Excel mà không bị lỗi font tiếng Việt, bao gồm đầy đủ: STT, thời gian đăng, thời gian phát hiện, tên nhóm, từ khóa khớp, trích đoạn bài viết, và liên kết bài viết.
