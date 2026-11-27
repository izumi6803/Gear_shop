using Microsoft.AspNetCore.Authorization;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Ordering.Api.Services;

namespace StockFlow.Inventory.Ordering.Api.Endpoints;

/// <summary>Quản trị tài khoản + số liệu trạng thái — chỉ Admin.</summary>
public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/accounts").WithTags("Accounts").RequireAuthorization(new AuthorizeAttribute { Roles = Roles.Admin });

        group.MapGet("", async (AccountService accounts, CancellationToken ct) =>
            Results.Ok(await accounts.ListAsync(ct)))
        .WithName("GetAccounts")
        .Produces<List<AccountDto>>();

        group.MapPost("", async (CreateAccountRequest request, AccountService accounts, CancellationToken ct) =>
        {
            var created = await accounts.CreateAsync(request, ct);
            return Results.Created($"/api/accounts/{created.Id}", created);
        })
        .WithName("CreateAccount")
        .Produces<AccountDto>(StatusCodes.Status201Created)
        .Produces<ApiError>(StatusCodes.Status400BadRequest);

        group.MapPatch("/{id:int}", async (
            int id,
            UpdateAccountRequest request,
            AccountService accounts,
            CancellationToken ct) => Results.Ok(await accounts.UpdateAsync(id, request, ct)))
        .WithName("UpdateAccount")
        .Produces<AccountDto>()
        .Produces<ApiError>(StatusCodes.Status400BadRequest);

        group.MapGet("/stats", async (AccountService accounts, CancellationToken ct) =>
            Results.Ok(await accounts.StatsAsync(ct)))
        .WithName("GetShopStats")
        .Produces<ShopStatsDto>();

        return app;
    }
}
