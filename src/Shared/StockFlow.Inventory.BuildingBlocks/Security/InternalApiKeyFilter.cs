using System.Security.Cryptography;
using System.Text;

namespace StockFlow.Inventory.BuildingBlocks.Security;

/// <summary>
/// Chặn các endpoint /internal/* (Ordering → Catalog). Dùng shared secret thay vì JWT
/// vì đây là giao tiếp service-to-service, không có người dùng cuối.
/// </summary>
public sealed class InternalApiKeyFilter(IConfiguration configuration) : IEndpointFilter
{
    public const string HeaderName = "X-Internal-Key";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var expected = configuration["Internal:ApiKey"];
        if (string.IsNullOrWhiteSpace(expected))
        {
            return Results.Problem("Internal API key chưa được cấu hình.", statusCode: StatusCodes.Status500InternalServerError);
        }

        var provided = context.HttpContext.Request.Headers[HeaderName].ToString();
        if (!FixedTimeEquals(provided, expected))
        {
            return Results.Problem("Internal API key không hợp lệ.", statusCode: StatusCodes.Status401Unauthorized);
        }

        return await next(context);
    }

    private static bool FixedTimeEquals(string provided, string expected)
    {
        var left = Encoding.UTF8.GetBytes(provided);
        var right = Encoding.UTF8.GetBytes(expected);
        return left.Length == right.Length && CryptographicOperations.FixedTimeEquals(left, right);
    }
}
