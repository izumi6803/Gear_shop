using System.Globalization;
using StockFlow.Inventory.BuildingBlocks;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Ordering.Api.Data;
using StockFlow.Inventory.Ordering.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Ordering.Api.Services;

/// <summary>
/// Điều phối nghiệp vụ đơn hàng. Ba điểm cần lưu ý khi đọc code này:
/// 1) Tạo đơn: giá/tên hàng lấy từ Catalog và *snapshot* vào ORDER_LINE.
/// 2) Confirm: reserve tồn ở Catalog TRƯỚC, commit trạng thái SAU; nếu bước sau lỗi thì
///    nhả tồn (compensation) để không giữ hàng "ma".
/// 3) Ship: issue tồn thực tế + sinh INVOICE trong cùng một SaveChanges.
/// </summary>
public sealed class OrderService(OrderingDbContext db, CatalogClient catalog, ILogger<OrderService> logger)
{
    private const int MaxNumberAttempts = 3;

    public async Task<PagedResult<OrderDto>> ListAsync(
        OrderStatus? status,
        int? customerId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Orders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.Lines)
            .AsQueryable();

        if (status is not null)
        {
            query = query.Where(o => o.Status == status);
        }

        if (customerId is > 0)
        {
            query = query.Where(o => o.CustomerId == customerId);
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<OrderDto>(
            items.Select(o => Mapping.ToOrderDto(o, o.Customer.Name)).ToList(),
            page,
            pageSize,
            total);
    }

    public async Task<OrderDto> GetAsync(int orderId, CancellationToken ct = default)
    {
        var order = await LoadAsync(orderId, ct);
        return Mapping.ToOrderDto(order, order.Customer.Name);
    }

