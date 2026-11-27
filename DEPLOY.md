# Deploy

Ứng dụng gồm **2 phần tách rời**, và điều này quyết định cách deploy:

| Phần | Công nghệ | Deploy ở đâu | Vì sao |
|---|---|---|---|
| **Frontend** (`src/Web.Spa`) | React + Vite → static | **Vercel** ✅ | chỉ là file tĩnh, Vercel sinh ra để làm việc này |
| **Backend** (2 API .NET 8 + SQLite) | ASP.NET Core 8 | Docker: Fly.io / Railway / Render / VPS | Vercel **không có runtime .NET** và filesystem read-only (SQLite cần ghi file) |

> Nói ngắn: **Vercel chỉ chứa frontend**. Nếu chỉ deploy frontend mà không có backend công khai thì web sẽ trắng dữ liệu — vì trình duyệt gọi `localhost:5081` của máy bạn.

---

## 1. Backend (làm trước, để có URL)

### Cách A — Docker Compose trên VPS bất kỳ (đầy đủ nhất)

```bash
# trên server đã có Docker
git clone <repo> stockflow && cd stockflow
export JWT_KEY="$(openssl rand -hex 32)"
export INTERNAL_KEY="$(openssl rand -hex 16)"
export APP_ORIGIN="https://your-app.vercel.app"   # domain frontend để CORS cho phép
docker compose -f deploy/docker-compose.yml up -d --build
```

Kết quả: `http://server:5080` (Catalog), `http://server:5081` (Ordering).
Nên đặt sau Nginx/Caddy với HTTPS:

```
api-catalog.example.com  → 127.0.0.1:5080
api-ordering.example.com → 127.0.0.1:5081
```

### Cách B — Fly.io / Railway / Render (dùng Dockerfile có sẵn)

`deploy/Dockerfile.api` build được cả 2 API:

```bash
docker build -f deploy/Dockerfile.api --build-arg PROJECT=Catalog  -t stockflow-catalog  .
docker build -f deploy/Dockerfile.api --build-arg PROJECT=Ordering -t stockflow-ordering .
```

Biến môi trường **bắt buộc** cho mỗi service:

| Biến | Catalog | Ordering | Ghi chú |
|---|---|---|---|
| `ConnectionStrings__CatalogDb` | `Data Source=/data/catalog.db` | — | volume `/data` |
| `ConnectionStrings__OrderingDb` | — | `Data Source=/data/ordering.db` | volume `/data` |
| `Services__CatalogBaseUrl` | — | `http://<catalog-host>:8080` | Ordering gọi Catalog |
| `Jwt__Key` | ✅ | ✅ | **giống nhau** ở cả 2 service |
| `Internal__ApiKey` | ✅ | ✅ | **giống nhau**, bảo vệ `/internal/*` |
| `Cors__AllowedOrigins__0` | ✅ | ✅ | domain Vercel, vd `https://stockflow.vercel.app` |
| `Database__Provider` | `Sqlite` | `Sqlite` | hoặc bỏ trống + dùng SQL Server |

> SQLite cần ổ đĩa ghi được. Trên Fly.io dùng `fly volumes create data`; Railway/Render gắn disk vào `/data`.

---

## 2. Frontend lên Vercel

### Bước 1 — trỏ SPA về backend công khai

Sửa trong **Vercel → Project → Settings → Environment Variables** (Production + Preview):

```
VITE_ORDERING_BASE = https://api-ordering.example.com
VITE_CATALOG_BASE  = https://api-catalog.example.com
```

(Trong repo, `src/Web.Spa/.env.production.example` là bản mẫu.)

### Bước 2 — deploy bằng CLI

```bash
npm i -g vercel           # nếu chưa có
cd src/Web.Spa
vercel login              # xác thực (browser/email)
vercel --prod             # deploy production
```

Hoặc nối GitHub repo vào Vercel:

- **Root Directory**: `src/Web.Spa`
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

`src/Web.Spa/vercel.json` đã cấu hình sẵn: SPA rewrite (F5 ở `/orders/12` không 404), cache 1 năm cho `/assets/*`, cache 7 ngày cho `/products/*`, `no-store` cho `index.html`.

### Bước 3 — kiểm tra

```bash
curl -I https://your-app.vercel.app                 # 200
curl -s https://your-app.vercel.app/products/photos/p-3001.jpg -o NUL -w "%{http_code}\n"   # 200
```

Mở web → thấy 8 sản phẩm kèm ảnh → đăng nhập `admin/Admin@123` → nếu báo lỗi mạng thì 99% là **CORS**: thêm domain Vercel vào `Cors__AllowedOrigins__0` của **cả 2** API rồi restart.

---

## 3. Checklist trước khi cho người khác dùng

- [ ] `Jwt__Key` và `Internal__ApiKey` đổi khỏi giá trị dev
- [ ] `Cors__AllowedOrigins__0` = đúng domain Vercel (không để `*` khi có Bearer token)
- [ ] Volume `/data` cho SQLite (hoặc chuyển sang SQL Server: bỏ `Database__Provider`, đặt `ConnectionStrings__*`)
- [ ] Đổi mật khẩu seed (`Seed__AdminPassword`, …) **trước lần chạy đầu** — seed chỉ chạy khi DB trống
- [ ] Thanh toán vẫn là **sandbox** (không có cổng thật) — đừng quảng cáo là thanh toán thật
- [ ] Ảnh: xem `src/Web.Spa/public/products/photos/CREDITS.md` (CC BY/BY-SA phải ghi công)

## 4. Giới hạn đã biết

- `Auth:ExposeResetToken` mặc định **bật** để demo quên mật khẩu không cần email. Production nên đặt `Auth__ExposeResetToken=false` và tự gửi mail.
- Catalog API không kiểm tra `TokenVersion` (không có bảng user) → token cũ vẫn sửa được sản phẩm tới khi hết hạn.

---

## Trạng thái deploy hiện tại (đã chạy thật)

| Hạng mục | Giá trị |
|---|---|
| Repo | https://github.com/izumi6803/Gear_shop (nhánh `main`) |
| Frontend (Vercel) | **https://gear-shop-nine.vercel.app** |
| Vercel project | `gear-shop` (team `shins-projects-fb2bae44`) |
| Backend | 2 API local, expose qua **Cloudflare quick tunnel** (tạm thời) |

Biến môi trường đã đặt trên Vercel (Production/Preview/Development):

```
VITE_CATALOG_BASE  = https://ancient-flows-arrived-ultimate.trycloudflare.com
VITE_ORDERING_BASE = https://strict-tourism-geographic-golf.trycloudflare.com
```

> ⚠️ **Quick tunnel chỉ sống khi máy đang bật cloudflared + 2 API.** Khi tắt máy, site vẫn mở được nhưng không có dữ liệu. Muốn cố định: chạy `deploy/docker-compose.yml` trên VPS của bạn (mục 1 cách A), rồi **đổi 2 biến trên** thành domain API của bạn và `vercel --prod` lại — không cần sửa code.

### Lệnh deploy lại frontend

```bash
cd src/Web.Spa
vercel --prod
```

### Đã xác minh trên bản deploy

| Kiểm tra | Kết quả |
|---|---|
| `/`, `/shop`, `/orders/12` (deep link) | HTTP 200 |
| 8 sản phẩm + 8 ảnh tải từ API công khai | OK, 0 lỗi console |
| Đăng nhập `customer` trên site thật | OK (role Customer) |
| Thêm vào giỏ + phí ship 15 US$ | OK (tổng 28,00 US$) |
| CORS từ domain Vercel tới 2 API | `Access-Control-Allow-Origin` đúng |
