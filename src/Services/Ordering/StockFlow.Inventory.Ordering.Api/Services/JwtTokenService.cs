using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using StockFlow.Inventory.Contracts.Security;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace StockFlow.Inventory.Ordering.Api.Services;

/// <summary>Phát hành JWT cho Web / Desktop. Catalog chỉ validate, không phát hành.</summary>
public sealed class JwtTokenService(IOptions<JwtOptions> options)
{
    public (string Token, DateTimeOffset ExpiresAt) Create(
        string username,
        string displayName,
        string role,
        int tokenVersion = 0)
    {
        var jwt = options.Value;
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(jwt.ExpiresMinutes);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(ClaimTypes.Name, displayName),
            new Claim(ClaimTypes.Role, role),
            // Token version: đổi quyền/khoá tài khoản là token cũ mất hiệu lực.
            new Claim("ver", tokenVersion.ToString(CultureInfo.InvariantCulture)),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key));
        var token = new JwtSecurityToken(
            issuer: jwt.Issuer,
            audience: jwt.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt.UtcDateTime,
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
