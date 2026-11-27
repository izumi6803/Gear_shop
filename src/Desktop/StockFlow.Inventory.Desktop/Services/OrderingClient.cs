using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Contracts.Security;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace StockFlow.Inventory.Desktop.Services;

public sealed class ApiException(string message, int statusCode) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>
/// Client gọi Ordering API cho ứng dụng WinForms (back-office).
/// Token giữ trong bộ nhớ — desktop không dùng cookie/session.
/// </summary>
public sealed class OrderingClient : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _http;
    private string? _token;

    public OrderingClient(string baseUrl)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(baseUrl),
            Timeout = TimeSpan.FromSeconds(20)
        };
    }

    public string? DisplayName { get; private set; }

    public string? Role { get; private set; }

    public bool IsAuthenticated => !string.IsNullOrEmpty(_token);

    public void Dispose() => _http.Dispose();

    public async Task LoginAsync(string username, string password, CancellationToken ct = default)
    {
        using var response = await _http.PostAsJsonAsync("/api/auth/login", new LoginRequest(username, password), ct);
        var payload = await ReadAsync<LoginResponse>(response, ct)
            ?? throw new ApiException("API không trả về token.", 500);

        _token = payload.AccessToken;
        DisplayName = payload.DisplayName;
        Role = payload.Role;
    }

    public async Task<List<OrderDto>> GetOrdersAsync(string? status = null, CancellationToken ct = default)
    {
        var url = "/api/orders?page=1&pageSize=200";
        if (!string.IsNullOrWhiteSpace(status))
        {
            url += "&status=" + Uri.EscapeDataString(status);
        }

        var response = await SendAsync(HttpMethod.Get, url, null, ct);
        var page = await ReadAsync<Contracts.PagedResult<OrderDto>>(response, ct);
        return page?.Items.ToList() ?? new List<OrderDto>();
    }

    public Task<OrderDto?> ConfirmAsync(int orderId, CancellationToken ct = default) =>
        PostAsync<OrderDto>($"/api/orders/{orderId}/confirm", ct);

    public Task<OrderDto?> CancelAsync(int orderId, CancellationToken ct = default) =>
        PostAsync<OrderDto>($"/api/orders/{orderId}/cancel", ct);

    public async Task<ShipResult?> ShipAsync(int orderId, CancellationToken ct = default)
    {
        using var response = await SendAsync(HttpMethod.Post, $"/api/orders/{orderId}/ship", null, ct);
        return await ReadAsync<ShipResult>(response, ct);
    }

    private async Task<T?> PostAsync<T>(string url, CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Post, url, null, ct);
        return await ReadAsync<T>(response, ct);
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method,
        string url,
        HttpContent? content,
        CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, url) { Content = content };
        if (!string.IsNullOrEmpty(_token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        }

        try
        {
            return await _http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new ApiException($"Không kết nối được API. {ex.Message}", 502);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new ApiException("API không phản hồi (timeout).", 504);
        }
    }

    private static async Task<T?> ReadAsync<T>(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode)
        {
            if (response.StatusCode == HttpStatusCode.NoContent)
            {
                return default;
            }

            return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
        }

        var status = (int)response.StatusCode;
        var message = response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => "Sai tài khoản hoặc phiên đăng nhập đã hết hạn.",
            HttpStatusCode.Forbidden => "Bạn không có quyền thực hiện thao tác này.",
            _ => await ExtractMessageAsync(response, ct)
        };

        response.Dispose();
        throw new ApiException(message, status);
    }

    private static async Task<string> ExtractMessageAsync(HttpResponseMessage response, CancellationToken ct)
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
