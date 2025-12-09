import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-resolution-text-modal',
  standalone: true,
  template: `
  <div class="modal fade show d-block" tabindex="-1" role="dialog" style="background: rgba(0,0,0,0.4)">
    <div class="modal-dialog modal-lg" role="document">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">متن مصوبه</h5>
          <button type="button" class="btn-close btn-close-white" aria-label="Close" (click)="close()"></button>
        </div>
        <div class="modal-body" style="white-space: pre-line;">
          {{ text }}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" (click)="close()">بستن</button>
        </div>
      </div>
    </div>
  </div>
  `,
})
export class ResolutionTextModalComponent {
  @Input() text: string = '';
  @Output() closed = new EventEmitter<void>();

  close() {
    this.closed.emit();
  }
}