using StockFlow.Inventory.Catalog.Api.Domain;
using Xunit;

namespace StockFlow.Inventory.Tests.Catalog;

public class StockTests
{
    private static Stock NewStock(int onHand)
    {
        var stock = new Stock { ProductId = 10, WarehouseId = 1 };
        if (onHand > 0)
        {
            stock.Receive(onHand);
        }

        return stock;
    }

    [Fact]
    public void Receive_IncreasesOnHand_AndAvailable()
    {
        var stock = NewStock(0);

        stock.Receive(100);

        Assert.Equal(100, stock.QuantityOnHand);
        Assert.Equal(0, stock.QuantityReserved);
        Assert.Equal(100, stock.Available);
    }

    [Fact]
    public void Reserve_KeepsOnHand_ReducesAvailable()
    {
        var stock = NewStock(100);

        stock.Reserve(30);

        Assert.Equal(100, stock.QuantityOnHand);
        Assert.Equal(30, stock.QuantityReserved);
        Assert.Equal(70, stock.Available);
    }

    [Fact]
    public void Reserve_MoreThanAvailable_ThrowsWithAvailability()
    {
        var stock = NewStock(100);

        var ex = Assert.Throws<InsufficientStockException>(() => stock.Reserve(101));

        Assert.Equal(10, ex.ProductId);
        Assert.Equal(1, ex.WarehouseId);
        Assert.Equal(101, ex.Requested);
        Assert.Equal(100, ex.Available);
        Assert.Equal(100, stock.QuantityOnHand);
        Assert.Equal(0, stock.QuantityReserved);
    }

    [Fact]
    public void Reserve_MoreThanRemainingAvailable_Throws()
    {
        var stock = NewStock(100);
        stock.Reserve(80);

        Assert.Throws<InsufficientStockException>(() => stock.Reserve(30));
    }

    [Fact]
    public void Release_RestoresAvailable()
    {
        var stock = NewStock(100);
        stock.Reserve(40);

        stock.Release(40);

        Assert.Equal(0, stock.QuantityReserved);
        Assert.Equal(100, stock.Available);
    }

    [Fact]
    public void Release_MoreThanReserved_Throws()
    {
        var stock = NewStock(100);
        stock.Reserve(10);

        Assert.Throws<InvalidStockOperationException>(() => stock.Release(11));
    }

    [Fact]
    public void Issue_ReducesOnHandAndReserved()
    {
        var stock = NewStock(100);
        stock.Reserve(40);

        stock.Issue(40);

        Assert.Equal(60, stock.QuantityOnHand);
        Assert.Equal(0, stock.QuantityReserved);
        Assert.Equal(60, stock.Available);
    }

    [Fact]
    public void Issue_MoreThanOnHand_Throws()
    {
        var stock = NewStock(10);

        Assert.Throws<InvalidStockOperationException>(() => stock.Issue(11));
    }

    [Fact]
    public void Adjust_CanDecreaseButNotBelowReserved()
    {
        var stock = NewStock(100);
        stock.Reserve(60);

        stock.Adjust(-40);
        Assert.Equal(60, stock.QuantityOnHand);

        Assert.Throws<InvalidStockOperationException>(() => stock.Adjust(-1));
    }

    [Fact]
    public void Adjust_CannotGoNegative()
    {
        var stock = NewStock(5);

        Assert.Throws<InvalidStockOperationException>(() => stock.Adjust(-6));
        Assert.Equal(5, stock.QuantityOnHand);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Reserve_NonPositiveQuantity_Throws(int quantity)
    {
        var stock = NewStock(100);

        Assert.Throws<InvalidStockOperationException>(() => stock.Reserve(quantity));
    }
}
