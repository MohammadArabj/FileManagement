import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject, input, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionService } from '../../../services/action.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { USER_ID_NAME } from '../../../core/types/configuration';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { firstValueFrom } from 'rxjs';
import { ActionItem, AssignmentService, AssignmentTreeNode } from '../../../services/assignment.service';
import { TreeNode } from "../tree-node/tree-node";

@Component({
  selector: 'app-assignment-tree',
  standalone: true,
  imports: [CommonModule, FormsModule, TreeNode],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:'./assignment-tree.html' ,
  styleUrls: ['./assignment-tree.css']
})
export class AssignmentTree implements OnInit {
  // Services
  private readonly enhancedService = inject(AssignmentService);
  private readonly actionService = inject(ActionService);
  private readonly toastService = inject(ToastService);
  private readonly swalService = inject(SwalService);
  private readonly localStorageService = inject(LocalStorageService);

  // Input properties
  readonly assignmentId = input<number>(0);

  // Output events
  @Output() onClose = new EventEmitter<void>();
  @Output() onDataChanged = new EventEmitter<void>();

  // State signals
  public readonly treeData = signal<AssignmentTreeNode | null>(null);
  public readonly isLoading = signal<boolean>(false);
  public readonly isSaving = signal<boolean>(false);
  public readonly expandedNodes = signal<Set<number>>(new Set());
  public readonly allExpanded = signal<boolean>(false);

  // Modal state
  public readonly selectedNode = signal<AssignmentTreeNode | null>(null);
  public readonly editMode = signal<boolean>(false);
  public readonly editingActionId = signal<number | null>(null);
  public readonly actionType = signal<'action' | 'follow'>('action');

  // Form fields
  public actionStatus = '';
  public actionDate = '';
  public actionDescription = '';

  // Computed values
  public readonly modalTitle = computed(() =>
    this.editMode()
      ? `ویرایش ${this.actionType() === 'action' ? 'اقدام' : 'پیگیری'}`
      : `ثبت ${this.actionType() === 'action' ? 'اقدام' : 'پیگیری'} جدید`
  );

  constructor() {
    // Auto-load tree when assignmentId changes
    effect(() => {
      if (this.assignmentId() > 0) {
        this.loadTree();
      }
    });
  }

  ngOnInit(): void {
    if (this.assignmentId() > 0) {
      this.loadTree();
    }
  }

