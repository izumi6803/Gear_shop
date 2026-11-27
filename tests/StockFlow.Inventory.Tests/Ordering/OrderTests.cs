using StockFlow.Inventory.Ordering.Api.Domain;
using Xunit;

namespace StockFlow.Inventory.Tests.Ordering;

public class OrderTests
{
    private static Order NewDraft(params (int ProductId, int WarehouseId, decimal Price, int Quantity)[] lines)
    {
        var order = Order.Create("SO-202611-0001", customerId: 1, new DateOnly(2026, 11, 25), null, "sales");

        foreach (var line in lines)
        {
            order.AddLine(
                line.ProductId,
                $"P-{line.ProductId:0000}",
                $"Product {line.ProductId}",
                line.WarehouseId,
                line.Price,
                line.Quantity);
        }

        return order;
    }

    [Fact]
    public void Create_WithValidData_StartsAsDraftWithZeroTotals()
    {
        var order = Order.Create("so-202611-0001", customerId: 3, new DateOnly(2026, 11, 25), "ghi chú", "sales");

        Assert.Equal(OrderStatus.Draft, order.Status);
        Assert.Equal("SO-202611-0001", order.OrderNo);
        Assert.Equal(0m, order.SubTotal);
        Assert.Equal(0m, order.TaxAmount);
        Assert.Equal(0m, order.TotalAmount);
        Assert.Null(order.ConfirmedAt);
    }

    [Fact]
    public void AddLine_ComputesTotalsWithTenPercentTax()
    {
        var order = NewDraft((1, 1, 1_200m, 2), (2, 1, 3_500m, 1));

        // 2 x 1.200 = 2.400 ; 1 x 3.500 = 3.500 → 5.900 ; thuế 10% = 590
        Assert.Equal(5_900m, order.SubTotal);
        Assert.Equal(590m, order.TaxAmount);
        Assert.Equal(6_490m, order.TotalAmount);
        Assert.Equal(2_400m, order.Lines.First().LineAmount);
    }

    [Fact]
    public void AddLine_SameProductAndWarehouse_MergesIntoOneLine()
    {
        var order = NewDraft((1, 1, 1_200m, 2));
        order.AddLine(1, "P-0001", "Product 1", 1, 1_200m, 3);

        var line = Assert.Single(order.Lines);
        Assert.Equal(5, line.Quantity);
        Assert.Equal(6_000m, line.LineAmount);
    }

    [Fact]
    public void AddLine_SameProductDifferentWarehouse_KeepsSeparateLines()
    {
        var order = NewDraft((1, 1, 1_200m, 2));
        order.AddLine(1, "P-0001", "Product 1", 2, 1_200m, 1);

        Assert.Equal(2, order.Lines.Count);
        Assert.Equal(2_400m + 1_200m, order.SubTotal);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void AddLine_WithNonPositiveQuantity_Throws(int quantity)
    {
        var order = Order.Create("SO-202611-0002", 1, new DateOnly(2026, 11, 25), null, "sales");

        Assert.Throws<OrderValidationException>(() =>
            order.AddLine(1, "P-0001", "Product 1", 1, 1_000m, quantity));
    }

    [Fact]
    public void Confirm_OnEmptyOrder_Throws()
    {
        var order = Order.Create("SO-202611-0003", 1, new DateOnly(2026, 11, 25), null, "sales");

        var ex = Assert.Throws<OrderStateException>(order.Confirm);
        Assert.Contains("ít nhất một dòng", ex.Message);
    }

    [Fact]
    public void Confirm_OnDraftOrder_SetsConfirmedState()
    {
        var order = NewDraft((1, 1, 1_000m, 1));

        order.Confirm();

        Assert.Equal(OrderStatus.Confirmed, order.Status);
        Assert.NotNull(order.ConfirmedAt);
        Assert.True(order.HoldsStock);
    }

    [Fact]
    public void Confirm_Twice_Throws()
    {
        var order = NewDraft((1, 1, 1_000m, 1));
        order.Confirm();

        Assert.Throws<OrderStateException>(order.Confirm);
    }

    [Fact]
    public void AddLine_AfterConfirm_Throws()
    {
        var order = NewDraft((1, 1, 1_000m, 1));
        order.Confirm();

        Assert.Throws<OrderStateException>(() =>
            order.AddLine(2, "P-0002", "Product 2", 1, 500m, 1));
    }

    [Fact]
    public void RemoveLine_RecalculatesTotals()
    {
        var order = NewDraft((1, 1, 1_000m, 1), (2, 1, 2_000m, 1));

        order.RemoveLine(1, 1);

        Assert.Single(order.Lines);
        Assert.Equal(2_000m, order.SubTotal);
        Assert.Equal(2_200m, order.TotalAmount);
    }

    [Fact]
    public void Cancel_DraftOrder_SetsCancelled()
    {
        var order = NewDraft((1, 1, 1_000m, 1));

        order.Cancel();

        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.False(order.HoldsStock);
    }

    [Fact]
    public void Cancel_ConfirmedOrder_SetsCancelledAndReleasesStockFlag()
    {
        var order = NewDraft((1, 1, 1_000m, 1));
        order.Confirm();

        order.Cancel();

        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.False(order.HoldsStock);
    }

    [Fact]
    public void Cancel_ShippedOrder_Throws()
    {
        var order = NewDraft((1, 1, 1_000m, 1));
        order.Confirm();
        order.MarkShipped();

        Assert.Throws<OrderStateException>(order.Cancel);
    }

    [Fact]
    public void MarkShipped_OnDraftOrder_Throws()
    {
        var order = NewDraft((1, 1, 1_000m, 1));

        Assert.Throws<OrderStateException>(order.MarkShipped);
    }

    [Fact]
    public void MarkShipped_OnConfirmedOrder_SetsShippedState()
    {
        var order = NewDraft((1, 1, 1_000m, 1));
        order.Confirm();

        order.MarkShipped();

        Assert.Equal(OrderStatus.Shipped, order.Status);
        Assert.NotNull(order.ShippedAt);
    }

    [Theory]
    [InlineData(1_234, 123)] // 123,4 → làm tròn xuống
    [InlineData(1_235, 124)] // 123,5 → làm tròn lên (away from zero)
    [InlineData(1_000, 100)]
    [InlineData(0, 0)]
    public void Tax_IsRoundedAwayFromZero(int subTotal, int expectedTax)
    {
        var order = NewDraft((1, 1, subTotal, 1));

        Assert.Equal(expectedTax, order.TaxAmount);
        Assert.Equal(subTotal + expectedTax, order.TotalAmount);
    }
}
