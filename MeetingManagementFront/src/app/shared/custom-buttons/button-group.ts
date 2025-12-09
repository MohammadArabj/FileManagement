import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button-group',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      [class]="groupClassName()"
      [attr.role]="role()"
      [attr.aria-label]="ariaLabel()"
    >
      <ng-content></ng-content>
    </div>
  `,
  host: {
    '[attr.data-component]': '"button-group"'
  }
})
export class ButtonGroupComponent {
  vertical = input<boolean>(false);
  size = input<'sm' | 'md' | 'lg'>('md');
  role = input<string>('group');
  ariaLabel = input<string>();

  groupClassName = computed(() => {
    const classes = ['btn-group'];

    if (this.vertical()) {
      classes[0] = 'btn-group-vertical';
    }

    if (this.size() !== 'md') {
      classes.push(`btn-group-${this.size()}`);
    }

    return classes.join(' ');
  });
}
