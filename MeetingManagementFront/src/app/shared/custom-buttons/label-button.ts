import { Component, input, computed } from '@angular/core';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { BaseButtonComponent } from './base-button';

@Component({
  selector: 'app-label-button',
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
        [title]="tooltip()"
        [attr.aria-label]="ariaLabel()"
        [disabled]="isDisabled()"
        (click)="handleClick($event)"
        [attr.tabindex]="isDisabled() ? -1 : 0"
      >
        @if (loading()) {
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          <span>{{loadingText()}}</span>
        } @else {
          <span>{{label()}}</span>
        }
      </button>
    } @else {
      <button
        [id]="identifier()"
        [type]="btnType()"
        [class]="className()"
        [attr.data-toggle]="tooltip() ? 'tooltip' : null"
        [attr.data-bs-placement]="tooltipPosition()"
        [title]="tooltip()"
        [attr.aria-label]="ariaLabel()"
        [disabled]="isDisabled()"
        (click)="handleClick($event)"
        [attr.tabindex]="isDisabled() ? -1 : 0"
      >
        @if (loading()) {
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          <span>{{loadingText()}}</span>
        } @else {
          <span>{{label()}}</span>
        }
      </button>
    }
  `,
  host: {
    '[attr.data-component]': '"label-button"'
  }
})
export class LabelButtonComponent extends BaseButtonComponent {
  label = input<string>('Button');
  loadingText = input<string>('Loading...');

  // Enhanced computed properties
  displayText = computed(() => this.loading() ? this.loadingText() : this.label());

  constructor() {
    super();
  }
}
