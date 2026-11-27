using StockFlow.Inventory.Contracts.Ordering;
using Microsoft.Extensions.Options;

namespace StockFlow.Inventory.Ordering.Api.Endpoints;

/// <summary>Seller profile used on invoices — read from configuration, never hard-coded.</summary>
public sealed class CompanyOptions
{
    public const string SectionName = "Company";

    public string Name { get; set; } = "StockFlow Pte. Ltd.";
    public string AddressLine { get; set; } = "1 Raffles Place, #20-01";
    public string City { get; set; } = "Singapore";
    public string PostalCode { get; set; } = "048616";
    public string Country { get; set; } = "Singapore";
    public string Email { get; set; } = "billing@stockflow.example";
    public string Phone { get; set; } = "+65 6123 4567";
    public string TaxId { get; set; } = "GST-201912345A";
    public string BankAccount { get; set; } = "DBS Bank · 0123-456789-0 · SWIFT DBSSSGSG";
    public string PaymentTerms { get; set; } = "Net 30 days from invoice date";
    public string Currency { get; set; } = "USD";
}

public static class CompanyEndpoints
{
    public static IEndpointRouteBuilder MapCompanyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/company").WithTags("Company").RequireAuthorization();

        group.MapGet("", (IOptions<CompanyOptions> options) =>
        {
            var company = options.Value;
            return Results.Ok(new CompanyProfileDto(
                company.Name,
                company.AddressLine,
                company.City,
                company.PostalCode,
                company.Country,
                company.Email,
                company.Phone,
                company.TaxId,
                company.BankAccount,
                company.PaymentTerms,
                company.Currency));
        })
        .WithName("GetCompanyProfile")
        .Produces<CompanyProfileDto>();

        return app;
    }
}
