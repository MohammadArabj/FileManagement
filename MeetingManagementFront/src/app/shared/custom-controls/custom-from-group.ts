import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'custom-form-group',
  standalone: true,
  template: `
    <div [class]="containerClass()" [attr.data-form-group]="groupId()">
      @if (title()) {
        <h5 class="form-group-title">{{title()}}</h5>
      }
      @if (description()) {
        <p class="form-group-description text-muted">{{description()}}</p>
      }

      <div [class]="contentClass()">
        <ng-content></ng-content>
      </div>

      @if (hasFooter()) {
        <div class="form-group-footer">
          <ng-content select="[slot=footer]"></ng-content>
        </div>
      }
    </div>
  `,
  host: {
    '[attr.data-component]': '"form-group"'
  }
})
export class FormGroupComponent {
  // Input properties
  title = input<string>('');
  description = input<string>('');
  groupId = input<string>('');
  layout = input<'vertical' | 'horizontal' | 'inline'>('vertical');
  spacing = input<'sm' | 'md' | 'lg'>('md');
  bordered = input<boolean>(false);
  collapsible = input<boolean>(false);
  collapsed = input<boolean>(false);

  // Computed properties
  containerClass = computed(() => {
    const classes = ['form-group-container'];

    if (this.bordered()) classes.push('border rounded p-3');
    if (this.spacing()) classes.push(`spacing-${this.spacing()}`);
    if (this.layout()) classes.push(`layout-${this.layout()}`);
    if (this.collapsible()) classes.push('collapsible');
    if (this.collapsed()) classes.push('collapsed');

    return classes.join(' ');
  });

  contentClass = computed(() => {
    const classes = ['form-group-content'];

    switch (this.layout()) {
      case 'horizontal':
        classes.push('row g-3');
        break;
      case 'inline':
        classes.push('d-flex flex-wrap gap-3');
        break;
      default:
        classes.push('d-flex flex-column gap-3');
    }

    return classes.join(' ');
  });

  hasFooter = computed(() => {
    // This would be determined by content projection in real implementation
    return false;
  });
}