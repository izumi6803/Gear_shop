// Tiện ích UI dùng chung (jQuery)
(function ($) {
    'use strict';

    // Tự ẩn thông báo sau 5 giây
    window.setTimeout(function () {
        $('.alert-dismissible').fadeOut(400);
    }, 5000);

    // Lọc nhanh trong bảng: <input data-table-filter="#tableId">
    $('[data-table-filter]').on('keyup', function () {
        var term = $(this).val().toLowerCase();
        $($(this).data('table-filter')).find('tbody tr').each(function () {
            var $row = $(this);
            $row.toggle($row.text().toLowerCase().indexOf(term) !== -1);
        });
    });
})(jQuery);
