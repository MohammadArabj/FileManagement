import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  signal,
  computed,
  effect
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreadcrumbService, BreadcrumbItem } from '../../services/framework-services/breadcrumb.service';

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.html',
  standalone: true,
  imports: [RouterLink, NgClass]
})
export class BreadcrumbComponent implements OnInit {
  // Injected services using inject()
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly destroyRef = inject(DestroyRef);

  // Direct access to service signals (no local state needed)
  readonly title = this.breadcrumbService.title;
  readonly classificationLevel = this.breadcrumbService.classificationLevel;
  readonly breadcrumb = this.breadcrumbService.breadcrumb;

  // Computed signals for component logic
  readonly hasTitle = this.breadcrumbService.hasTitle;
  readonly hasBreadcrumb = this.breadcrumbService.hasBreadcrumb;
  readonly breadcrumbCount = this.breadcrumbService.breadcrumbCount;
  readonly isClassified = this.breadcrumbService.isClassified;

  // Additional computed properties for UI
  readonly shouldShowBreadcrumb = computed(() =>
    this.hasBreadcrumb() && this.breadcrumbCount() > 0
  );

  readonly breadcrumbText = computed(() => {
    const items = this.breadcrumb();
    return items.map(item => item.label).join(' > ');
  });

  readonly classificationColor = computed(() => {
    const level = this.classificationLevel();
    switch (level) {
      case 'محرمانه':
        return 'text-danger';
      case 'سری':
        return 'text-warning';
      case 'خیلی سری':
        return 'text-dark';
      default:
        return 'text-muted';
    }
  });

  constructor() {
    // Setup effects if needed
    this.setupEffects();
  }

  private setupEffects(): void {
    // Effect to handle title changes (if needed for analytics, etc.)
    effect(() => {
      const title = this.title();
      if (title) {
        // Could be used for page title, analytics, etc.
        document.title = title;
      }
    });

    // Effect to handle breadcrumb changes (if needed for navigation tracking)
    effect(() => {
      const breadcrumbs = this.breadcrumb();
      if (breadcrumbs.length > 0) {
        // Could be used for navigation analytics
      }
    });

    // Effect to handle classification level changes
    effect(() => {
      const level = this.classificationLevel();
      if (this.isClassified()) {
      }
    });
  }

  ngOnInit(): void {
    // No need for manual subscriptions with signals
    // Everything is handled reactively through signals and effects
  }

  // Utility methods for template usage
  getLastBreadcrumbItem(): BreadcrumbItem | null {
    const items = this.breadcrumb();
    return items.length > 0 ? items[items.length - 1] : null;
  }

  getFirstBreadcrumbItems(): BreadcrumbItem[] {
    const items = this.breadcrumb();
    return items.slice(0, -1);
  }

  // Method to handle breadcrumb click analytics
  onBreadcrumbClick(item: BreadcrumbItem, index: number): void {
    // Add analytics or tracking logic here
  }

  // Method to get classification badge class
  getClassificationBadgeClass(): string {
    const level = this.classificationLevel();
    const baseClass = 'badge';

    switch (level) {
      case 'محرمانه':
        return `${baseClass} bg-danger`;
      case 'سری':
        return `${baseClass} bg-warning text-dark`;
      case 'خیلی سری':
        return `${baseClass} bg-dark`;
      default:
        return `${baseClass} bg-secondary`;
    }
  }

  // Method to check if current item is active
  isActiveBreadcrumb(item: BreadcrumbItem): boolean {
    const items = this.breadcrumb();
    const lastItem = items[items.length - 1];
    return lastItem === item;
  }

  // Method to generate home breadcrumb
  getHomeBreadcrumb(): BreadcrumbItem {
    return {
      label: 'خانه',
      routerLink: '/'
    };
  }

  // Method to get full breadcrumb with home
  getFullBreadcrumb(): BreadcrumbItem[] {
    const items = this.breadcrumb();
    if (items.length === 0) {
      return [];
    }

    // Add home if not already present
    const hasHome = items.some(item => item.routerLink === '/');
    if (!hasHome) {
      return [this.getHomeBreadcrumb(), ...items];
    }

    return items;
  }
}