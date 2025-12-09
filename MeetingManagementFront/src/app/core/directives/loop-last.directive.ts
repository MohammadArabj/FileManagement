import { Component, Input, Output, EventEmitter } from '@angular/core';
@Component({
    selector: 'islast',
    template: '<span></span>',
    standalone: true
})
export class LoopLastDirective {
    @Input() isLast: boolean=false;
    @Output() onLastDone: EventEmitter<boolean> = new EventEmitter<boolean>();
    ngOnInit() {
        if (this.isLast)
            this.onLastDone.emit(true);
    }
}