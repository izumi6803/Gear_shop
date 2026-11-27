// Màn hình tạo đơn: thêm/xoá dòng hàng + tính tạm tính, thuế 10%, tổng (jQuery)
(function ($) {
    'use strict';

    var TAX_RATE = 0.1;

    function formatYen(value) {
        return value.toLocaleString('vi-VN') + ' ¥';
    }

    function recalc() {
        var subTotal = 0;

        $('#lines-body .line-row').each(function () {
            var $row = $(this);
            var price = parseFloat($row.find('.product-select option:selected').data('price') || 0);
            var quantity = parseInt($row.find('.qty-input').val() || '0', 10);
            var amount = price * (isNaN(quantity) ? 0 : quantity);

            $row.find('.line-amount').text(formatYen(amount));
            subTotal += amount;
        });

        var tax = Math.round(subTotal * TAX_RATE);
        $('#order-total').text(formatYen(subTotal) + ' / ' + formatYen(tax) + ' / ' + formatYen(subTotal + tax));
    }

    // Đánh lại index cho name="Lines[i].X" sau khi thêm/xoá dòng
    function reindex() {
        $('#lines-body .line-row').each(function (position) {
            $(this).find('select, input').each(function () {
                this.name = this.name.replace(/Lines\[\d+\]/, 'Lines[' + position + ']');
            });
        });
    }

    $('#add-line').on('click', function () {
        var $row = $('#lines-body .line-row').first().clone();
        $row.find('.product-select').val('0');
        $row.find('.qty-input').val(1);
        $row.find('.line-amount').text(formatYen(0));
        $('#lines-body').append($row);
        reindex();
        recalc();
    });

    $('#lines-body').on('click', '.remove-line', function () {
        if ($('#lines-body .line-row').length <= 1) {
            return;
        }

        $(this).closest('.line-row').remove();
        reindex();
        recalc();
    });

    $('#lines-body').on('change input', '.product-select, .qty-input', recalc);

    recalc();
})(jQuery);
