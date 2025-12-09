import { Injectable } from '@angular/core';
declare var $: any;

@Injectable({
    providedIn: 'root'
})
export class DatatableService {
    dataTable: any;

    init(id = "#datatable", recordsCount = 0) {
        var self = this;
        if (self.dataTable != undefined) {
            self.dataTable.destroy();
        }

        self.dataTable = $(id).DataTable({
            // scrollY: "500px",
            scrollCollapse: !0,
            "destroy": true,
            "paging": false,
            "bPaginate": false,
            "pageLength": 100,
            // pagingType: "full_numbers",
            // scrollX: !0,
            "language": {
                "search": "جستجو:",
                "lengthMenu": "نمایش _MENU_ ردیف در صفحه",
                "zeroRecords": "ردیفی یافت نشد",
                "info": "نمایش صفحه _PAGE_ از _PAGES_",
                "infoEmpty": "ردیفی پیدا نشد",
                "infoFiltered": "(جستجو در میان _MAX_ ردیف)"
            },
            "order": [],
            // drawCallback: function () {
            //     $(".dataTables_paginate > .pagination").addClass("pagination-rounded");
            // },
        });
        $(".dataTables_filter input")
            .unbind()
            .bind("input",  (e: { keyCode: number; target: HTMLInputElement; }) => {
                if (e.target.value.length >= 3 || e.keyCode == 13) {
                    self.dataTable.search(e.target.value).draw();
                }
                if (e.target.value == "") {
                    self.dataTable.search("").draw();
                }
                return;
            });
    }

}
