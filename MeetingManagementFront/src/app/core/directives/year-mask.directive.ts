import { Directive, EventEmitter, ElementRef, AfterViewInit, Output, OnChanges, SimpleChanges, Input, HostListener } from '@angular/core';
import { NgControl } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';

@Directive({
    selector: '[appYearMask]',
    providers: [],
    standalone: true
})
export class YearMaskDirective {
    @Output()
    value = new EventEmitter<boolean>();

    @Input() input: any;

    constructor(private el: ElementRef, private control: NgControl,
        private ref: ChangeDetectorRef) {
    }

    @HostListener('focusout', ['$event'])
    onMouseEnter(event: FocusEvent) {
        const target = event.target as HTMLInputElement | null;
        const value = target?.value ?? '';
        const currentValue = parseInt(value);
        let result = currentValue;

        if (currentValue) {
            if (currentValue > 1500 || currentValue < 1300) {
                result = 1400;
            }
        }

        this.control.control?.setValue(result);
    }

    // ngOnChanges(changes: SimpleChanges): void {
    //     const input = changes.input;

    //     if (input.firstChange)
    //         return;


    //     this.ref.detectChanges();
    // }
}