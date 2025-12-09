import { Directive, EventEmitter, ElementRef, AfterViewInit, Output } from '@angular/core';
import { NgControl } from '@angular/forms';
declare var $: any;

@Directive({
    selector: '[appClockPicker]',
    providers: [],
    standalone: true
})
export class ClockPickerDirective implements AfterViewInit {
    @Output()
    value = new EventEmitter<boolean>();

    clockPicker: any;

    constructor(private el: ElementRef, private control: NgControl) {
    }

    ngAfterViewInit(): void {
        this.clockPicker = $(this.el.nativeElement).clockpicker({
            placement: "bottom",
            align: "left",
            autoclose: !0,
            default: "now",
        });
    }
}
