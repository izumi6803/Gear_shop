using StockFlow.Inventory.BuildingBlocks.Security;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Ordering.Api.Data;
using StockFlow.Inventory.Ordering.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Services;

/// <summary>Quản trị tài khoản (Admin): danh sách, tạo, đổi role, khoá/mở, và số liệu trạng thái.</summary>
public sealed class AccountService(OrderingDbContext db)
{
    private static readonly string[] AssignableRoles =
    {
        Roles.Admin, Roles.Sales, Roles.Viewer, Roles.Customer,
    };

    public async Task<List<AccountDto>> ListAsync(CancellationToken ct = default)
    {
        return await db.Users
            .AsNoTracking()
            .OrderBy(u => u.Id)
            .Select(u => new AccountDto(
                u.Id,
                u.Username,
                u.DisplayName,
                u.Role,
                u.IsActive,
                u.CreatedAt,
                u.CustomerId))
            .ToListAsync(ct);
    }

    public async Task<AccountDto> CreateAsync(CreateAccountRequest request, CancellationToken ct = default)
    {
        var username = (request.Username ?? string.Empty).Trim();
        if (username.Length < 3)
        {
            throw new OrderValidationException("Tên đăng nhập phải có ít nhất 3 ký tự.");
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
        {
            throw new OrderValidationException("Mật khẩu phải có ít nhất 6 ký tự.");
        }

        var role = NormaliseRole(request.Role);

        if (await db.Users.AnyAsync(u => u.Username == username, ct))
        {
            throw new OrderValidationException($"Tên đăng nhập '{username}' đã tồn tại.");
        }

        int? customerId = null;
        if (role == Roles.Customer)
        {
            // Tài khoản mua hàng cần hồ sơ khách để gắn đơn.
            var customer = new Customer
            {
                Code = await NextCustomerCodeAsync(ct),
                Name = string.IsNullOrWhiteSpace(request.DisplayName) ? username : request.DisplayName.Trim(),
                Email = $"{username}@shop.local",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync(ct);
            customerId = customer.Id;
        }

        var user = new AppUser
        {
            Username = username,
            PasswordHash = PasswordHasher.Hash(request.Password),
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? username : request.DisplayName.Trim(),
            Role = role,
            IsActive = true,
            CustomerId = customerId,
            CreatedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task<AccountDto> UpdateAsync(int id, UpdateAccountRequest request, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new OrderValidationException($"Không tìm thấy tài khoản #{id}.");

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            user.DisplayName = request.DisplayName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var role = NormaliseRole(request.Role);

            if (user.Role == Roles.Admin && role != Roles.Admin)
            {
                await EnsureNotLastAdminAsync(user.Id, ct);
            }

            if (role != user.Role)
            {
                // Đổi sang Customer mà chưa có hồ sơ khách thì phải tạo + gắn, nếu không
                // tài khoản đó không thể đặt hàng (checkout sẽ báo thiếu hồ sơ khách).
                if (role == Roles.Customer && user.CustomerId is null)
                {
                    var customer = new Customer
                    {
                        Code = await NextCustomerCodeAsync(ct),
                        Name = string.IsNullOrWhiteSpace(user.DisplayName) ? user.Username : user.DisplayName,
                        Email = $"{user.Username}@shop.local",
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                    };
                    db.Customers.Add(customer);
                    await db.SaveChangesAsync(ct);
                    user.CustomerId = customer.Id;
                }

                user.Role = role;
                // Quyền vừa đổi ⇒ token phát hành trước đó phải mất hiệu lực ngay.
                user.TokenVersion++;
            }
        }

        if (request.IsActive is not null)
        {
            if (!request.IsActive.Value)
            {
                if (user.Role == Roles.Admin)
                {
                    await EnsureNotLastAdminAsync(user.Id, ct);
                }

                if (string.Equals(user.Username, "admin", StringComparison.OrdinalIgnoreCase))
                {
                    throw new OrderValidationException("Không thể khoá tài khoản admin gốc.");
                }
            }

            if (user.IsActive != request.IsActive.Value)
            {
                user.IsActive = request.IsActive.Value;
                // Khoá tài khoản ⇒ token đang dùng cũng phải chết ngay.
                user.TokenVersion++;
            }
        }

        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task<ShopStatsDto> StatsAsync(CancellationToken ct = default)
    {
        var orders = db.Orders.AsNoTracking();

        var total = await orders.CountAsync(ct);
        var draft = await orders.CountAsync(o => o.Status == OrderStatus.Draft, ct);
        var confirmed = await orders.CountAsync(o => o.Status == OrderStatus.Confirmed, ct);
        var shipped = await orders.CountAsync(o => o.Status == OrderStatus.Shipped, ct);
        var cancelled = await orders.CountAsync(o => o.Status == OrderStatus.Cancelled, ct);
        var unpaid = await orders.CountAsync(
            o => o.PaymentStatus == OrderPaymentStatus.Unpaid && o.Status != OrderStatus.Cancelled,
            ct);
        // SQLite không dịch được SUM(decimal) → lấy về rồi cộng (số đơn nhỏ, chấp nhận được).
        var paidAmounts = await orders
            .Where(o => o.PaymentStatus == OrderPaymentStatus.Paid)
            .Select(o => o.TotalAmount)
            .ToListAsync(ct);
        var revenue = paidAmounts.Sum();

        return new ShopStatsDto(
            total,
            draft,
            confirmed,
            shipped,
            cancelled,
            unpaid,
            revenue,
            await db.Customers.CountAsync(ct),
            await db.Users.CountAsync(ct));
    }

    private async Task EnsureNotLastAdminAsync(int userId, CancellationToken ct)
    {
        var otherAdmins = await db.Users
            .CountAsync(u => u.Role == Roles.Admin && u.IsActive && u.Id != userId, ct);

        if (otherAdmins == 0)
        {
            throw new OrderValidationException("Phải còn ít nhất một tài khoản Admin đang hoạt động.");
        }
    }

    private async Task<string> NextCustomerCodeAsync(CancellationToken ct)
    {
        var count = await db.Customers.CountAsync(ct);
        return $"C-{(count + 1):D4}";
    }

    private static string NormaliseRole(string? role)
    {
        var value = (role ?? string.Empty).Trim();
        var match = AssignableRoles.FirstOrDefault(r => string.Equals(r, value, StringComparison.OrdinalIgnoreCase));
        return match ?? throw new OrderValidationException(
            $"Role không hợp lệ. Chọn một trong: {string.Join(", ", AssignableRoles)}.");
    }

    private static AccountDto ToDto(AppUser user) => new(
        user.Id,
        user.Username,
        user.DisplayName,
        user.Role,
        user.IsActive,
        user.CreatedAt,
        user.CustomerId);
}
