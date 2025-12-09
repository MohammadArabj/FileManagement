import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { SidebarService } from '../../services/framework-services/sidebar.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, CommonModule, HasPermissionDirective],
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent {
  private readonly sidebarService = inject(SidebarService);

  readonly isMenuCollapsed = computed(() => this.sidebarService.collapsed());

  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }
}
