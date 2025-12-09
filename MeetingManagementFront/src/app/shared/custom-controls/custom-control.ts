import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  effect,
  Optional,
  Self,
  DestroyRef
} from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { createUniqueId, SizeType, StyleType } from '../../core/types/configuration';
import { ValidationMessageService } from '../../services/validation.service';

@Component({
  selector: 'custom-control',
  template: '',
  standalone: true,
  host: {
    '[attr.data-component]': '"custom-control"',
    '[class]': 'hostClasses()'
  },
})
export class CustomControlComponent implements OnInit, OnDestroy, ControlValueAccessor {
  // Services
  private validationService = inject(ValidationMessageService);
  private destroyRef = inject(DestroyRef);
  protected ngControl = inject(NgControl, { optional: true, self: true });

  // Input signals
  classInput = input<string>('');
  identity = input<string>(createUniqueId());
  isDisabled = input<boolean>(false);
  readonly = input<boolean>(false);
  required = input<boolean>(false);
  label = input<string>('');
  min = input<number>();
  max = input<number>();
  placeholder = input<string>('');
  size = input<SizeType>('col-4');
  styleType = input<StyleType>('simple');
  tooltip = input<string>();
  helpText = input<string>();
  showValidation = input<boolean>(true);

  // Output signals
  changed = output<any>();
  focused = output<void>();
  blurred = output<void>();

  // Internal state
  protected value = signal<any>('');
  protected isTouched = signal<boolean>(false);
  protected isFocused = signal<boolean>(false);
  private isDestroyed = signal<boolean>(false);

  // NgControl tracking signals
  private controlStatus = signal<string>('VALID'); // 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'
  private controlTouched = signal<boolean>(false);
  private controlDirty = signal<boolean>(false);
  private controlErrors = signal<any>(null);

  // Computed properties
  hasError = computed(() =>
    this.showValidation() &&
    this.controlStatus() === 'INVALID' &&
    (this.controlTouched() || this.controlDirty() || this.isTouched())
  );

  errorMessages = computed(() => {
    if (!this.hasError() || !this.controlErrors()) return [];
    return this.validationService.getErrorMessage(this.controlErrors());
  });

  isRequired = computed(() =>
    this.required() || (this.controlErrors() && this.controlErrors()['required'])
  );

  isReadonly = computed(() => this.readonly() || this.isDisabled());

  hostClasses = computed(() => {
    const baseClass = this.size(); // از نوع SizeType مثل "col-4"
    const error = this.hasError();
    const focused = this.isFocused();
    const disabled = this.isDisabled();

    const classes: string[] = [baseClass];
    if (error) classes.push('has-error');
    if (focused) classes.push('is-focused');
    if (disabled) classes.push('is-disabled');

    return classes.join(' ');
  });

  // Form control methods
  onChange: (value: any) => void = () => { };
  onTouched: () => void = () => { };

  constructor() {
    // Set up the form control connection
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    // Effect to handle value changes
    effect(() => {
      if (!this.isDestroyed()) {
        this.validateValue();
      }
    });
  }

  ngOnInit(): void {
    if (!this.identity()) {
      console.warn(`Warning: Field '${this.label()}' has no specified ID.`);
    }

    // Track ngControl changes
    this.setupControlTracking();
  }

  ngOnDestroy(): void {
    this.isDestroyed.set(true);
  }

  private setupControlTracking(): void {
    if (!this.ngControl) return;

    // Initial values
    this.updateControlState();

    // Subscribe to status changes if available
    if (this.ngControl.statusChanges) {
      this.ngControl.statusChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.updateControlState();
        });
    }

    // Subscribe to value changes if available
    if (this.ngControl.valueChanges) {
      this.ngControl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.updateControlState();
        });
    }

    // Fallback: Check periodically for changes (not ideal but works)
    const checkInterval = setInterval(() => {
      if (this.isDestroyed()) {
        clearInterval(checkInterval);
        return;
      }
      this.updateControlState();
    }, 100);

    // Cleanup interval on destroy
    this.destroyRef.onDestroy(() => {
      clearInterval(checkInterval);
    });
  }

  private updateControlState(): void {
    if (!this.ngControl) return;

    const control = this.ngControl.control;
    if (!control) return;

    // Update control state signals
    this.controlStatus.set(control.status);
    this.controlTouched.set(control.touched || false);
    this.controlDirty.set(control.dirty || false);
    this.controlErrors.set(control.errors);
  }

  // ControlValueAccessor implementation
  writeValue(value: any): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // This is handled through the isDisabled input signal
    // You might want to update it if needed
  }

  // Event handlers
  protected handleValueChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    let newValue: any;

    if (target.type === 'checkbox') {
      newValue = (target as HTMLInputElement).checked;
    } else if (target.type === 'number') {
      newValue = target.value === '' ? null : Number(target.value);
    } else if (target.type === 'file') {
      newValue = (target as HTMLInputElement).files;
    } else {
      newValue = target.value;
    }

    this.value.set(newValue);
    this.onChange(newValue);
    this.changed.emit(newValue);

    // Force update control state after value change
    setTimeout(() => this.updateControlState(), 0);
  }

  protected handleFocus(): void {
    this.isFocused.set(true);
    this.focused.emit();
  }

  protected handleBlur(): void {
    this.isFocused.set(false);
    this.isTouched.set(true);
    this.onTouched();
    this.blurred.emit();

    // Force update control state after blur
    setTimeout(() => this.updateControlState(), 0);
  }

  private validateValue(): void {
    // Custom validation logic can be added here
  }

  // Public methods
  focus(): void {
    const element = document.getElementById(this.identity());
    element?.focus();
  }

  blur(): void {
    const element = document.getElementById(this.identity());
    element?.blur();
  }

  reset(): void {
    this.value.set('');
    this.isTouched.set(false);
    this.onChange('');

    // Force update control state after reset
    setTimeout(() => this.updateControlState(), 0);
  }

  // Method to manually trigger validation update
  public updateValidation(): void {
    this.updateControlState();
  }
}