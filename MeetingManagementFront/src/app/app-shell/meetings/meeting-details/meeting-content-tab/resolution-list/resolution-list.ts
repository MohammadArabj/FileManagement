import { Component, input, output, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Collapse } from 'bootstrap';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeetingDetails } from '../../../../../core/models/Meeting';
import { Resolution } from '../../../../../core/models/Resolution';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-resolution-list',
  standalone: true,
  imports: [CdkDropList, CdkDrag, NgbDropdownModule, NgClass],
  templateUrl: './resolution-list.html',
  styleUrl: './resolution-list.css',
})
export class ResolutionListComponent {
  private destroyRef = inject(DestroyRef);

  // Input signals - using the new input() function
  resolutions = input<Resolution[]>([]);
  canDrag = input<boolean>(false);
  canEditResolution = input<boolean>(false);
  canAddResolution = input<boolean>(false);
  canDeleteResolution = input<boolean>(false);
  canAddAssignment = input<boolean>(false);
  canViewFiles = input<boolean>(false);
  roleId = input<any>();
  statusId = input<any>();
  meeting = input.required<MeetingDetails | null>(); // Required input for printing

  // Output signals - using the new output() function
  resolutionDropped = output<CdkDragDrop<Resolution[]>>();
  addResolution = output<void>();
  editResolution = output<Resolution>();
  deleteResolution = output<Resolution>();
  assignResolution = output<Resolution>();
  showFiles = output<number>();
  printResolution = output<{ resolution: Resolution; index: number }>();
  editAssignment = output<number>();
  deleteAssignment = output<any>();
  printAllResolutions = output<void>();

  // اضافه کردن متد برای handle کردن کلیک دکمه
  printAllResolutionsClicked() {
    this.printAllResolutions.emit();
  }
  // Internal signals for component state
  private collapseStates = signal<Map<number, boolean>>(new Map());

  // Computed signals
  hasResolutions = computed(() => this.resolutions().length > 0);
  dragEnabled = computed(() => this.canDrag() && this.hasResolutions());

  // Effects for side effects

  onDrop(event: CdkDragDrop<Resolution[]>) {
    this.resolutionDropped.emit(event);
  }

  openAddResolutionModal() {
    this.addResolution.emit();
  }

  openEditResolutionModal(resolution: Resolution) {
    this.editResolution.emit(resolution);
  }

  deleteResolutionClicked(resolution: Resolution) {
    this.deleteResolution.emit(resolution);
  }

  assignResolutionClicked(resolution: Resolution) {
    this.assignResolution.emit(resolution);
  }

  showFilesClicked(resolutionId: number) {
    this.showFiles.emit(resolutionId);
  }

  printResolutionClicked(resolution: Resolution, index: number) {
    this.printResolution.emit({ resolution, index });
  }

  toggleCollapse(id: number) {
    const collapseElement = document.getElementById(`assignments-${id}`);
    if (collapseElement) {
      const bsCollapse = new Collapse(collapseElement, {
        toggle: false,
      });

      const isCurrentlyOpen = collapseElement.classList.contains('show');

      // Update our signal state
      this.collapseStates.update(states => {
        const newStates = new Map(states);
        newStates.set(id, !isCurrentlyOpen);
        return newStates;
      });

      if (isCurrentlyOpen) {
        bsCollapse.hide();
      } else {
        bsCollapse.show();
      }
    }
  }

  // Helper method to check collapse state using signals
  isCollapsed(id: number): boolean {
    return this.collapseStates().get(id) ?? false;
  }

  trackByFn(index: number, item: Resolution): any {
    return item.id ?? index;
  }

  editAssignmentClicked(assignId: number) {
    this.editAssignment.emit(assignId);
  }

  deleteAssignmentClicked(assign: any) {
    this.deleteAssignment.emit(assign);
  }

  // New helper computed signals for template usage
  canPerformActions = computed(() => ({
    edit: this.canEditResolution(),
    delete: this.canDeleteResolution(),
    assign: this.canAddAssignment(),
    viewFiles: this.canViewFiles()
  }));

  // Method to get resolution by index using signals
  getResolutionByIndex(index: number): Resolution | undefined {
    return this.resolutions()[index];
  }
}