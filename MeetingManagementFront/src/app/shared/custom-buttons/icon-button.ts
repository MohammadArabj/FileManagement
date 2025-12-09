import { Component, input, computed } from '@angular/core';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { BaseButtonComponent } from './base-button';

@Component({
  selector: 'app-icon-button',
  standalone: true,
  imports: [HasPermissionDirective],
  template: `
    @if (permission(); as perm) {
      <button
        *hasPermission="[perm]"
        [id]="identifier()"
        [type]="btnType()"
        [class]="className()"
        [attr.data-toggle]="tooltip() ? 'tooltip' : null"
        [attr.data-bs-placement]="tooltipPosition()"
        [title]="tooltip() || ariaLabel() || label()"
        [attr.aria-label]="ariaLabel() || label()"
        [disabled]="isDisabled()"
        (click)="handleClick($event)"
        [attr.tabindex]="isDisabled() ? -1 : 0"
      >
        @if (loading()) {
          <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        } @else {
          <i class="fa fa-{{icon()}}" [attr.aria-hidden]="true"></i>
        }

        @if (showLabel()) {
          <span class="visually-hidden">{{label()}}</span>
        }
      </button>
    } @else {
      <button
        [id]="identifier()"
        [type]="btnType()"
        [class]="className()"
        [attr.data-toggle]="tooltip() ? 'tooltip' : null"
        [attr.data-bs-placement]="tooltipPosition()"
        [title]="tooltip() || ariaLabel() || label()"
        [attr.aria-label]="ariaLabel() || label()"
        [disabled]="isDisabled()"
        (click)="handleClick($event)"
        [attr.tabindex]="isDisabled() ? -1 : 0"
      >
        @if (loading()) {
          <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        } @else {
          <i class="fa fa-{{icon()}}" [attr.aria-hidden]="true"></i>
        }

        @if (showLabel()) {
          <span class="visually-hidden">{{label()}}</span>
        }
      </button>
    }
  `,
  host: {
    '[attr.data-component]': '"icon-button"'
  }
})
export class IconButtonComponent extends BaseButtonComponent {
  label = input<string>('Button');
  icon = input<string>('');
  showLabel = input<boolean>(false); // For accessibility

  // Computed validation
  hasValidIcon = computed(() => this.icon().length > 0);

  // Override parent's aria-label if not provided
  readonly computedAriaLabel = computed<string>(() =>
    this.ariaLabel() || this.label() || `${this.icon()} button`
  );

  constructor() {
    super();
  }
}