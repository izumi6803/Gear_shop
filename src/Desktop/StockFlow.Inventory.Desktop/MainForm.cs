using System.Globalization;
using StockFlow.Inventory.Contracts.Ordering;
using StockFlow.Inventory.Desktop.Services;

namespace StockFlow.Inventory.Desktop;

/// <summary>
/// Ứng dụng back-office WinForms: đăng nhập, xem danh sách đơn, xác nhận / xuất kho / huỷ.
/// Toàn bộ nghiệp vụ nằm ở Ordering API — desktop chỉ là client (không truy cập DB trực tiếp).
/// </summary>
public sealed class MainForm : Form
{
    private readonly string _baseUrl =
        Environment.GetEnvironmentVariable("STOCKFLOW_ORDERING_URL") ?? "http://localhost:5081";

    private readonly OrderingClient _client;
    private readonly List<OrderDto> _orders = new();

    private readonly TextBox _username = new() { Text = "sales", Width = 140 };
    private readonly TextBox _password = new() { Text = "Sales@123", Width = 140, UseSystemPasswordChar = true };
    private readonly Button _loginButton = new() { Text = "Đăng nhập", AutoSize = true };
    private readonly ComboBox _statusFilter = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 130 };
    private readonly Button _refreshButton = new() { Text = "Tải lại", AutoSize = true, Enabled = false };
    private readonly Button _confirmButton = new() { Text = "Xác nhận", AutoSize = true, Enabled = false };
    private readonly Button _shipButton = new() { Text = "Xuất kho", AutoSize = true, Enabled = false };
    private readonly Button _cancelButton = new() { Text = "Huỷ đơn", AutoSize = true, Enabled = false };
    private readonly DataGridView _grid = new();
    private readonly ToolStripStatusLabel _statusLabel = new() { Text = "Chưa đăng nhập." };

    public MainForm()
    {
        _client = new OrderingClient(_baseUrl);

        Text = "StockFlow Inventory — Back-office (WinForms)";
        StartPosition = FormStartPosition.CenterScreen;
        Width = 1180;
        Height = 640;
        MinimumSize = new Size(900, 480);
        Font = new Font("Segoe UI", 9F);

        BuildLayout();
        WireEvents();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _client.Dispose();
        }

        base.Dispose(disposing);
    }

    private void BuildLayout()
    {
        var loginPanel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            Padding = new Padding(12, 12, 12, 8),
            WrapContents = false
        };

        loginPanel.Controls.Add(new Label { Text = "Tài khoản:", AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 8, 6, 0) });
        loginPanel.Controls.Add(_username);
        loginPanel.Controls.Add(new Label { Text = "Mật khẩu:", AutoSize = true, Margin = new Padding(12, 8, 6, 0) });
        loginPanel.Controls.Add(_password);
        loginPanel.Controls.Add(_loginButton);
        loginPanel.Controls.Add(new Label
        {
            Text = $"API: {_baseUrl}",
            AutoSize = true,
            ForeColor = Color.DimGray,
            Margin = new Padding(16, 8, 0, 0)
        });

        _statusFilter.Items.AddRange(new object[] { "(tất cả)", "Draft", "Confirmed", "Shipped", "Cancelled" });
        _statusFilter.SelectedIndex = 0;

        var toolPanel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            Padding = new Padding(12, 0, 12, 8),
            WrapContents = false
        };

        toolPanel.Controls.Add(new Label { Text = "Trạng thái:", AutoSize = true, Margin = new Padding(0, 8, 6, 0) });
        toolPanel.Controls.Add(_statusFilter);
        toolPanel.Controls.Add(_refreshButton);
        toolPanel.Controls.Add(_confirmButton);
        toolPanel.Controls.Add(_shipButton);
        toolPanel.Controls.Add(_cancelButton);

        ConfigureGrid();

        var statusStrip = new StatusStrip();
        statusStrip.Items.Add(_statusLabel);

        Controls.Add(_grid);
        Controls.Add(toolPanel);
        Controls.Add(loginPanel);
        Controls.Add(statusStrip);
    }

    private void ConfigureGrid()
    {
        _grid.Dock = DockStyle.Fill;
        _grid.ReadOnly = true;
        _grid.AllowUserToAddRows = false;
        _grid.AllowUserToDeleteRows = false;
        _grid.MultiSelect = false;
        _grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        _grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
        _grid.RowHeadersVisible = false;
        _grid.BackgroundColor = Color.White;
        _grid.BorderStyle = BorderStyle.None;
        _grid.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        _grid.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(15, 31, 61);
        _grid.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
        _grid.EnableHeadersVisualStyles = false;

        _grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "OrderNo", HeaderText = "Số đơn", FillWeight = 14 });
        _grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Customer", HeaderText = "Khách hàng", FillWeight = 30 });
        _grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "OrderDate", HeaderText = "Ngày", FillWeight = 12 });
        _grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Status", HeaderText = "Trạng thái", FillWeight = 12 });
        _grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Lines", HeaderText = "Dòng", FillWeight = 7 });
        _grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Total", HeaderText = "Tổng (¥)", FillWeight = 15, DefaultCellStyle = new DataGridViewCellStyle { Alignment = DataGridViewContentAlignment.MiddleRight } });
    }

    private void WireEvents()
    {
        _loginButton.Click += async (_, _) => await LoginAsync();
        _refreshButton.Click += async (_, _) => await LoadOrdersAsync();
        _confirmButton.Click += async (_, _) => await ExecuteAsync(OrderAction.Confirm);
        _shipButton.Click += async (_, _) => await ExecuteAsync(OrderAction.Ship);
        _cancelButton.Click += async (_, _) => await ExecuteAsync(OrderAction.Cancel);
        _statusFilter.SelectedIndexChanged += async (_, _) =>
        {
            if (_client.IsAuthenticated)
            {
                await LoadOrdersAsync();
            }
        };
        _grid.SelectionChanged += (_, _) => UpdateActionButtons();
        _grid.CellDoubleClick += async (_, _) => await ShowDetailAsync();
    }

    private OrderDto? SelectedOrder =>
        _grid.CurrentRow?.Tag as OrderDto;

    private async Task LoginAsync()
    {
        SetBusy(true);
        try
        {
            await _client.LoginAsync(_username.Text.Trim(), _password.Text);
            _statusLabel.Text = $"Xin chào {_client.DisplayName} ({_client.Role}).";
            _refreshButton.Enabled = true;
            await LoadOrdersAsync();
        }
        catch (ApiException ex)
        {
            MessageBox.Show(this, ex.Message, "Đăng nhập thất bại", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            _statusLabel.Text = ex.Message;
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async Task LoadOrdersAsync()
    {
        var status = _statusFilter.SelectedIndex <= 0 ? null : _statusFilter.SelectedItem?.ToString();
        SetBusy(true);
        try
        {
            var orders = await _client.GetOrdersAsync(status);
            _orders.Clear();
            _orders.AddRange(orders);
            RenderGrid();
            _statusLabel.Text = $"Đã tải {_orders.Count} đơn hàng.";
        }
        catch (ApiException ex)
        {
            _statusLabel.Text = ex.Message;
        }
        finally
        {
            SetBusy(false);
        }
    }

    private void RenderGrid()
    {
        _grid.Rows.Clear();
        foreach (var order in _orders)
        {
            var index = _grid.Rows.Add(
                order.OrderNo,
                order.CustomerName,
                order.OrderDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                order.Status,
                order.Lines.Count,
                order.TotalAmount.ToString("N0", CultureInfo.CurrentCulture));

            _grid.Rows[index].Tag = order;
        }

        UpdateActionButtons();
    }

    private void UpdateActionButtons()
    {
        var order = SelectedOrder;
        _confirmButton.Enabled = order?.Status == "Draft";
        _shipButton.Enabled = order?.Status == "Confirmed";
        _cancelButton.Enabled = order is { Status: "Draft" or "Confirmed" };
    }

    private enum OrderAction
    {
        Confirm,
        Ship,
        Cancel
    }

    private async Task ExecuteAsync(OrderAction action)
    {
        var order = SelectedOrder;
        if (order is null)
        {
            return;
        }

        SetBusy(true);
        try
        {
            var message = action switch
            {
                OrderAction.Confirm => (await _client.ConfirmAsync(order.Id)) is { } updated
                    ? $"Đơn {updated.OrderNo} → {updated.Status}"
                    : "Đã xác nhận.",
                OrderAction.Ship => (await _client.ShipAsync(order.Id)) is { } shipped
                    ? $"Đơn {shipped.Order.OrderNo} → {shipped.Order.Status}, hoá đơn {shipped.Invoice.InvoiceNo}"
                    : "Đã xuất kho.",
                _ => (await _client.CancelAsync(order.Id)) is { } cancelled
                    ? $"Đơn {cancelled.OrderNo} → {cancelled.Status}"
                    : "Đã huỷ đơn."
            };

            _statusLabel.Text = message;
            await LoadOrdersAsync();
        }
        catch (ApiException ex)
        {
            _statusLabel.Text = ex.Message;
            MessageBox.Show(this, ex.Message, "Không thực hiện được", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        finally
        {
            SetBusy(false);
        }
    }

    private Task ShowDetailAsync()
    {
        var order = SelectedOrder;
        if (order is null)
        {
            return Task.CompletedTask;
        }

        var lines = string.Join(
            Environment.NewLine,
            order.Lines.Select(l => $"  • {l.ProductCode} {l.ProductName} × {l.Quantity} = {l.LineAmount:N0} ¥"));

        var message =
            $"Số đơn: {order.OrderNo}{Environment.NewLine}" +
            $"Khách hàng: {order.CustomerName}{Environment.NewLine}" +
            $"Ngày: {order.OrderDate:yyyy-MM-dd} — Trạng thái: {order.Status}{Environment.NewLine}" +
            $"Tạm tính: {order.SubTotal:N0} ¥ — Thuế: {order.TaxAmount:N0} ¥ — Tổng: {order.TotalAmount:N0} ¥{Environment.NewLine}{Environment.NewLine}" +
            $"Chi tiết:{Environment.NewLine}{lines}";

        MessageBox.Show(this, message, "Chi tiết đơn hàng", MessageBoxButtons.OK, MessageBoxIcon.Information);
        return Task.CompletedTask;
    }

    private void SetBusy(bool busy)
    {        _loginButton.Enabled = !busy;
        _refreshButton.Enabled = !busy && _client.IsAuthenticated;
        _grid.Enabled = !busy;

        if (busy)
        {
            _confirmButton.Enabled = false;
            _shipButton.Enabled = false;
            _cancelButton.Enabled = false;
        }
        else
        {
            UpdateActionButtons();
        }

        Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
    }
}
