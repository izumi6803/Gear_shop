CREATE TABLE [APP_USER] (
    [Id] int NOT NULL IDENTITY,
    [Username] nvarchar(64) NOT NULL,
    [PasswordHash] nvarchar(256) NOT NULL,
    [DisplayName] nvarchar(100) NOT NULL,
    [Role] nvarchar(16) NOT NULL,
    [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_APP_USER] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [CUSTOMER] (
    [Id] int NOT NULL IDENTITY,
    [Code] nvarchar(16) NOT NULL,
    [Name] nvarchar(200) NOT NULL,
    [NameKana] nvarchar(200) NULL,
    [Email] nvarchar(256) NULL,
    [Phone] nvarchar(32) NULL,
    [Address] nvarchar(300) NULL,
    [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_CUSTOMER] PRIMARY KEY ([Id])
);
GO


CREATE TABLE [ORDER] (
    [Id] int NOT NULL IDENTITY,
    [OrderNo] nvarchar(32) NOT NULL,
    [CustomerId] int NOT NULL,
    [OrderDate] date NOT NULL,
    [Status] nvarchar(16) NOT NULL,
    [SubTotal] decimal(18,2) NOT NULL,
    [TaxAmount] decimal(18,2) NOT NULL,
    [TotalAmount] decimal(18,2) NOT NULL,
    [Note] nvarchar(500) NULL,
    [CreatedAt] datetime2 NOT NULL,
    [ConfirmedAt] datetime2 NULL,
    [ShippedAt] datetime2 NULL,
    [CreatedBy] nvarchar(64) NOT NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_ORDER] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ORDER_CUSTOMER_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [CUSTOMER] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [INVOICE] (
    [Id] int NOT NULL IDENTITY,
    [InvoiceNo] nvarchar(32) NOT NULL,
    [OrderId] int NOT NULL,
    [IssuedAt] datetime2 NOT NULL,
    [DueDate] date NOT NULL,
    [Amount] decimal(18,2) NOT NULL,
    [TaxAmount] decimal(18,2) NOT NULL,
    [Status] nvarchar(16) NOT NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_INVOICE] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_INVOICE_ORDER_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [ORDER] ([Id]) ON DELETE NO ACTION
);
GO


CREATE TABLE [ORDER_LINE] (
    [Id] int NOT NULL IDENTITY,
    [OrderId] int NOT NULL,
    [ProductId] int NOT NULL,
    [ProductCode] nvarchar(32) NOT NULL,
    [ProductName] nvarchar(200) NOT NULL,
    [WarehouseId] int NOT NULL,
    [UnitPrice] decimal(18,2) NOT NULL,
    [Quantity] int NOT NULL,
    [LineAmount] decimal(18,2) NOT NULL,
    [RowVersion] rowversion NOT NULL,
    CONSTRAINT [PK_ORDER_LINE] PRIMARY KEY ([Id]),
    CONSTRAINT [CK_OrderLine_Quantity] CHECK ([Quantity] > 0),
    CONSTRAINT [FK_ORDER_LINE_ORDER_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [ORDER] ([Id]) ON DELETE CASCADE
);
GO


CREATE UNIQUE INDEX [UQ_AppUser_Username] ON [APP_USER] ([Username]);
GO


CREATE UNIQUE INDEX [UQ_Customer_Code] ON [CUSTOMER] ([Code]);
GO


CREATE UNIQUE INDEX [UQ_Invoice_InvoiceNo] ON [INVOICE] ([InvoiceNo]);
GO


CREATE UNIQUE INDEX [UQ_Invoice_OrderId] ON [INVOICE] ([OrderId]);
GO


CREATE INDEX [IX_Order_Customer_CreatedAt] ON [ORDER] ([CustomerId], [CreatedAt]);
GO


CREATE INDEX [IX_Order_Status_OrderDate] ON [ORDER] ([Status], [OrderDate]);
GO


CREATE UNIQUE INDEX [UQ_Order_OrderNo] ON [ORDER] ([OrderNo]);
GO


CREATE INDEX [IX_OrderLine_OrderId] ON [ORDER_LINE] ([OrderId]);
GO


CREATE INDEX [IX_OrderLine_ProductId] ON [ORDER_LINE] ([ProductId]);
GO


