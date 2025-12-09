import { NgControl } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import {
    Directive,
    EventEmitter,
    ElementRef,
    Output,
    OnChanges,
    SimpleChanges,
    Input
} from '@angular/core';

@Directive({
    selector: '[appDateMask]',
    providers: [],
    standalone: true
})
export class DateMaskDirective implements OnChanges {
    @Output()
    value = new EventEmitter<boolean>();

    @Input() input: any;
    constructor(private control: NgControl, private ref: ChangeDetectorRef) { }

    ngOnChanges(changes: any): void {
        const input = changes.input;

        if (input.firstChange)
            return;

        let result = '';
        if (!input.currentValue) return;
        let currentValue = input.currentValue.replaceAll("/", "");

        if (currentValue.length == 9) {
            result = input.previousValue;
        } else {
            for (let i = 0; i < currentValue.length; i++) {
                if (i == 4 || i == 6) {
                    result += "/";
                }
                if (currentValue[i])
                    result += currentValue[i];
                else
                    result += '0';
            }
        }

        if (result.length === 10) {
            const parts = result.split("/");
            const year = parseInt(parts[0]);
            const month = parts[1];
            const intMonth = parseInt(month);
            const day = parts[2];
            const intDay = parseInt(day);

            // if (year > 1500 || year < 1300) {

            // const m = moment();
            result = `${year}/${month}/${day}`;

            // }

            let maxDay = 31;
            if (intMonth > 6)
                maxDay = 30;

            if (intDay > maxDay || intDay == 0)
                result = `${year}/${month}/30`;

            if (intMonth > 12 || intMonth == 0)
                result = `${year}/01/${day}`;
        }

        this.control.control?.setValue(result);
        this.ref.detectChanges();
    }
}