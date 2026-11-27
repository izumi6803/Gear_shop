using StockFlow.Inventory.BuildingBlocks;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Ordering.Api.Data;
using StockFlow.Inventory.Ordering.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Services;

/// <summary>
/// Storefront của khách mua hàng: đặt hàng (giữ tồn ngay) và thanh toán.
/// Hai phương thức: online (thẻ, mô phỏng) và tiền mặt/COD (thu khi giao).
/// </summary>
public sealed class ShopService(OrderingDbContext db, OrderService orders, ILogger<ShopService> logger)
{
    public async Task<Customer> RequireCustomerAsync(string username, CancellationToken ct = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == username, ct)
            ?? throw new OrderValidationException("Không tìm thấy tài khoản.");

        if (user.CustomerId is null)
        {
            throw new OrderValidationException(
                "Tài khoản này chưa gắn hồ sơ khách hàng, không dùng được chức năng mua hàng.");
        }

        return await db.Customers.FirstOrDefaultAsync(c => c.Id == user.CustomerId, ct)
            ?? throw new CustomerNotFoundException(user.CustomerId.Value);
    }

    /// <summary>Tạo đơn từ giỏ hàng và giữ tồn luôn — bước thanh toán làm sau (nếu chọn online).</summary>
    public async Task<OrderDto> CheckoutAsync(
        string username,
        ShopCheckoutRequest request,
        CancellationToken ct = default)
    {
        if (request.Lines is null || request.Lines.Count == 0)
        {
            throw new OrderValidationException("Giỏ hàng đang trống.");
        }

        var paymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod)
            ? PaymentMethods.Online
            : request.PaymentMethod.Trim().ToLowerInvariant();

        if (!PaymentMethods.IsValid(paymentMethod))
        {
            throw new OrderValidationException(
                $"Phương thức thanh toán không hợp lệ: {request.PaymentMethod}. Chỉ nhận 'online' hoặc 'cash'.");
        }

        var customer = await RequireCustomerAsync(username, ct);

        var lines = request.Lines
            .Where(l => l.Quantity > 0)
            .GroupBy(l => (l.ProductId, l.WarehouseId))
            .Select(g => new CreateOrderLine(g.Key.ProductId, g.Key.WarehouseId, g.Sum(x => x.Quantity)))
            .ToList();

        var created = await orders.CreateAsync(
            new CreateOrderRequest(customer.Id, DateOnly.FromDateTime(DateTime.UtcNow), lines, request.Note),
            username,
            ct,
            paymentMethod);

        // Giữ tồn ngay khi đặt: tránh bán quá số lượng đang có.
        var confirmed = await orders.ConfirmAsync(created.Id, ct);
        logger.LogInformation(
            "Checkout {OrderNo} cho {Customer} — {Total} ({Method})",
            confirmed.OrderNo,
            customer.Code,
            confirmed.TotalAmount,
            paymentMethod);
        return confirmed;
    }

    /// <summary>Thanh toán online bằng thẻ (mô phỏng). Chỉ chủ đơn hoặc nhân viên được gọi.</summary>
    public async Task<OrderDto> PayAsync(
        string username,
        bool isStaff,
        int orderId,
        PayRequest request,
        CancellationToken ct = default)
    {
        var order = await LoadOrderAsync(orderId, ct);

        if (!isStaff)
        {
            var customer = await RequireCustomerAsync(username, ct);
            if (order.CustomerId != customer.Id)
            {
                throw new OrderValidationException("Bạn chỉ thanh toán được đơn của mình.");
            }
        }

        ValidateCard(request);

        var reference = $"PAY-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}";
        order.MarkPaid(reference);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Thanh toán online {Reference} cho đơn {OrderNo}: {Amount}", reference, order.OrderNo, order.TotalAmount);
        return Mapping.ToOrderDto(order, order.Customer.Name);
    }

    /// <summary>Thu tiền mặt cho đơn COD — chỉ nhân viên.</summary>
    public async Task<OrderDto> CollectCashAsync(int orderId, CancellationToken ct = default)
    {
        var order = await LoadOrderAsync(orderId, ct);
        var reference = $"CASH-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}";
        order.MarkCashCollected(reference);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Thu tiền mặt {Reference} cho đơn {OrderNo}: {Amount}", reference, order.OrderNo, order.TotalAmount);
        return Mapping.ToOrderDto(order, order.Customer.Name);
    }

    public async Task<List<OrderDto>> MyOrdersAsync(string username, CancellationToken ct = default)
    {
        var customer = await RequireCustomerAsync(username, ct);

        var items = await db.Orders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.Lines)
            .Where(o => o.CustomerId == customer.Id)
            .OrderByDescending(o => o.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        return items.Select(o => Mapping.ToOrderDto(o, o.Customer.Name)).ToList();
    }

    private async Task<Order> LoadOrderAsync(int orderId, CancellationToken ct) =>
        await db.Orders
            .Include(o => o.Customer)
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct)
        ?? throw new OrderNotFoundException(orderId);

    /// <summary>Kiểm tra thẻ ở mức tối thiểu (Luhn + hạn dùng + CVV) — minh hoạ validate phía server.</summary>
    private static void ValidateCard(PayRequest request)
    {
        var digits = new string((request.CardNumber ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length is < 13 or > 19)
        {
            throw new OrderValidationException("Số thẻ phải có 13–19 chữ số.");
        }

        if (!Luhn(digits))
        {
            throw new OrderValidationException("Số thẻ không hợp lệ.");
        }

        if (string.IsNullOrWhiteSpace(request.CardHolder))
        {
            throw new OrderValidationException("Thiếu tên chủ thẻ.");
        }

        var expiry = (request.Expiry ?? string.Empty).Trim();
        var parts = expiry.Split('/', '-');
        if (parts.Length != 2
            || !int.TryParse(parts[0], out var month)
            || !int.TryParse(parts[1], out var year)
            || month is < 1 or > 12)
        {
            throw new OrderValidationException("Hạn dùng phải theo dạng MM/YY.");
        }

        var normalisedYear = year < 100 ? 2000 + year : year;
        var expiryDate = new DateTime(normalisedYear, month, 1).AddMonths(1).AddDays(-1);
        if (expiryDate < DateTime.UtcNow.Date)
        {
            throw new OrderValidationException("Thẻ đã hết hạn.");
        }

        var cvv = (request.Cvv ?? string.Empty).Trim();
        if (cvv.Length is < 3 or > 4 || !cvv.All(char.IsDigit))
        {
            throw new OrderValidationException("CVV phải là 3–4 chữ số.");
        }
    }

    private static bool Luhn(string digits)
    {
        var sum = 0;
        var alternate = false;
        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var value = digits[i] - '0';
            if (alternate)
            {
                value *= 2;
                if (value > 9)
                {
                    value -= 9;
                }
            }

            sum += value;
            alternate = !alternate;
        }

        return sum % 10 == 0;
    }
}
