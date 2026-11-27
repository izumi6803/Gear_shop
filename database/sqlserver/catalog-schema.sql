CREATE TABLE [PRODUCT] (
    [Id] int NOT NULL IDENTITY,
    [Code] nvarchar(32) NOT NULL,
    [Name] nvarchar(200) NOT NULL,
    [NameJa] nvarchar(200) NULL,
    [Category] nvarchar(64) NOT NULL,
    [Unit] nvarchar(16) NOT NULL,
    [UnitPrice] decimal(18,2) NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_PRODUCT] PRIMARY KEY ([Id]),
    CONSTRAINT [CK_Product_UnitPrice] CHECK ([UnitPrice] >= 0)
);
GO


CREATE TABLE [WAREHOUSE] (
    [Id] int NOT NULL IDENTITY,
    [Code] nvarchar(16) NOT NULL,
    [Name] nvarchar(100) NOT NULL,
    [Location] nvarchar(200) NOT NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_WAREHOUSE] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [STOCK] (
    [Id] int NOT NULL IDENTITY,
    [ProductId] int NOT NULL,
    [WarehouseId] int NOT NULL,
    [QuantityOnHand] int NOT NULL,
    [QuantityReserved] int NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_STOCK] PRIMARY KEY ([Id]),
    CONSTRAINT [CK_Stock_QuantityOnHand] CHECK ([QuantityOnHand] >= 0),
    CONSTRAINT [CK_Stock_QuantityReserved] CHECK ([QuantityReserved] >= 0 AND [QuantityReserved] <= [QuantityOnHand]),
    CONSTRAINT [FK_STOCK_PRODUCT_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [PRODUCT] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_STOCK_WAREHOUSE_WarehouseId] FOREIGN KEY ([WarehouseId]) REFERENCES [WAREHOUSE] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [STOCK_MOVEMENT] (
    [Id] bigint NOT NULL IDENTITY,
    [ProductId] int NOT NULL,
    [WarehouseId] int NOT NULL,
    [MovementType] nvarchar(16) NOT NULL,
    [Quantity] int NOT NULL,
    [ReferenceType] nvarchar(32) NULL,
    [ReferenceNo] nvarchar(32) NULL,
    [OccurredAt] datetime2 NOT NULL,
    [Note] nvarchar(500) NULL,
    [CreatedBy] nvarchar(64) NULL,
    CONSTRAINT [PK_STOCK_MOVEMENT] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_STOCK_MOVEMENT_PRODUCT_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [PRODUCT] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_STOCK_MOVEMENT_WAREHOUSE_WarehouseId] FOREIGN KEY ([WarehouseId]) REFERENCES [WAREHOUSE] ([Id]) ON DELETE NO ACTION
);
GO


CREATE UNIQUE INDEX [UQ_Product_Code] ON [PRODUCT] ([Code]);
GO


CREATE INDEX [IX_STOCK_WarehouseId] ON [STOCK] ([WarehouseId]);
GO


CREATE UNIQUE INDEX [UQ_Stock_Product_Warehouse] ON [STOCK] ([ProductId], [WarehouseId]);
GO


CREATE INDEX [IX_Movement_Product_OccurredAt] ON [STOCK_MOVEMENT] ([ProductId], [OccurredAt] DESC);
GO


CREATE INDEX [IX_Movement_ReferenceNo] ON [STOCK_MOVEMENT] ([ReferenceNo]);
GO


CREATE INDEX [IX_STOCK_MOVEMENT_WarehouseId] ON [STOCK_MOVEMENT] ([WarehouseId]);
GO


CREATE UNIQUE INDEX [UQ_Warehouse_Code] ON [WAREHOUSE] ([Code]);
GO


