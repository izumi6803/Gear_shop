using System.Net;
using System.Net.Http.Json;
using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Ordering.Api.Domain;

namespace StockFlow.Inventory.Ordering.Api.Services;

/// <summary>
/// Client gọi Catalog API (giao tiếp service-to-service). Dùng typed HttpClient:
/// base address + timeout cấu hình ở Program, header X-Internal-Key gắn ở đây.
/// </summary>
public sealed class CatalogClient(HttpClient http, IConfiguration configuration, ILogger<CatalogClient> logger)
{
    private const string InternalKeyHeader = "X-Internal-Key";

    public async Task<ProductLookupResponse> LookupProductsAsync(
        IReadOnlyCollection<int> productIds,
        CancellationToken ct = default)
    {
        using var response = await SendAsync(
            HttpMethod.Post,
            "/internal/products/lookup",
            JsonContent.Create(new ProductLookupRequest(productIds.ToList())),
            ct);

        var payload = await response.Content.ReadFromJsonAsync<ProductLookupResponse>(cancellationToken: ct);
        return payload ?? new ProductLookupResponse(Array.Empty<ProductLookupItem>(), productIds.ToList());
    }

    public async Task<StockReserveResult> ReserveAsync(StockReserveRequest request, CancellationToken ct = default)
    {
        using var response = await SendRawAsync(
            HttpMethod.Post,
            "/internal/stocks/reserve",
            JsonContent.Create(request),
            ct);

        if (response.StatusCode == HttpStatusCode.Conflict)
        {
            var conflict = await response.Content.ReadFromJsonAsync<StockReserveResult>(cancellationToken: ct);
            return conflict ?? StockReserveResult.Failed(Array.Empty<StockShortage>());
        }

        await EnsureSuccessAsync(response, "/internal/stocks/reserve", ct);
        return StockReserveResult.Ok();
    }

    public async Task ReleaseAsync(StockReserveRequest request, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Post, "/internal/stocks/release", JsonContent.Create(request), ct);
        await EnsureSuccessAsync(response, "/internal/stocks/release", ct);
    }

    public async Task IssueAsync(StockReserveRequest request, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Post, "/internal/stocks/issue", JsonContent.Create(request), ct);
        await EnsureSuccessAsync(response, "/internal/stocks/issue", ct);
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method,
        string path,
        HttpContent content,
        CancellationToken ct)
    {
        var response = await SendRawAsync(method, path, content, ct);
        await EnsureSuccessAsync(response, path, ct);
        return response;
    }

    private async Task<HttpResponseMessage> SendRawAsync(
        HttpMethod method,
        string path,
        HttpContent content,
        CancellationToken ct)
    {
        using var message = new HttpRequestMessage(method, path) { Content = content };
        var apiKey = configuration["Internal:ApiKey"];
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            message.Headers.TryAddWithoutValidation(InternalKeyHeader, apiKey);
        }

        try
        {
            return await http.SendAsync(message, ct);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Không gọi được Catalog API: {Path}", path);
            throw new CatalogUnavailableException("Không kết nối được Catalog API.");
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Catalog API timeout: {Path}", path);
            throw new CatalogUnavailableException("Catalog API không phản hồi (timeout).");
        }
    }

    private async Task EnsureSuccessAsync(HttpResponseMessage response, string path, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        logger.LogWarning(
            "Catalog API {Path} trả về {StatusCode}: {Body}",
            path,
            (int)response.StatusCode,
            body);

        throw new CatalogUnavailableException($"Catalog API trả về {(int)response.StatusCode}.");
    }
}