    public async Task<OrderDto> CreateAsync(
        CreateOrderRequest request,
        string createdBy,
        CancellationToken ct = default,
        string paymentMethod = PaymentMethods.Cash)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, ct)
            ?? throw new CustomerNotFoundException(request.CustomerId);

        if (!customer.IsActive)
        {
            throw new OrderValidationException($"Khách hàng {customer.Code} đang ngừng giao dịch.");
        }

        if (request.Lines is null || request.Lines.Count == 0)
        {
            throw new OrderValidationException("Đơn hàng phải có ít nhất một dòng hàng.");
        }

        var lines = request.Lines
            .GroupBy(l => (l.ProductId, l.WarehouseId))
            .Select(g => new CreateOrderLine(g.Key.ProductId, g.Key.WarehouseId, g.Sum(x => x.Quantity)))
            .ToList();

        if (lines.Any(l => l.Quantity <= 0))
        {
            throw new OrderValidationException("Số lượng phải lớn hơn 0.");
        }

        var lookup = await catalog.LookupProductsAsync(lines.Select(l => l.ProductId).Distinct().ToList(), ct);
        if (lookup.MissingIds.Count > 0)
        {
            throw new ProductUnavailableException($"Không tìm thấy sản phẩm: {string.Join(", ", lookup.MissingIds)}.");
        }

        var byId = lookup.Items.ToDictionary(p => p.Id);
        var inactive = lines
            .Where(l => !byId[l.ProductId].IsActive)
            .Select(l => byId[l.ProductId].Code)
            .Distinct()
            .ToList();

        if (inactive.Count > 0)
        {
            throw new ProductUnavailableException($"Sản phẩm đã ngừng bán: {string.Join(", ", inactive)}.");
        }

        for (var attempt = 1; attempt <= MaxNumberAttempts; attempt++)
        {
            var order = Order.Create(await NextOrderNoAsync(ct), customer.Id, request.OrderDate, request.Note, createdBy, paymentMethod);
            foreach (var line in lines)
            {
                var product = byId[line.ProductId];
                order.AddLine(product.Id, product.Code, product.Name, line.WarehouseId, product.UnitPrice, line.Quantity);
            }

            db.Orders.Add(order);

            try
            {
                await db.SaveChangesAsync(ct);
                return Mapping.ToOrderDto(order, customer.Name);
            }
            catch (DbUpdateException) when (attempt < MaxNumberAttempts)
            {
                // Trùng số đơn (2 người tạo cùng lúc): sinh lại số khác.
                db.ChangeTracker.Clear();
            }
        }

        throw new ConcurrencyConflictException("Không sinh được số đơn hàng, vui lòng thử lại.");
    }

    public async Task<OrderDto> ConfirmAsync(int orderId, CancellationToken ct = default)
    {
        var order = await LoadAsync(orderId, ct);
        order.EnsureCanConfirm();

        var reservation = new StockReserveRequest(order.OrderNo, Mapping.ToStockItems(order));
        var result = await catalog.ReserveAsync(reservation, ct);

        if (!result.Success)
        {
            var detail = string.Join(
                "; ",
                result.Shortages.Select(s => $"SP {s.ProductId}/kho {s.WarehouseId}: cần {s.Requested}, còn {s.Available}"));

            throw new StockConflictException($"Không đủ tồn kho để xác nhận đơn {order.OrderNo}. {detail}");
        }

        try
        {
            order.Confirm();
            await db.SaveChangesAsync(ct);
        }
        catch (Exception)
        {
            // Compensation: đã giữ tồn nhưng không lưu được trạng thái → nhả lại.
            await ReleaseQuietlyAsync(reservation, ct);
            throw;
        }

        return Mapping.ToOrderDto(order, order.Customer.Name);
    }

    public async Task<OrderDto> CancelAsync(int orderId, CancellationToken ct = default)
    {
        var order = await LoadAsync(orderId, ct);
        var holdsStock = order.HoldsStock;

        // Validate + đổi trạng thái trong bộ nhớ trước; nếu bước sau lỗi thì không SaveChanges.
        order.Cancel();

        if (holdsStock)
        {
            await catalog.ReleaseAsync(new StockReserveRequest(order.OrderNo, Mapping.ToStockItems(order)), ct);
        }

        await db.SaveChangesAsync(ct);
        return Mapping.ToOrderDto(order, order.Customer.Name);
    }

    public async Task<ShipResult> ShipAsync(int orderId, CancellationToken ct = default)
    {
        var order = await LoadAsync(orderId, ct);
        if (order.Status != OrderStatus.Confirmed)
        {
            throw new OrderStateException($"Chỉ xuất kho được đơn đã xác nhận (hiện tại {order.Status}).");
        }

        await catalog.IssueAsync(new StockReserveRequest(order.OrderNo, Mapping.ToStockItems(order)), ct);

        order.MarkShipped();

        var now = DateTime.UtcNow;
        var invoice = new Invoice
        {
            InvoiceNo = await NextInvoiceNoAsync(now, ct),
            OrderId = order.Id,
            IssuedAt = now,
            DueDate = DateOnly.FromDateTime(now.AddDays(30)),
            Amount = order.SubTotal,
            TaxAmount = order.TaxAmount,
            ShippingFee = order.ShippingFee,
            Status = "Issued"
        };

        db.Invoices.Add(invoice);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyConflictException("Đơn hàng vừa bị thay đổi bởi người khác, vui lòng tải lại.");
        }

        return new ShipResult(
            Mapping.ToOrderDto(order, order.Customer.Name),
            Mapping.ToInvoiceDto(invoice, order.OrderNo));
    }

    private async Task<Order> LoadAsync(int orderId, CancellationToken ct) =>
        await db.Orders
            .Include(o => o.Customer)
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct)
        ?? throw new OrderNotFoundException(orderId);

    private async Task<string> NextOrderNoAsync(CancellationToken ct)
    {
        var prefix = "SO-" + DateTime.UtcNow.ToString("yyyyMM", CultureInfo.InvariantCulture) + "-";
        var last = await db.Orders
            .Where(o => o.OrderNo.StartsWith(prefix))
            .OrderByDescending(o => o.OrderNo)
            .Select(o => o.OrderNo)
            .FirstOrDefaultAsync(ct);

        var next = 1;
        if (last is not null && int.TryParse(last[prefix.Length..], out var parsed))
        {
            next = parsed + 1;
        }

        return prefix + next.ToString("0000", CultureInfo.InvariantCulture);
    }

    private async Task<string> NextInvoiceNoAsync(DateTime now, CancellationToken ct)
    {
        var prefix = "INV-" + now.ToString("yyyyMM", CultureInfo.InvariantCulture) + "-";
        var last = await db.Invoices
            .Where(i => i.InvoiceNo.StartsWith(prefix))
            .OrderByDescending(i => i.InvoiceNo)
            .Select(i => i.InvoiceNo)
            .FirstOrDefaultAsync(ct);

        var next = 1;
        if (last is not null && int.TryParse(last[prefix.Length..], out var parsed))
        {
            next = parsed + 1;
        }

        return prefix + next.ToString("0000", CultureInfo.InvariantCulture);
    }

    private async Task ReleaseQuietlyAsync(StockReserveRequest request, CancellationToken ct)
    {
        try
        {
            await catalog.ReleaseAsync(request, ct);
        }
        catch (Exception ex)
        {
            // Không nuốt lỗi âm thầm: log để đối soát tay, vì tồn có thể còn bị giữ.
            logger.LogError(ex, "Không nhả được tồn kho cho đơn {OrderNo} sau khi confirm thất bại.", request.ReferenceNo);
        }
    }
}
