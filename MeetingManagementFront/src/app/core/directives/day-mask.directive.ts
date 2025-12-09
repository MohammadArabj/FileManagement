import { Directive, EventEmitter, ElementRef, AfterViewInit, Output, OnChanges, SimpleChanges, Input, HostListener } from '@angular/core';
import { NgControl } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';

@Directive({
    selector: '[appDayMask]',
    providers: [],
    standalone: true
})
export class DayMaskDirective implements OnChanges {
    @Output()
    value = new EventEmitter<boolean>();

    @Input() input: any;

    @Input()
    year!: number;
    @Input()
    month!: number;

    constructor(private el: ElementRef, private control: NgControl,
        private ref: ChangeDetectorRef) {
    }

    ngOnChanges(changes: { input: any; }): void {
        const input = changes.input;

        if (input.firstChange)
            return;

        let maxDays = 31;
        if (this.month > 6)
            maxDays = 30;

        const currentValue = parseInt(input.currentValue);
        let result = currentValue;

        if (currentValue) {
            if (currentValue > maxDays || currentValue < 0) {
                result = input.previousValue;
            }
        }

        this.control.control?.setValue(result);
        this.ref.detectChanges();
    }
}