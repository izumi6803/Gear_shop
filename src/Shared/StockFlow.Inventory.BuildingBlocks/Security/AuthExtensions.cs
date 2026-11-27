using System.Text;
using StockFlow.Inventory.Contracts.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace StockFlow.Inventory.BuildingBlocks.Security;

public static class AuthExtensions
{
    /// <summary>
    /// Đăng ký kiểm tra JWT dùng chung. Cả Catalog và Ordering đều validate cùng
    /// issuer/audience/key; chỉ Ordering phát hành token (xem JwtTokenService).
    /// </summary>
    public static IServiceCollection AddInventoryJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key));

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = signingKey,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30)
                };
            });

        services.AddAuthorization();
        return services;
    }
}
