using StockFlow.Inventory.BuildingBlocks.Http;
using StockFlow.Inventory.BuildingBlocks.Security;
using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Ordering.Api.Data;
using StockFlow.Inventory.Ordering.Api.Endpoints;
using StockFlow.Inventory.Ordering.Api.Services;
using StockFlow.Inventory.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 12-factor: log ra stdout (container/CI không có quyền ghi Windows Event Log).
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options => options.TimestampFormat = "HH:mm:ss ");

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<CompanyOptions>(builder.Configuration.GetSection(CompanyOptions.SectionName));
builder.Services.AddInventoryJwtAuthentication(builder.Configuration);

// Token mang "ver": khi Admin đổi quyền hoặc khoá tài khoản, token cũ mất hiệu lực
// ngay thay vì còn dùng được tới khi hết hạn. Đây là chỗ duy nhất biết bảng APP_USER.
builder.Services
    .AddOptions<Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions>(
        Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .Configure<IServiceScopeFactory>((options, scopes) =>
    {
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var principal = context.Principal;
                var username = principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? principal?.FindFirst("sub")?.Value;

                if (string.IsNullOrWhiteSpace(username))
                {
                    context.Fail("Token thiếu định danh người dùng.");
                    return;
                }

                var versionClaim = principal?.FindFirst("ver")?.Value;
                var tokenVersion = int.TryParse(versionClaim, out var parsed) ? parsed : 0;

                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<OrderingDbContext>();
                var account = await db.Users
                    .AsNoTracking()
                    .Where(u => u.Username == username)
                    .Select(u => new { u.IsActive, u.TokenVersion })
                    .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

                if (account is null || !account.IsActive)
                {
                    context.Fail("Tài khoản đã bị khoá.");
                    return;
                }

                if (account.TokenVersion != tokenVersion)
                {
                    context.Fail("Phiên đã hết hiệu lực do quyền hoặc mật khẩu thay đổi.");
                }
            },
        };
    });
builder.Services.AddInventoryDatabase<OrderingDbContext>(builder.Configuration, "OrderingDb");
builder.Services.AddSpaCors(builder.Configuration);

builder.Services.AddHttpClient<CatalogClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:CatalogBaseUrl"] ?? "http://localhost:5080");
    client.Timeout = TimeSpan.FromSeconds(15);
});

builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<ShopService>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DomainExceptionHandler>();

var app = builder.Build();

if (app.Configuration.GetValue("Database:AutoCreate", false))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<OrderingDbContext>();
    await db.Database.EnsureCreatedAsync();
    await OrderingSeeder.SeedAsync(db, app.Configuration);
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseExceptionHandler();
app.UseCors(CorsSetup.PolicyName);
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", async (OrderingDbContext db, CancellationToken ct) =>
{
    var canConnect = await db.Database.CanConnectAsync(ct);
    return canConnect
        ? Results.Ok(new
        {
            status = "healthy",
            service = "ordering-api",
            provider = db.Database.ProviderName,
            utc = DateTime.UtcNow
        })
        : Results.Problem("Không kết nối được database.", statusCode: StatusCodes.Status503ServiceUnavailable);
})
.WithTags("Health");

app.MapAuthEndpoints();
app.MapCustomerEndpoints();
app.MapOrderEndpoints();
app.MapInvoiceEndpoints();
app.MapCompanyEndpoints();
app.MapShopEndpoints();
app.MapAccountEndpoints();

app.Run();
