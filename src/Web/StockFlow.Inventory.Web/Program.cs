using StockFlow.Inventory.Contracts.Security;
using StockFlow.Inventory.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// 12-factor: log ra stdout (container/CI không có quyền ghi Windows Event Log).
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options => options.TimestampFormat = "HH:mm:ss ");

builder.Services.AddRazorPages();
builder.Services.AddHttpContextAccessor();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(builder.Configuration.GetValue("Session:IdleMinutes", 120));
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.Name = "stockflow.inventory.session";
});

builder.Services.AddHttpClient<CatalogApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:CatalogBaseUrl"] ?? "http://localhost:5080");
    client.Timeout = TimeSpan.FromSeconds(20);
});

builder.Services.AddHttpClient<OrderingApiClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Services:OrderingBaseUrl"] ?? "http://localhost:5081");
    client.Timeout = TimeSpan.FromSeconds(20);
});

builder.Services.AddScoped<UserSession>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.MapRazorPages();

app.Run();
