using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using StockFlow.Inventory.Contracts;
using StockFlow.Inventory.Contracts.Catalog;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Contracts.Security;

namespace StockFlow.Inventory.Web.Services;

public sealed class ApiException(string message, int statusCode) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>
/// Base cho các client gọi API: gắn Bearer token, dịch lỗi sang <see cref="ApiException"/>
/// với message tiếng Việt lấy từ ApiError của backend.
/// </summary>
public abstract class ApiClientBase(HttpClient http, UserSession session)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected async Task<T?> GetAsync<T>(string url, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        using var response = await SendAsync(request, ct);
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
    }

    protected async Task<TResponse?> PostAsync<TRequest, TResponse>(
        string url,
        TRequest body,
        CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };

        using var response = await SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NoContent)
        {
            return default;
        }

        return await response.Content.ReadFromJsonAsync<TResponse>(JsonOptions, ct);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(session.Token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.Token);
        }

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new ApiException($"Không kết nối được API ({http.BaseAddress}). {ex.Message}", 502);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new ApiException("API không phản hồi (timeout).", 504);
        }

        if (response.IsSuccessStatusCode)
        {
            return response;
        }

        var status = (int)response.StatusCode;
        var message = response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
            HttpStatusCode.Forbidden => "Bạn không có quyền thực hiện thao tác này.",
            _ => await ReadErrorMessageAsync(response, ct)
        };

        response.Dispose();
        throw new ApiException(message, status);
    }

    private static async Task<string> ReadErrorMessageAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(raw))
            {
                return $"API trả về {(int)response.StatusCode}.";
            }

            using var document = JsonDocument.Parse(raw);
            foreach (var property in new[] { "message", "detail", "title" })
            {
                if (document.RootElement.TryGetProperty(property, out var value) &&
                    value.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrWhiteSpace(value.GetString()))
                {
                    return value.GetString()!;
                }
            }

            return $"API trả về {(int)response.StatusCode}.";
        }
        catch (JsonException)
        {
            return $"API trả về {(int)response.StatusCode}.";
        }
    }
}

public sealed class CatalogApiClient(HttpClient http, UserSession session) : ApiClientBase(http, session)
{
    public Task<PagedResult<ProductDto>?> GetProductsAsync(string? keyword, int page = 1, int pageSize = 50,
        CancellationToken ct = default) =>
        GetAsync<PagedResult<ProductDto>>(
            $"/api/products?page={page}&pageSize={pageSize}&keyword={Uri.EscapeDataString(keyword ?? string.Empty)}", ct);

    public Task<PagedResult<StockDto>?> GetStocksAsync(int? warehouseId = null, string? keyword = null,
        CancellationToken ct = default) =>
        GetAsync<PagedResult<StockDto>>(
            $"/api/stocks?warehouseId={warehouseId}&keyword={Uri.EscapeDataString(keyword ?? string.Empty)}&pageSize=200", ct);

    public Task<List<WarehouseDto>?> GetWarehousesAsync(CancellationToken ct = default) =>
        GetAsync<List<WarehouseDto>>("/api/warehouses", ct);

    public Task<ProductDto?> CreateProductAsync(ProductUpsertRequest request, CancellationToken ct = default) =>
        PostAsync<ProductUpsertRequest, ProductDto>("/api/products", request, ct);
}

public sealed class OrderingApiClient(HttpClient http, UserSession session) : ApiClientBase(http, session)
{
    public Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct = default) =>
        PostAsync<LoginRequest, LoginResponse>("/api/auth/login", request, ct);

    public Task<List<CustomerDto>?> GetCustomersAsync(CancellationToken ct = default) =>
        GetAsync<List<CustomerDto>>("/api/customers", ct);

    public Task<PagedResult<OrderDto>?> GetOrdersAsync(string? status, int page = 1, int pageSize = 50,
        CancellationToken ct = default) =>
        GetAsync<PagedResult<OrderDto>>(
            $"/api/orders?status={status}&page={page}&pageSize={pageSize}", ct);

    public Task<OrderDto?> GetOrderAsync(int id, CancellationToken ct = default) =>
        GetAsync<OrderDto>($"/api/orders/{id}", ct);

    public Task<OrderDto?> CreateOrderAsync(CreateOrderRequest request, CancellationToken ct = default) =>
        PostAsync<CreateOrderRequest, OrderDto>("/api/orders", request, ct);

    public Task<OrderDto?> ConfirmAsync(int id, CancellationToken ct = default) =>
        PostAsync<object, OrderDto>($"/api/orders/{id}/confirm", new { }, ct);

    public Task<OrderDto?> CancelAsync(int id, CancellationToken ct = default) =>
        PostAsync<object, OrderDto>($"/api/orders/{id}/cancel", new { }, ct);

    public Task<ShipResult?> ShipAsync(int id, CancellationToken ct = default) =>
        PostAsync<object, ShipResult>($"/api/orders/{id}/ship", new { }, ct);

    public Task<List<InvoiceDto>?> GetInvoicesAsync(CancellationToken ct = default) =>
        GetAsync<List<InvoiceDto>>("/api/invoices", ct);
}
