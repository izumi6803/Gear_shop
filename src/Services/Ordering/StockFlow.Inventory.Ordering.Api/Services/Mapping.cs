using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Ordering.Api.Domain;

namespace StockFlow.Inventory.Ordering.Api.Services;

public static class Mapping
{
    public static CustomerDto ToCustomerDto(Customer c) => new(
        c.Id,
        c.Code,
        c.Name,
        c.Email,
        c.Phone,
        c.Address,
        c.IsActive);

    public static OrderLineDto ToOrderLineDto(OrderLine line) => new(
        line.Id,
        line.ProductId,
        line.ProductCode,
        line.ProductName,
        line.WarehouseId,
        line.Quantity,
        line.UnitPrice,
        line.LineAmount);

    public static OrderDto ToOrderDto(Order order, string customerName) => new(
        order.Id,
        order.OrderNo,
        order.CustomerId,
        customerName,
        order.OrderDate,
        order.Status.ToString(),
        order.SubTotal,
        order.TaxAmount,
        order.TotalAmount,
        order.Note,
        order.CreatedAt,
        order.ConfirmedAt,
        order.ShippedAt,
        order.Lines.Select(ToOrderLineDto).ToList(),
        order.PaymentStatus.ToString(),
        order.PaidAt,
        order.PaymentMethod,
        order.PaymentReference,
        order.ShippingFee);

    public static InvoiceDto ToInvoiceDto(Invoice invoice, string orderNo) => new(
        invoice.Id,
        invoice.InvoiceNo,
        orderNo,
        invoice.IssuedAt,
        invoice.DueDate,
        invoice.Amount,
        invoice.TaxAmount,
        invoice.Status,
        invoice.ShippingFee);

    public static InvoiceDetailDto ToInvoiceDetailDto(Invoice invoice) => new(
        invoice.Id,
        invoice.InvoiceNo,
        invoice.Order.OrderNo,
        invoice.OrderId,
        invoice.IssuedAt,
        invoice.DueDate,
        invoice.Order.OrderDate,
        invoice.Order.Customer?.Name ?? string.Empty,
        invoice.Order.Customer?.Address,
        invoice.Status,
        invoice.Order.SubTotal,
        invoice.Order.TaxAmount,
        invoice.Amount,
        invoice.Order.Lines.Select(ToOrderLineDto).ToList(),
        invoice.ShippingFee);

    public static List<StockItem> ToStockItems(Order order) =>
        order.Lines.Select(l => new StockItem(l.ProductId, l.WarehouseId, l.Quantity)).ToList();
}
