using StockFlow.Inventory.Catalog.Api.Data;
using StockFlow.Inventory.Catalog.Api.Domain;
using StockFlow.Inventory.Catalog.Api.Services;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Contracts.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace StockFlow.Inventory.Catalog.Api.Endpoints;

public static class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder app)
    {
        var products = app.MapGroup("/api/products").WithTags("Products");

        products.MapGet("", async (
            CatalogDbContext db,
            string? keyword,
            int page = 1,
            int pageSize = 20,
            bool includeInactive = false,
            CancellationToken ct = default) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = db.Products.AsNoTracking();
            if (!includeInactive)
            {
                query = query.Where(p => p.IsActive);
            }

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var k = keyword.Trim();
                query = query.Where(p =>
                    p.Code.Contains(k) || p.Name.Contains(k));
            }

            var total = await query.CountAsync(ct);
            var entities = await query
                .OrderBy(p => p.Code)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);

            return Results.Ok(new PagedResult<ProductDto>(entities.Select(Mapping.ToProductDto).ToList(), page, pageSize, total));
        })
        .WithName("GetProducts")
        .Produces<PagedResult<ProductDto>>();

        products.MapGet("/{id:int}", async (int id, CatalogDbContext db, CancellationToken ct) =>
        {
            var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
            return product is null
                ? Results.NotFound(new ApiError("PRODUCT_NOT_FOUND", $"Không tìm thấy sản phẩm {id}."))
                : Results.Ok(Mapping.ToProductDto(product));
        })
        .WithName("GetProductById")
        .Produces<ProductDto>()
        .Produces<ApiError>(StatusCodes.Status404NotFound);

        products.MapPost("", CreateAsync)
            .RequireAuthorization(new AuthorizeAttribute { Roles = Roles.AdminOrSales })
            .WithName("CreateProduct")
            .Produces<ProductDto>(StatusCodes.Status201Created)
            .Produces<ApiError>(StatusCodes.Status409Conflict);

        products.MapPut("/{id:int}", UpdateAsync)
            .RequireAuthorization(new AuthorizeAttribute { Roles = Roles.AdminOrSales })
            .WithName("UpdateProduct")
            .Produces<ProductDto>()
            .Produces<ApiError>(StatusCodes.Status404NotFound);

        var warehouses = app.MapGroup("/api/warehouses").WithTags("Warehouses");

        warehouses.MapGet("", async (CatalogDbContext db, CancellationToken ct) =>
        {
            var list = await db.Warehouses.AsNoTracking().OrderBy(w => w.Code).ToListAsync(ct);
            return Results.Ok(list.Select(Mapping.ToWarehouseDto).ToList());
        })
        .WithName("GetWarehouses")
        .Produces<List<WarehouseDto>>();

        return app;
    }

    private static async Task<IResult> CreateAsync(ProductUpsertRequest request, CatalogDbContext db, CancellationToken ct)
    {
        var validation = Validate(request);
        if (validation is not null)
        {
            return validation;
        }

        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Products.AnyAsync(p => p.Code == code, ct))
        {
            return Results.Conflict(new ApiError("PRODUCT_CODE_DUPLICATED", $"Mã hàng '{code}' đã tồn tại."));
        }

        var product = new Product
        {
            Code = code,
            Name = request.Name.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? "General" : request.Category.Trim(),
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "pcs" : request.Unit.Trim(),
            UnitPrice = request.UnitPrice,
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
            IsActive = request.IsActive
        };

        db.Products.Add(product);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/products/{product.Id}", Mapping.ToProductDto(product));
    }

    private static async Task<IResult> UpdateAsync(int id, ProductUpsertRequest request, CatalogDbContext db, CancellationToken ct)
    {
        var validation = Validate(request);
        if (validation is not null)
        {
            return validation;
        }

        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return Results.NotFound(new ApiError("PRODUCT_NOT_FOUND", $"Không tìm thấy sản phẩm {id}."));
        }

        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Products.AnyAsync(p => p.Code == code && p.Id != id, ct))
        {
            return Results.Conflict(new ApiError("PRODUCT_CODE_DUPLICATED", $"Mã hàng '{code}' đã tồn tại."));
        }

        product.Code = code;
        product.Name = request.Name.Trim();
        product.Category = string.IsNullOrWhiteSpace(request.Category) ? product.Category : request.Category.Trim();
        product.Unit = string.IsNullOrWhiteSpace(request.Unit) ? product.Unit : request.Unit.Trim();
        product.UnitPrice = request.UnitPrice;
        product.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? product.ImageUrl : request.ImageUrl.Trim();
        product.IsActive = request.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return Results.Ok(Mapping.ToProductDto(product));
    }

    private static IResult? Validate(ProductUpsertRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Code))
        {
            errors["code"] = ["Mã hàng bắt buộc."];
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = ["Tên hàng bắt buộc."];
        }

        if (request.UnitPrice < 0)
        {
            errors["unitPrice"] = ["Đơn giá không được âm."];
        }

        return errors.Count == 0 ? null : Results.ValidationProblem(errors);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
