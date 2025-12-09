import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  OnInit,
  PLATFORM_ID,
  effect
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ButtonVariant, ButtonType, ButtonSize, ButtonConfig } from '../../core/types/configuration';
import { createGuid } from '../constants';

@Component({
  selector: 'app-base-button',
  template: ``,
  standalone: true,
  host: {
    '[attr.data-component]': '"base-button"'
  }
})
export class BaseButtonComponent implements OnInit {
  // Platform check for SSR compatibility
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Input signals (new Angular syntax)
  permission = input<any>('');
  identifier = input<string>(this.generateId());
  variant = input<ButtonVariant>('success');
  btnType = input<ButtonType>('button');
  disabled = input<boolean>(false);
  size = input<ButtonSize>('md');
  fullWidth = input<boolean>(false);
  rounded = input<boolean>(false);
  outline = input<boolean>(false);
  loading = input<boolean>(false);
  ariaLabel = input<string>('');
  tooltip = input<string>('');
  tooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('top');

  // Output signals
  clicked = output<Event>();

  // Internal signals
  private clickCount = signal(0);
  private lastClickTime = signal(0);

  // Computed properties
  buttonConfig = computed<ButtonConfig>(() => ({
    variant: this.variant(),
    size: this.size(),
    fullWidth: this.fullWidth(),
    rounded: this.rounded(),
    outline: this.outline()
  }));

  className = computed(() => {
    const config = this.buttonConfig();
    const baseClasses = ['btn'];

    // Variant classes
    if (config.outline) {
      baseClasses.push(`btn-outline-${config.variant}`);
    } else {
      baseClasses.push(`btn-${config.variant}`);
    }

    // Size classes
    if (config.size !== 'md') {
      baseClasses.push(`btn-${config.size}`);
    }

    // Additional classes
    if (config.fullWidth) baseClasses.push('w-100');
    if (config.rounded) baseClasses.push('rounded-pill');
    if (this.loading()) baseClasses.push('loading');
    if (this.disabled()) baseClasses.push('disabled');

    return baseClasses.join(' ');
  });

  isDisabled = computed(() => this.disabled() || this.loading());

  // Effects for side effects
  constructor() {
    // Effect to handle tooltip initialization
    effect(() => {
      if (this.isBrowser && this.tooltip()) {
        this.initializeTooltip();
      }
    });

    
  }

  ngOnInit(): void {
    // Any initialization logic
    if (this.isBrowser) {
      this.setupKeyboardNavigation();
    }
  }

  private generateId(): string {
    return `btn-${createGuid()}`;
  }

  private initializeTooltip(): void {
    if (typeof (window as any).bootstrap !== 'undefined') {
      const element = document.getElementById(this.identifier());
      if (element) {
        new (window as any).bootstrap.Tooltip(element);
      }
    }
  }

  private setupKeyboardNavigation(): void {
    const element = document.getElementById(this.identifier());
    element?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.handleClick(event);
      }
    });
  }

  protected handleClick(event: Event): void {
    if (this.isDisabled()) {
      event.preventDefault();
      return;
    }

    // Anti-spam protection
    const now = Date.now();
    const timeDiff = now - this.lastClickTime();

    if (timeDiff < 300) { // 300ms debounce
      return;
    }

    this.lastClickTime.set(now);
    this.clickCount.update(count => count + 1);
    this.clicked.emit(event);
  }

  // Public method for programmatic clicks
  click(): void {
    const event = new Event('click');
    this.handleClick(event);
  }

  // Public method to reset click count
  resetClickCount(): void {
    this.clickCount.set(0);
  }
}
