import { Injectable, signal, computed } from '@angular/core';

export interface BreadcrumbItem {
  label: string;
  routerLink: string;
}

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbService {
  // Private writable signals
  private readonly _title = signal<string>('');
  private readonly _classificationLevel = signal<string>('عادی');
  private readonly _breadcrumb = signal<BreadcrumbItem[]>([]);

  // Public readonly signals
  readonly title = this._title.asReadonly();
  readonly classificationLevel = this._classificationLevel.asReadonly();
  readonly breadcrumb = this._breadcrumb.asReadonly();

  // Computed signals
  readonly hasTitle = computed(() => this._title().length > 0);
  readonly hasBreadcrumb = computed(() => this._breadcrumb().length > 0);
  readonly breadcrumbCount = computed(() => this._breadcrumb().length);
  readonly isClassified = computed(() => this._classificationLevel() !== 'عادی' && this._classificationLevel() !== '');

  constructor() {
    // Initialize with default values if needed
  }

  // Title management methods
  setTitle(title: string): void {
    this._title.set(title);
  }

  emptyTitle(): void {
    this._title.set('');
  }

  // Classification level methods
  setClassificationLevel(level: string): void {
    this._classificationLevel.set(level);
  }

  emptyClassificationLevel(): void {
    this._classificationLevel.set('عادی');
  }

  // Breadcrumb management methods
  setItems(items: BreadcrumbItem[]): void {
    this._breadcrumb.set(items);
  }

  setBreadcrumb(items: BreadcrumbItem[]): void {
    this._breadcrumb.set(items);
  }

  addBreadcrumbItem(item: BreadcrumbItem): void {
    this._breadcrumb.update(current => [...current, item]);
  }

  removeBreadcrumbItem(index: number): void {
    this._breadcrumb.update(current => current.filter((_, i) => i !== index));
  }

  updateBreadcrumbItem(index: number, item: BreadcrumbItem): void {
    this._breadcrumb.update(current => {
      const newItems = [...current];
      if (index >= 0 && index < newItems.length) {
        newItems[index] = item;
      }
      return newItems;
    });
  }

  emptyBreadcrumb(): void {
    this._breadcrumb.set([]);
  }

  // Utility methods
  reset(): void {
    this.emptyTitle();
    this.emptyBreadcrumb();
    this.emptyClassificationLevel();
  }

  // Helper method to get current state as object (for compatibility)
  getCurrentState() {
    return {
      title: this._title(),
      classificationLevel: this._classificationLevel(),
      breadcrumb: this._breadcrumb()
    };
  }

  // Method to set all at once
  setState(state: {
    title?: string;
    classificationLevel?: string;
    breadcrumb?: BreadcrumbItem[];
  }): void {
    if (state.title !== undefined) {
      this._title.set(state.title);
    }
    if (state.classificationLevel !== undefined) {
      this._classificationLevel.set(state.classificationLevel);
    }
    if (state.breadcrumb !== undefined) {
      this._breadcrumb.set(state.breadcrumb);
    }
  }
}