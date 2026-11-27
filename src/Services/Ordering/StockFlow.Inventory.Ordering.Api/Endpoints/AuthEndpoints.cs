using System.Security.Cryptography;
using System.Text;
using StockFlow.Inventory.BuildingBlocks.Security;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Ordering.Api.Data;
using StockFlow.Inventory.Ordering.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/login", async (
            LoginRequest request,
            OrderingDbContext db,
            JwtTokenService tokens,
            CancellationToken ct) =>
        {
            var username = request.Username?.Trim() ?? string.Empty;

            var user = await db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == username && u.IsActive, ct);

            if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            {
                return Results.Json(
                    new ApiError("AUTH_INVALID_CREDENTIALS", "Sai tài khoản hoặc mật khẩu."),
                    statusCode: StatusCodes.Status401Unauthorized);
            }

            var (token, expiresAt) = tokens.Create(user.Username, user.DisplayName, user.Role, user.TokenVersion);
            return Results.Ok(new LoginResponse(token, expiresAt, user.DisplayName, user.Role));
        })
        .AllowAnonymous()
        .WithName("Login")
        .Produces<LoginResponse>()
        .Produces<ApiError>(StatusCodes.Status401Unauthorized);

        // Tự đăng ký tài khoản mua hàng: tạo hồ sơ khách + user role Customer, đăng nhập luôn.
        group.MapPost("/register", async (
            RegisterRequest request,
            OrderingDbContext db,
            JwtTokenService tokens,
            CancellationToken ct) =>
        {
            var username = (request.Username ?? string.Empty).Trim();
            if (username.Length < 3)
            {
                return Results.Json(
                    new ApiError("AUTH_INVALID_USERNAME", "Tên đăng nhập phải có ít nhất 3 ký tự."),
                    statusCode: StatusCodes.Status400BadRequest);
            }

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            {
                return Results.Json(
                    new ApiError("AUTH_WEAK_PASSWORD", "Mật khẩu phải có ít nhất 6 ký tự."),
                    statusCode: StatusCodes.Status400BadRequest);
            }

            if (await db.Users.AnyAsync(u => u.Username == username, ct))
            {
                return Results.Json(
                    new ApiError("AUTH_USERNAME_TAKEN", "Tên đăng nhập đã được sử dụng."),
                    statusCode: StatusCodes.Status409Conflict);
            }

            var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? username : request.DisplayName.Trim();
            var customerCount = await db.Customers.CountAsync(ct);

            var customer = new Domain.Customer
            {
                Code = $"C-{(customerCount + 1):D4}",
                Name = displayName,
                Email = string.IsNullOrWhiteSpace(request.Email) ? $"{username}@shop.local" : request.Email.Trim(),
                Phone = request.Phone?.Trim(),
                Address = request.Address?.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync(ct);

            var user = new Domain.AppUser
            {
                Username = username,
                PasswordHash = PasswordHasher.Hash(request.Password),
                DisplayName = displayName,
                Role = Roles.Customer,
                IsActive = true,
                CustomerId = customer.Id,
                CreatedAt = DateTime.UtcNow,
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(ct);

            var (token, expiresAt) = tokens.Create(user.Username, user.DisplayName, user.Role, user.TokenVersion);
            return Results.Ok(new LoginResponse(token, expiresAt, user.DisplayName, user.Role));
        })
        .AllowAnonymous()
        .WithName("Register")
        .Produces<LoginResponse>()
        .Produces<ApiError>(StatusCodes.Status400BadRequest);

        // Quên mật khẩu: luôn trả 200 + thông báo chung để không lộ tài khoản có tồn tại hay không.
        // Chế độ demo trả luôn token thô (Auth:ExposeResetToken) thay vì gửi email.
        const string forgotMessage = "Nếu tài khoản tồn tại, mã đặt lại đã được tạo.";

        group.MapPost("/forgot-password", async (
            ForgotPasswordRequest request,
            OrderingDbContext db,
            IConfiguration configuration,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("AuthEndpoints");
            var value = (request.UsernameOrEmail ?? string.Empty).Trim();
            var exposeToken = configuration.GetValue("Auth:ExposeResetToken", true);
            var now = DateTime.UtcNow;

            Domain.AppUser? user = null;
            if (value.Length > 0)
            {
                // Tìm theo username (không phân biệt hoa thường), nếu không có thì tìm theo email khách hàng.
                // EF Core chỉ dịch được ToLower()/ToUpper() sang SQL (không dịch ToLowerInvariant) nên tắt cảnh báo culture ở đây.
                var lowered = value.ToLowerInvariant();
#pragma warning disable CA1304, CA1311, CA1862
                user = await db.Users
                    .FirstOrDefaultAsync(u => u.Username.ToLower() == lowered && u.IsActive, ct);

                if (user is null)
                {
                    user = await (from u in db.Users
                                  join c in db.Customers on u.CustomerId equals c.Id
                                  where u.IsActive && c.Email != null && c.Email.ToLower() == lowered
                                  select u)
                        .FirstOrDefaultAsync(ct);
                }
#pragma warning restore CA1304, CA1311, CA1862
            }

            if (user is null)
            {
                return Results.Ok(new ForgotPasswordResponse(forgotMessage));
            }

            // Vô hiệu hóa các mã cũ chưa dùng của cùng user.
            var previous = await db.PasswordResetTokens
                .Where(t => t.UserId == user.Id && t.UsedAt == null)
                .ToListAsync(ct);
            foreach (var old in previous)
            {
                old.UsedAt = now;
            }

            var rawToken = Guid.NewGuid().ToString("N");
            var expiresAt = now.AddMinutes(30);
            db.PasswordResetTokens.Add(new Domain.PasswordResetToken
            {
                UserId = user.Id,
                TokenHash = HashToken(rawToken),
                CreatedAt = now,
                ExpiresAt = expiresAt,
            });
            await db.SaveChangesAsync(ct);

            // Không bao giờ log token thô.
            logger.LogInformation("Đã tạo mã đặt lại mật khẩu cho tài khoản {Username}.", user.Username);

            return Results.Ok(new ForgotPasswordResponse(
                forgotMessage,
                exposeToken ? rawToken : null,
                exposeToken ? new DateTimeOffset(DateTime.SpecifyKind(expiresAt, DateTimeKind.Utc)) : null));
        })
        .AllowAnonymous()
        .WithName("ForgotPassword")
        .Produces<ForgotPasswordResponse>();

        // Đặt lại mật khẩu: dùng token còn hạn, chưa dùng; đổi mật khẩu và vô hiệu hóa mọi mã còn lại.
        group.MapPost("/reset-password", async (
            ResetPasswordRequest request,
            OrderingDbContext db,
            CancellationToken ct) =>
        {
            var rawToken = (request.Token ?? string.Empty).Trim();
            if (rawToken.Length == 0)
            {
                return Results.Json(
                    new ApiError("AUTH_TOKEN_REQUIRED", "Mã đặt lại không được để trống."),
                    statusCode: StatusCodes.Status400BadRequest);
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            {
                return Results.Json(
                    new ApiError("AUTH_WEAK_PASSWORD", "Mật khẩu phải có ít nhất 6 ký tự."),
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var now = DateTime.UtcNow;
            var tokenHash = HashToken(rawToken);
            var resetToken = await db.PasswordResetTokens
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.UsedAt == null && t.ExpiresAt > now, ct);

            var user = resetToken is null
                ? null
                : await db.Users.FirstOrDefaultAsync(u => u.Id == resetToken.UserId, ct);

            if (resetToken is null || user is null || !user.IsActive)
            {
                return Results.Json(
                    new ApiError("AUTH_INVALID_TOKEN", "Mã đặt lại không hợp lệ hoặc đã hết hạn."),
                    statusCode: StatusCodes.Status400BadRequest);
            }

            user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
            // Đổi mật khẩu phải đá mọi phiên cũ ra (token mang ver cũ sẽ bị từ chối).
            user.TokenVersion++;

            // Mọi mã chưa dùng của user (gồm cả mã vừa dùng) đều bị vô hiệu hóa.
            var remaining = await db.PasswordResetTokens
                .Where(t => t.UserId == user.Id && t.UsedAt == null)
                .ToListAsync(ct);
            foreach (var other in remaining)
            {
                other.UsedAt = now;
            }

            resetToken.UsedAt = now;
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { message = "Đặt lại mật khẩu thành công." });
        })
        .AllowAnonymous()
        .WithName("ResetPassword")
        .Produces(StatusCodes.Status200OK)
        .Produces<ApiError>(StatusCodes.Status400BadRequest);

        return app;
    }

    /// <summary>SHA-256 hex của token thô — dạng duy nhất được lưu trong DB.</summary>
    private static string HashToken(string raw) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
}
