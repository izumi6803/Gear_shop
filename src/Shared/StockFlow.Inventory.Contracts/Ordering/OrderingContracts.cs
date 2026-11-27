using StockFlow.Inventory.Contracts;

namespace StockFlow.Inventory.Contracts.Ordering;

public sealed record CustomerDto(
    int Id,
    string Code,
    string Name,
    string? Email,
    string? Phone,
    string? Address,
    bool IsActive);

public sealed record CreateOrderLine(int ProductId, int WarehouseId, int Quantity);

public sealed record CreateOrderRequest(
    int CustomerId,
    DateOnly OrderDate,
    IReadOnlyList<CreateOrderLine> Lines,
    string? Note = null);

public sealed record OrderLineDto(
    int Id,
    int ProductId,
    string ProductCode,
    string ProductName,
    int WarehouseId,
    int Quantity,
    decimal UnitPrice,
    decimal LineAmount);

public sealed record OrderDto(
    int Id,
    string OrderNo,
    int CustomerId,
    string CustomerName,
    DateOnly OrderDate,
    string Status,
    decimal SubTotal,
    decimal TaxAmount,
    decimal TotalAmount,
    string? Note,
    DateTime CreatedAt,
    DateTime? ConfirmedAt,
    DateTime? ShippedAt,
    IReadOnlyList<OrderLineDto> Lines,
    string PaymentStatus = "Unpaid",
    DateTime? PaidAt = null,
    string? PaymentMethod = null,
    string? PaymentReference = null,
    decimal ShippingFee = 0m);

public sealed record InvoiceDto(
    int Id,
    string InvoiceNo,
    string OrderNo,
    DateTime IssuedAt,
    DateOnly DueDate,
    decimal Amount,
    decimal TaxAmount,
    string Status,
    decimal ShippingFee = 0m);

/// <summary>
/// Hoá đơn đầy đủ để in tax invoice (qualified invoice): có bên bán/bên mua,
/// ngày giao dịch và chi tiết dòng hàng — đủ 6 mục mà the tax authority yêu cầu.
/// </summary>
public sealed record InvoiceDetailDto(
    int Id,
    string InvoiceNo,
    string OrderNo,
    int OrderId,
    DateTime IssuedAt,
    DateOnly DueDate,
    DateOnly OrderDate,
    string CustomerName,
    string? CustomerAddress,
    string Status,
    decimal SubTotal,
    decimal TaxAmount,
    decimal Amount,
    IReadOnlyList<OrderLineDto> Lines,
    decimal ShippingFee = 0m);

/// <summary>Seller profile printed on invoices (configured via appsettings / env, never hard-coded).</summary>
public sealed record CompanyProfileDto(
    string Name,
    string AddressLine,
    string City,
    string PostalCode,
    string Country,
    string Email,
    string Phone,
    string TaxId,
    string BankAccount,
    string PaymentTerms,
    string Currency);

/// <summary>Kết quả POST /api/orders/{id}/ship: đơn đã xuất kho + hoá đơn vừa sinh.</summary>
public sealed record ShipResult(OrderDto Order, InvoiceDto Invoice);

// ---------- Storefront (khách mua hàng) ----------

public sealed record ShopCheckoutLine(int ProductId, int WarehouseId, int Quantity);

public sealed record ShopCheckoutRequest(
    IReadOnlyList<ShopCheckoutLine> Lines,
    string? Note = null,
    string? PaymentMethod = "online");

/// <summary>Thanh toán mô phỏng: hệ thống không gọi cổng thanh toán thật.</summary>
public sealed record PayRequest(
    string Method,
    string CardNumber,
    string CardHolder,
    string Expiry,
    string Cvv);

// ---------- Quản lý tài khoản (Admin) ----------

public sealed record AccountDto(
    int Id,
    string Username,
    string DisplayName,
    string Role,
    bool IsActive,
    DateTime CreatedAt,
    int? CustomerId);

public sealed record CreateAccountRequest(
    string Username,
    string Password,
    string DisplayName,
    string Role);

public sealed record UpdateAccountRequest(string? DisplayName, string? Role, bool? IsActive);

/// <summary>Số liệu tổng quan cho màn hình trạng thái của Admin.</summary>
public sealed record ShopStatsDto(
    int OrdersTotal,
    int OrdersDraft,
    int OrdersConfirmed,
    int OrdersShipped,
    int OrdersCancelled,
    int OrdersUnpaid,
    decimal RevenuePaid,
    int Customers,
    int Accounts);
