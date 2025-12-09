import { Directive, EventEmitter, ElementRef, AfterViewInit, Input, Output, OnChanges, SimpleChanges } from '@angular/core';

declare var $: any;

@Directive({
    selector: '[appDatePicker]',
    standalone: true

})
export class DatePickerDirective implements AfterViewInit, OnChanges {
    datePicker: any;

    @Input()
    dataUrl!: string;

    @Input()
    placeholder!: string;

    @Output()
    itemSelected = new EventEmitter<boolean>();

    constructor(private el: ElementRef) {

    }

    ngAfterViewInit(): void {
        this.initializeDatePicker();
    }

    ngOnChanges(changes: SimpleChanges): void {
        const dataUrl = changes['dataUrl'];

        // There are instances that at first dataUrl are not available.
        // if (dataUrl.currentValue) {
        this.initializeDatePicker();
        // }
    }

    // TODO: Use select2 transport option instead of ajax
    initializeDatePicker(): void {
        this.datePicker = $("#startDate").persianDatepicker({
            months: ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"],
            dowTitle: ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنج شنبه", "جمعه"],
            shortDowTitle: ["ش", "ی", "د", "س", "چ", "پ", "ج"],
            showGregorianDate: !1,
            persianNumbers: !0,
            formatDate: "YYYY/MM/DD",
            selectedBefore: !1,
            selectedDate: null,
            startDate: null,
            endDate: null,
            prevArrow: '\u25c4',
            nextArrow: '\u25ba',
            theme: 'default',
            alwaysShow: !1,
            selectableYears: null,
            selectableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            cellWidth: 25, // by px
            cellHeight: 20, // by px
            fontSize: 13, // by px                
            isRTL: !1,
            format: 'YYYY/MM/DD',

            calendarPosition: {
                x: 0,
                y: 0,
            },
            onShow: function () {
            },
            onHide: function () { },
            onSelect: function () {
            },
            onRender: function () { }
        });

        // this.datePicker.on('select', (event) => {
        //     const selectedItem = event.params.data;
        //     this.control.control.setValue(selectedItem.id);
        //     this.itemSelected.emit(selectedItem);
        // });

        // this.datePicker.on('onShow', (event) => {
        //     this.control.control.markAsTouched();
        // });
    }

    // clear() {
    //     if (this.select2) {
    //         this.select2.val(null).trigger('change');
    //         this.control.control.setValue(null);
    //     }
    // }
}
