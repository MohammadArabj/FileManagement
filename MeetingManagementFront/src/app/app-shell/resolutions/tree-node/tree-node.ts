import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionItem, AssignmentTreeNode } from '../../../services/assignment.service';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:'./tree-node.html',
  styleUrls: ['./tree-node.css']
})
export class TreeNode {
  @Input() node!: AssignmentTreeNode;
  @Input() level: number = 0;
  @Input() isRoot: boolean = false;
  @Input() expandedNodes!: Set<number>;
  @Input() currentUserGuid!: string;
  @Input() assignmentData: any;

  @Output() onNodeToggle = new EventEmitter<number>();
  @Output() onAddAction = new EventEmitter<AssignmentTreeNode>();
  @Output() onAddFollowup = new EventEmitter<AssignmentTreeNode>();
  @Output() onEditAction = new EventEmitter<{ action: ActionItem, type: 'action' | 'follow' }>();
  @Output() onDeleteAction = new EventEmitter<number>();
  @Output() onCreateReferral = new EventEmitter<AssignmentTreeNode>();
  @Output() onViewDetails = new EventEmitter<AssignmentTreeNode>();
  @Output() onFollowupSubmit = new EventEmitter<{
    node: AssignmentTreeNode;
    data: {
      status: string;
      date: string;
      description: string;
    }
  }>();

  // Form state signals
  public readonly showFollowupForm = signal<boolean>(false);
  public readonly isSaving = signal<boolean>(false);

  // Form fields
  public followupStatus = '';
  public followupDate = '';
  public followupDescription = '';

  get isExpanded(): boolean {
    return this.expandedNodes.has(this.node.id);
  }

  toggleNode(): void {
    this.onNodeToggle.emit(this.node.id);
  }

  editAction(action: ActionItem, type: 'action' | 'follow'): void {
    this.onEditAction.emit({ action, type });
  }

  // Permission methods
  canPerformAction(): boolean {
    // User can perform action if they are the actor for this node and assignment is not ended
    return this.node.actorGuid === this.currentUserGuid &&
      this.node.actionStatus !== 'End' &&
      !this.isAssignmentEnded();
  }

  canPerformFollowup(): boolean {
    // User can perform followup if they are assigned as follower for this specific node
    // and the followup status is not ended
    return this.node.followerGuid === this.currentUserGuid &&
      this.node.followStatus !== 'FollowUpEnd' &&
      !this.isAssignmentEnded();
  }

  canEditAction(action: ActionItem): boolean {
    return action.statusStr !== 'End' &&
      action.followStatusStr !== 'FollowUpEnd' &&
      !this.isAssignmentEnded();
  }

  private isAssignmentEnded(): boolean {
    if (!this.assignmentData) return false;

    if (this.assignmentData.isFollower) {
      return this.assignmentData.followStatusId === 3; // FollowUpEnd
    } else {
      return this.assignmentData.status === 4; // End
    }
  }

  // Followup form methods
  toggleFollowupForm(): void {
    this.showFollowupForm.set(!this.showFollowupForm());
    if (!this.showFollowupForm()) {
      this.resetFollowupForm();
    }
  }

  closeFollowupForm(): void {
    this.showFollowupForm.set(false);
    this.resetFollowupForm();
  }

  private resetFollowupForm(): void {
    this.followupStatus = '';
    this.followupDate = '';
    this.followupDescription = '';
  }

  async submitFollowup(): Promise<void> {
    if (!this.validateFollowupForm()) return;

    this.isSaving.set(true);

    const followupData = {
      status: this.followupStatus,
      date: this.followupDate,
      description: this.followupDescription.trim()
    };

    this.onFollowupSubmit.emit({
      node: this.node,
      data: followupData
    });

    // Reset form after successful submission (parent will handle the API call)
    setTimeout(() => {
      this.closeFollowupForm();
      this.isSaving.set(false);
    }, 100);
  }

  private validateFollowupForm(): boolean {
    if (!this.followupStatus) {
      return false;
    }

    if (!this.followupDate) {
      return false;
    }

    if (this.followupStatus !== 'Done' && !this.followupDescription.trim()) {
      return false;
    }

    return true;
  }

  // Status helper methods - aligned with main component
  getActionStatusClass(): string {
    const status = this.node.actionStatus?.toLowerCase();
    switch (status) {
      case 'done':
      case 'انجام شده':
        return 'bg-success text-white';
      case 'inprogress':
      case 'در حال انجام':
        return 'bg-warning text-dark';
      case 'notdone':
      case 'انجام نشده':
        return 'bg-danger text-white';
      case 'end':
      case 'پایان یافته':
        return 'bg-secondary text-white';
      default:
        return 'bg-light text-dark';
    }
  }

  getFollowStatusClass(): string {
    const status = this.node.followStatus?.toLowerCase();
    switch (status) {
      case 'followingup':
      case 'در حال پیگیری':
        return 'bg-info text-white';
      case 'followupend':
      case 'پایان پیگیری':
        return 'bg-success text-white';
      case 'notfollowedup':
      case 'پیگیری نشده':
        return 'bg-warning text-dark';
      default:
        return 'bg-secondary text-white';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Done':
      case 'FollowingUp':
        return 'bg-success text-white';
      case 'InProgress':
      case 'NotFollowedUp':
        return 'bg-warning text-dark';
      case 'NotDone':
        return 'bg-danger text-white';
      default:
        return 'bg-secondary text-white';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'Done': return 'انجام شده';
      case 'InProgress': return 'در حال انجام';
      case 'NotDone': return 'انجام نشده';
      case 'FollowingUp': return 'در حال پیگیری';
      case 'NotFollowedUp': return 'پیگیری نشده';
      case 'End': return 'پایان یافته';
      case 'FollowUpEnd': return 'پایان پیگیری';
      default: return status || 'نامشخص';
    }
  }
}