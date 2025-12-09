import { Directive, ElementRef, AfterViewInit } from '@angular/core';

declare var $: any;

@Directive({
    selector: '[appDatatable]',
    providers: [],
    standalone: true
})
export class DatatableDirective implements AfterViewInit {
    datatable: any;

    constructor(private el: ElementRef) { }

    ngAfterViewInit(): void {
        this.initializeSelect2();
    }

    initializeSelect2(): void {
        // if (this.datatable != undefined) {
        //     this.datatable.destroy();
        // }
        this.datatable = $(this.el.nativeElement).DataTable();

        // $(".dataTables_filter input")
        //     .unbind()
        //     .bind("input", function (e) {
        //         if (this.value.length >= 3 || e.keyCode == 13) {
        //             this.datatable.search(this.value).draw();
        //         }
        //         if (this.value == "") {
        //             this.datatable.search("").draw();
        //         }

        //         return;
        //     });
    }
}