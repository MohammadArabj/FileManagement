import { NgControl } from "@angular/forms";
import { Directive, ElementRef, HostListener } from "@angular/core";

@Directive({
  selector: '[nullValue]',
  standalone: true
})
export class NullDefaultValueDirective {

  constructor(private el: ElementRef, private control: NgControl) { }

  @HostListener('change', ['$event'])
  onEvent(event: Event) {
    const target = event.target as HTMLInputElement | null;
    const value = target?.value ?? '';
    this.control.control?.setValue((value === '') ? null : value);
  }

}
