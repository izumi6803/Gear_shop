using StockFlow.Inventory.Contracts;
using Microsoft.AspNetCore.Diagnostics;

namespace StockFlow.Inventory.BuildingBlocks.Http;

/// <summary>
/// Map <see cref="DomainException"/> → JSON lỗi thống nhất { code, message }.
/// Nhờ vậy endpoint chỉ việc gọi domain, không phải try/catch lặp lại.
/// </summary>
public sealed class DomainExceptionHandler(ILogger<DomainExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not DomainException domainException)
        {
            return false;
        }

        logger.LogWarning(
            "Domain exception {Code} ({StatusCode}): {Message}",
            domainException.Code,
            domainException.StatusCode,
            domainException.Message);

        httpContext.Response.StatusCode = domainException.StatusCode;
        await httpContext.Response.WriteAsJsonAsync(
            new ApiError(domainException.Code, domainException.Message),
            cancellationToken);

        return true;
    }
}
