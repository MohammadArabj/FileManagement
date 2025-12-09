import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomControlComponent } from './custom-control';

export interface RadioOption {
  value: any;
  label: string;
  disabled?: boolean;
  description?: string;
}

@Component({
  selector: 'custom-radio',
  standalone: true,
  imports: [FormsModule],
  template: `
    <fieldset [disabled]="isDisabled()">
      <legend class="form-label">
        {{label()}}
        @if (isRequired()) {
          <span class="text-danger"> *</span>
        }
      </legend>

      <div [class]="radioGroupClass()">
        @for (option of options(); track option.value) {
          <div class="form-check">
            <input
              type="radio"
              class="form-check-input"
              [id]="identity() + '_' + $index"
              [name]="identity()"
              [value]="option.value"
              [disabled]="option.disabled || isDisabled()"
              [readonly]="isReadonly()"
              [ngModel]="value()"
              (ngModelChange)="handleRadioChange($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              [attr.required]="isRequired() || null"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">

            <label class="form-check-label" [for]="identity() + '_' + $index">
              <span>{{option.label}}</span>
              @if (option.description) {
                <small class="text-muted d-block">{{option.description}}</small>
              }
            </label>
          </div>
        }
      </div>
    </fieldset>

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
    '[attr.data-component]': '"custom-radio"'
  }
})
export class CustomRadioComponent extends CustomControlComponent implements OnInit {
  // Input properties
  options = input<RadioOption[]>([]);
  inline = input<boolean>(false);

  // Computed properties
  radioGroupClass = computed(() => {
    return this.inline() ? 'd-flex gap-3' : '';
  });

  constructor() {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  protected handleRadioChange(selectedValue: any): void {
    this.value.set(selectedValue);
    this.onChange(selectedValue);
    this.changed.emit(selectedValue);
  }

  // Public methods
  selectOption(value: any): void {
    if (!this.isDisabled()) {
      const option = this.options().find(opt => opt.value === value);
      if (option && !option.disabled) {
        this.handleRadioChange(value);
      }
    }
  }

  getSelectedOption(): RadioOption | undefined {
    return this.options().find(opt => opt.value === this.value());
  }
}
