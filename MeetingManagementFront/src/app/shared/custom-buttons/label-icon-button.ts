import { Component, input, computed } from '@angular/core';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { BaseButtonComponent } from './base-button';

@Component({
  selector: 'app-label-icon-button',
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
        <span class="d-flex align-items-center justify-content-center gap-2">
          @if (loading()) {
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span>{{loadingText()}}</span>
          } @else {
            @if (iconPosition() === 'left' && hasValidIcon()) {
              <i class="fa fa-{{icon()}}" [attr.aria-hidden]="true"></i>
            }
            <span>{{label()}}</span>
            @if (iconPosition() === 'right' && hasValidIcon()) {
              <i class="fa fa-{{icon()}}" [attr.aria-hidden]="true"></i>
            }
          }
        </span>
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
        <span class="d-flex align-items-center justify-content-center gap-2">
          @if (loading()) {
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            <span>{{loadingText()}}</span>
          } @else {
            @if (iconPosition() === 'left' && hasValidIcon()) {
              <i class="fa fa-{{icon()}}" [attr.aria-hidden]="true"></i>
            }
            <span>{{label()}}</span>
            @if (iconPosition() === 'right' && hasValidIcon()) {
              <i class="fa fa-{{icon()}}" [attr.aria-hidden]="true"></i>
            }
          }
        </span>
      </button>
    }
  `,
  host: {
    '[attr.data-component]': '"label-icon-button"'
  }
})
export class LabelIconButtonComponent extends BaseButtonComponent {
  label = input<string>('Button');
  icon = input<string>('');
  iconPosition = input<'left' | 'right'>('left');
  loadingText = input<string>('Loading...');

  // Computed properties
  hasValidIcon = computed(() => this.icon().length > 0);

  displayText = computed(() => this.loading() ? this.loadingText() : this.label());

  constructor() {
    super();
  }
}