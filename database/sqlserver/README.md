# SQL Server schema (generated)

Hai file trong thư mục này được **sinh tự động từ EF Core model** (không viết tay):

| File | DbContext |
|---|---|
| `catalog-schema.sql` | `CatalogDbContext` — PRODUCT, WAREHOUSE, STOCK, STOCK_MOVEMENT |
| `ordering-schema.sql` | `OrderingDbContext` — CUSTOMER, ORDER, ORDER_LINE, INVOICE, APP_USER |

Cách sinh lại (từ thư mục gốc repo):

```bash
dotnet run --project tools/StockFlow.Inventory.ModelCheck
```

Công cụ này dùng `Database.GenerateCreateScript()` nên **không cần kết nối SQL Server** — hữu ích để review model trong code review hoặc gửi DBA duyệt.

Lưu ý:

- App dùng `EnsureCreated()` (dev/demo). Production nên dùng **EF migrations** (`dotnet ef migrations add Init`) để quản lý thay đổi schema có version.
- `rowversion` = optimistic concurrency token; `IX_Movement_Product_OccurredAt` có `DESC` để truy vấn "biến động gần nhất" nhanh.