  /**
   * Load assignment tree from server
   */
  private async loadTree(): Promise<void> {
    this.isLoading.set(true);
    try {
      const tree = await firstValueFrom(
        this.enhancedService.getAssignmentTree(this.assignmentId())
      );
      this.treeData.set(tree);

      // Auto expand root node
      if (tree) {
        this.expandedNodes.update(nodes => nodes.add(tree.id));
      }
    } catch (error) {
      console.error('Error loading assignment tree:', error);
      this.toastService.error('خطا در بارگذاری درخت ارجاعات');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle node expansion
   */
  public toggleNode(nodeId: number): void {
    this.expandedNodes.update(nodes => {
      if (nodes.has(nodeId)) {
        nodes.delete(nodeId);
      } else {
        nodes.add(nodeId);
      }
      return new Set(nodes);
    });
  }

  /**
   * Toggle all nodes expansion
   */
  public toggleExpandAll(): void {
    const allNodes = this.getAllNodeIds();
    if (this.allExpanded()) {
      this.expandedNodes.set(new Set());
      this.allExpanded.set(false);
    } else {
      this.expandedNodes.set(new Set(allNodes));
      this.allExpanded.set(true);
    }
  }

  /**
   * Get all node IDs recursively
   */
  private getAllNodeIds(node: AssignmentTreeNode = this.treeData()!): number[] {
    if (!node) return [];

    const ids = [node.id];
    for (const child of node.children) {
      ids.push(...this.getAllNodeIds(child));
    }
    return ids;
  }

  /**
   * Open action modal for adding new action/followup
   */
  public openActionModal(node: AssignmentTreeNode, type: 'action' | 'follow'): void {
    this.selectedNode.set(node);
    this.actionType.set(type);
    this.resetActionForm();

    const modal = document.getElementById('treeActionModal');
    if (modal) {
      const bootstrapModal = new (window as any).bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  /**
   * Edit existing action
   */
  public editAction(action: ActionItem, type: 'action' | 'follow'): void {
    this.editMode.set(true);
    this.editingActionId.set(action.id);
    this.actionType.set(type);

    // Fill form with existing data
    this.actionStatus = type === 'action' ? (action.statusStr || '') : (action.followStatusStr || '');
    this.actionDate = action.date;
    this.actionDescription = action.description;

    const modal = document.getElementById('treeActionModal');
    if (modal) {
      const bootstrapModal = new (window as any).bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  /**
   * Save action or followup
   */
  public async saveAction(): Promise<void> {
    if (!this.validateActionForm()) return;

    this.isSaving.set(true);
    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const node = this.selectedNode();

      if (!node) throw new Error('Node not selected');

      const data = {
        id: this.editMode() ? this.editingActionId() : null,
        assignmentId: node.id,
        description: this.actionDescription.trim(),
        status: this.actionType() === 'action' ? this.actionStatus : null,
        followStatus: this.actionType() === 'follow' ? this.actionStatus : null,
        actionDate: this.actionDate,
        userGuid,
        type: this.actionType() === 'action' ? 'Action' : 'Follow',
      };

      await firstValueFrom(this.actionService.createOrEditAction(data));

      // Reload tree to show updated data
      await this.loadTree();
      this.closeModal();
      this.onDataChanged.emit();

      this.toastService.success(
        this.editMode() ? 'تغییرات با موفقیت ذخیره شد' : 'مورد جدید با موفقیت اضافه شد'
      );
    } catch (error) {
      console.error('Error saving action:', error);
      this.toastService.error('خطا در ثبت اطلاعات');
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Delete action with confirmation
   */
  public async deleteAction(actionId: number): Promise<void> {
    const result = await this.swalService.fireSwal('آیا از حذف این مورد اطمینان دارید؟');

    if (result.isConfirmed) {
      try {
        await firstValueFrom(this.actionService.delete(actionId));
        await this.loadTree();
        this.onDataChanged.emit();
        this.toastService.success('مورد با موفقیت حذف شد');
      } catch (error) {
        console.error('Error deleting action:', error);
        this.toastService.error('خطا در حذف مورد');
      }
    }
  }

  /**
   * Open referral modal
   */
  public openReferralModal(node: AssignmentTreeNode): void {
    // Implementation for referral modal
  }

  /**
   * View node details
   */
  public viewNodeDetails(node: AssignmentTreeNode): void {
    // Implementation for viewing node details
  }

  /**
   * Close action modal
   */
  public closeModal(): void {
    const modal = document.getElementById('treeActionModal');
    if (modal) {
      const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) {
        bootstrapModal.hide();
      }
    }
    this.resetActionForm();
  }

  /**
   * Close referral modal
   */
  public closeReferralModal(): void {
    const modal = document.getElementById('referralModal');
    if (modal) {
      const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) {
        bootstrapModal.hide();
      }
    }
  }

  /**
   * Reset action form
   */
  private resetActionForm(): void {
    this.editMode.set(false);
    this.editingActionId.set(null);
    this.actionStatus = '';
    this.actionDate = '';
    this.actionDescription = '';
  }

  /**
   * Validate action form
   */
  private validateActionForm(): boolean {
    if (!this.actionStatus) {
      this.toastService.error('لطفاً وضعیت را انتخاب کنید');
      return false;
    }

    if (!this.actionDate) {
      this.toastService.error('لطفاً تاریخ را انتخاب کنید');
      return false;
    }

    if (this.actionStatus !== 'Done' && !this.actionDescription.trim()) {
      this.toastService.error('لطفاً توضیحات را وارد کنید');
      return false;
    }

    return true;
  }

  // Statistics methods
  public getTotalNodesCount(): number {
    return this.countNodes(this.treeData());
  }

  public getTotalActionsCount(): number {
    return this.countActions(this.treeData());
  }

  public getTotalFollowupsCount(): number {
    return this.countFollowups(this.treeData());
  }

  public getInvolvedUsersCount(): number {
    const users = new Set<string>();
    this.collectUsers(this.treeData(), users);
    return users.size;
  }

  private countNodes(node: AssignmentTreeNode | null): number {
    if (!node) return 0;
    return 1 + node.children.reduce((sum, child) => sum + this.countNodes(child), 0);
  }

  private countActions(node: AssignmentTreeNode | null): number {
    if (!node) return 0;
    return node.actions.length + node.children.reduce((sum, child) => sum + this.countActions(child), 0);
  }

  private countFollowups(node: AssignmentTreeNode | null): number {
    if (!node) return 0;
    return node.followups.length + node.children.reduce((sum, child) => sum + this.countFollowups(child), 0);
  }

  private collectUsers(node: AssignmentTreeNode | null, users: Set<string>): void {
    if (!node) return;

    if (node.actorName) users.add(node.actorName);
    if (node.referrerName) users.add(node.referrerName);

    node.actions.forEach(action => {
      if (action.userName) users.add(action.userName);
    });

    node.followups.forEach(followup => {
      if (followup.userName) users.add(followup.userName);
    });

    node.children.forEach(child => this.collectUsers(child, users));
  }
}