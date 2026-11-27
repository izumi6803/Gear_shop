FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Directory.Build.props global.json ./
COPY src/Shared/StockFlow.Inventory.Contracts/StockFlow.Inventory.Contracts.csproj src/Shared/StockFlow.Inventory.Contracts/
COPY src/Shared/StockFlow.Inventory.BuildingBlocks/StockFlow.Inventory.BuildingBlocks.csproj src/Shared/StockFlow.Inventory.BuildingBlocks/
COPY src/Services/Ordering/StockFlow.Inventory.Ordering.Api/StockFlow.Inventory.Ordering.Api.csproj src/Services/Ordering/StockFlow.Inventory.Ordering.Api/
RUN dotnet restore src/Services/Ordering/StockFlow.Inventory.Ordering.Api/StockFlow.Inventory.Ordering.Api.csproj

COPY src/ src/
RUN dotnet publish src/Services/Ordering/StockFlow.Inventory.Ordering.Api/StockFlow.Inventory.Ordering.Api.csproj \
    -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_NOLOGO=1
EXPOSE 8080
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "StockFlow.Inventory.Ordering.Api.dll"]
