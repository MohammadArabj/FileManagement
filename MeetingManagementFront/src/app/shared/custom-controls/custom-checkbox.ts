import { Component, input, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomControlComponent } from './custom-control';

@Component({
  selector: 'custom-checkbox',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="form-check">
      <input
        type="checkbox"
        class="form-check-input"
        [id]="identity()"
        [disabled]="isDisabled()"
        [readonly]="isReadonly()"
        [ngModel]="checked()"
        (ngModelChange)="handleCheckboxChange($event)"
        (focus)="handleFocus()"
        (blur)="handleBlur()"
        [attr.required]="isRequired() || null"
        [attr.aria-describedby]="hasError() ? identity() + '-error' : null">

      <label class="form-check-label" [for]="identity()">
        {{label()}}
        @if (isRequired()) {
          <span class="text-danger"> *</span>
        }
      </label>
    </div>

    @if (helpText()) {
      <div class="form-text">{{helpText()}}</div>
    }

    @if (hasError()) {
      <div [id]="identity() + '-error'" class="invalid-feedback d-block">
        @for (message of errorMessages(); track $index) {
          <div>{{message}}</div>
        }
      </div>
    }
  `,
  host: {
    '[attr.data-component]': '"custom-checkbox"'
  }
})
export class CustomCheckboxComponent extends CustomControlComponent implements OnInit {
  // Internal state
  public checked = signal<boolean>(false);

  // Computed properties
  isChecked = computed(() => this.checked());

  constructor() {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  override writeValue(value: boolean): void {
    this.checked.set(value !== null ? value : false);
    this.value.set(this.checked());
  }

  protected handleCheckboxChange(checked: boolean): void {
    this.checked.set(checked);
    this.value.set(checked);
    this.onChange(checked);
    this.changed.emit(checked);
  }

  // Public methods
  toggle(): void {
    if (!this.isDisabled()) {
      const newValue = !this.checked();
      this.handleCheckboxChange(newValue);
    }
  }

  check(): void {
    if (!this.isDisabled() && !this.checked()) {
      this.handleCheckboxChange(true);
    }
  }

  uncheck(): void {
    if (!this.isDisabled() && this.checked()) {
      this.handleCheckboxChange(false);
    }
  }
}