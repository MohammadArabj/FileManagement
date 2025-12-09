import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, signal, computed, inject, input, effect, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrgChart } from 'd3-org-chart';
import { ActionService } from '../../../services/action.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { USER_ID_NAME } from '../../../core/types/configuration';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { firstValueFrom } from 'rxjs';
import { ActionItem, AssignmentService, AssignmentTreeNode } from '../../../services/assignment.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-assignment-org-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-org-chart.html',
  styleUrls: ['./assignment-org-chart.css']
})
export class AssignmentOrgChart implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef<HTMLDivElement>;

  // Services
  private readonly assignmentService = inject(AssignmentService);
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
  public readonly selectedNode = signal<AssignmentTreeNode | null>(null);
  public readonly activeTab = signal<'actions' | 'followups' | 'children'>('actions');
  public readonly showFollowupForm = signal<boolean>(false);

  // Action modal state
  public readonly actionSelectedNode = signal<AssignmentTreeNode | null>(null);
  public readonly editMode = signal<boolean>(false);
  public readonly editingActionId = signal<number | null>(null);
  public readonly actionType = signal<'action' | 'follow'>('action');

  // Form fields
  public actionStatus = '';
  public actionDate = '';
  public actionDescription = '';

  // d3-org-chart instance
  private chart: any;
  closeFollowupForm() {
    this.showFollowupForm.set(false);
  }
  toggleFollowupForm(): void {
    this.showFollowupForm.set(!this.showFollowupForm());
    if (!this.showFollowupForm()) {
      //this.resetFollowupForm();
    }
  }

  // Computed values
  public readonly modalTitle = computed(() =>
    this.editMode()
      ? `ویرایش ${this.actionType() === 'action' ? 'اقدام' : 'پیگیری'}`
      : `ثبت ${this.actionType() === 'action' ? 'اقدام' : 'پیگیری'} جدید`
  );

  constructor() {
    // Auto-load tree when assignmentId changes
    effect(() => {
      const id = this.assignmentId();
      if (id > 0) {
        // Delay loading to ensure component is fully initialized
        setTimeout(() => {
          this.loadTree();
        }, 300);
      }
    });
  }

  ngOnInit(): void {
    if (this.assignmentId() > 0) {
      this.loadTree();
    }
  }
  ngAfterViewInit(): void {
    // Wait for DOM to be fully rendered
    setTimeout(() => {
      if (!this.chartContainer || !this.chartContainer.nativeElement) {
        console.error('Chart container not available in ngAfterViewInit');
        return;
      }
      this.initializeChart();

      // Load data if available after chart initialization
      if (this.treeData()) {
        this.renderChart(this.treeData()!);
      }
    }, 200);
  }

  ngOnDestroy(): void {
    // Cleanup chart
    if (this.chart) {
      this.chart = null;
    }
  }

  public async loadTree(): Promise<void> {
    this.isLoading.set(true);
    try {
      const tree = await firstValueFrom(
        this.assignmentService.getAssignmentTree(this.assignmentId())
      );
      if (!tree) {
        console.error('No tree data received');
        this.toastService.error('داده‌ای برای نمایش وجود ندارد');
        return;
      }
      this.treeData.set(tree);

      // بررسی وجود چارت و کانتینر
      if (this.chart && this.chartContainer?.nativeElement) {
        this.renderChart(tree);
      } else {
        console.warn('Chart or container not ready, initializing chart');
        this.initializeChart();
        setTimeout(() => {
          if (this.chart && this.chartContainer?.nativeElement) {
            this.renderChart(tree);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading tree:', error);
      this.toastService.error('خطا در بارگذاری درخت ارجاعات');
    } finally {
      this.isLoading.set(false);
    }
  }

  private initializeChart(): void {
    if (!this.chartContainer || !this.chartContainer.nativeElement) {
      console.error('Chart container is not available');
      return;
    }


    try {
      // Get container dimensions
      const containerRect = this.chartContainer.nativeElement.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      this.chart = new OrgChart()
        .container('#chartContainer')
        .data([])
        .nodeWidth(() => Math.min(280, containerWidth * 0.2)) // Responsive width
        .nodeHeight(() => Math.min(160, containerHeight * 0.2)) // Responsive height
        .childrenMargin(() => Math.min(60, containerWidth * 0.05)) // Responsive margin
        .compact(false)
        .siblingsMargin(() => Math.min(30, containerWidth * 0.025))
        .nodeContent((d: any) => this.createNodeContent(d))
        .onNodeClick((d: any) => {
          this.onNodeClick(d.data);
        });

      // Initial fit to container
      // this.chart.fit();

    } catch (error) {
      console.error('Error initializing chart:', error);
    }
  }
  private renderChart(data: AssignmentTreeNode): void {
    if (!this.chart) {
      console.error('Chart is not initialized');
      return;
    }
    if (!this.chartContainer?.nativeElement) {
      console.error('Chart container is not available for rendering');
      return;
    }
    if (!data) {
      console.error('No data provided for rendering chart');
      return;
    }

    try {
      const chartData = this.transformDataForChart(data);
      if (!chartData || chartData.length === 0) {
        console.error('Transformed chart data is empty or invalid');
        return;
      }
      this.chart
        .data(chartData)
        .render()
        .expandAll()
        .fit();
    } catch (error) {
      console.error('Error rendering chart:', error);
      this.toastService.error('خطا در نمایش چارت');
    }
  }

  private getLatestActionStatus(nodeData: AssignmentTreeNode): string {
    const actions = nodeData.actions || [];
    const followups = nodeData.followups || [];
    const allActions = [...actions, ...followups];

    if (allActions.length === 0) {
      return 'در انتظار اقدام';
    }

    const latestAction = allActions.reduce((latest, action) => {
      const actionDate = new Date(action.date);
      return !latest || actionDate > new Date(latest.date) ? action : latest;
    }, null as ActionItem | null);

    return latestAction?.statusStr || latestAction?.followStatusStr || 'در انتظار اقدام';
  }
  // Helper method to get person image
  public getPersonImage(actorName: string): string {
    // Generate a consistent image based on the person's name
    // This could be replaced with actual profile images from your backend
    const hash = this.simpleHash(actorName || 'default');
    const avatarId = Math.abs(hash) % 70 + 1; // Assuming you have 70 different avatar images

    // Return path to default avatar images or use a service like DiceBear
    return `${environment.fileManagementEndpoint}/photo/${actorName}.jpg`;

    // Alternative: if you have local avatar images
    // return `assets/images/avatars/avatar-${avatarId}.png`;

    // Fallback to a default image
    // return 'assets/images/default-avatar.png';
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  private createNodeContent(d: any): string {
    const nodeData = d.data.data;
    const actionsCount = nodeData.actions?.length || 0;
    const followupsCount = nodeData.followups?.length || 0;
    const childrenCount = nodeData.children?.length || 0;
    const backgroundColor = this.getNodeColor(nodeData);
    const actionStatus = this.getLatestActionStatus(nodeData);

    const actorName = nodeData.actorName || 'نامشخص';
    const referrerName = nodeData.referrerName || '';
    const personImage = this.getPersonImage(nodeData.actorPersonalNo);

    return `
  <div style="
    width: 280px;
    height: 160px;
    background: ${backgroundColor};
    border: 3px solid #e2e8f0;
    border-radius: 20px;
    padding: 0;
    font-family: 'Vazirmatn', sans-serif;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    direction: rtl;
    position: relative;
    overflow: hidden;
  " 
  onmouseover="this.style.transform='translateY(-8px) scale(1.02)'; this.style.boxShadow='0 20px 40px rgba(0,0,0,0.25)'; this.style.borderColor='#667eea'"
  onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 10px 30px rgba(0,0,0,0.15)'; this.style.borderColor='#e2e8f0'">
    
    <!-- Background Pattern -->
    <div style="
      position: absolute;
      top: -50%;
      right: -50%;
      width: 100px;
      height: 100px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      border-radius: 50%;
    "></div>
    
    <!-- Header Section -->
    <div style="
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.2);
      position: relative;
    ">
      <!-- Person Avatar -->
      <div style="
        width: 50px;
        height: 50px;
        border-radius: 50%;
        overflow: hidden;
        border: 3px solid rgba(255,255,255,0.3);
        background: linear-gradient(135deg, #f7fafc, #edf2f7);
        flex-shrink: 0;
        position: relative;
      ">
        <img src="${personImage}" 
             style="width: 100%; height: 100%; object-fit: contain;" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
        <div style="
          display: none;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          font-weight: bold;
          font-size: 14px;
        ">${actorName.charAt(0)}</div>
      </div>
      
      <!-- Person Info -->
      <div style="flex: 1; min-width: 0;">
        <div style="
          font-size: 16px;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.2;
        ">
          ${actorName}
        </div>
        <div style="
          font-size: 12px;
          color: #4a5568;
          opacity: 0.8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">
          
        </div>
      </div>
      
      <!-- Status Indicator -->
      <div style="
        position: absolute;
        top: 8px;
        left: 8px;
        background: ${this.getStatusColor(actionStatus)};
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      ">
        ${this.getStatusText(actionStatus)}
      </div>
    </div>
    
    <!-- Stats Section -->
    <div style="
      display: flex;
      justify-content: space-around;
      padding: 16px 12px 12px;
      position: relative;
    ">
      <div style="
        text-align: center;
        background: rgba(34, 197, 94, 0.1);
        padding: 8px;
        border-radius: 12px;
        min-width: 50px;
        border: 1px solid rgba(34, 197, 94, 0.2);
      ">
        <div style="
          font-weight: 700;
          font-size: 16px;
          color: #059669;
          line-height: 1;
          margin-bottom: 2px;
        ">${actionsCount}</div>
        <div style="
          font-size: 10px;
          color: #065f46;
          font-weight: 500;
        ">اقدام</div>
      </div>
      
     
      
      <div style="
        text-align: center;
        background: rgba(168, 85, 247, 0.1);
        padding: 8px;
        border-radius: 12px;
        min-width: 50px;
        border: 1px solid rgba(168, 85, 247, 0.2);
      ">
        <div style="
          font-weight: 700;
          font-size: 16px;
          color: #7c3aed;
          line-height: 1;
          margin-bottom: 2px;
        ">${childrenCount}</div>
        <div style="
          font-size: 10px;
          color: #5b21b6;
          font-weight: 500;
        ">ارجاع</div>
      </div>
    </div>
    
    
    
    <!-- Hover Effect Indicator -->
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      background: rgba(102, 126, 234, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    " class="hover-indicator">
      <i class="fa fa-mouse-pointer" style="color: #667eea; font-size: 14px;"></i>
    </div>
  </div>
  `;
  }

  private transformDataForChart(node: AssignmentTreeNode): any[] {
    if (!node?.id) {
      console.error('Invalid node data:', node);
      return [];
    }

    const result: any[] = [];
    const transformNode = (currentNode: AssignmentTreeNode, parentId?: string): void => {
      const nodeId = `node-${currentNode.id}`;
      result.push({
        id: nodeId,
        parentId: parentId || '',
        data: {
          id: currentNode.id,
          actorName: currentNode.actorName || 'نامشخص',
          actorPositionTitle: currentNode.actorPositionTitle || '',
          actorPersonalNo: currentNode.actorPersonalNo || '',
          referrerName: currentNode.referrerName || '',
          level: currentNode.level || 0,
          actionStatus: currentNode.actionStatus || '',
          followStatus: currentNode.followStatus || '',
          children: currentNode.children || [],
          actions: currentNode.actions || [],
          followups: currentNode.followups || []
        }
      });

      if (currentNode.children?.length > 0) {
        currentNode.children.forEach((child: AssignmentTreeNode) => {
          transformNode(child, nodeId);
        });
      }
    };

    transformNode(node);
    return result;
  }

  private getNodeColor(nodeData: AssignmentTreeNode): string {
    const actionsCount = nodeData.actions?.length || 0;
    const followupsCount = nodeData.followups?.length || 0;

    if (actionsCount === 0 && followupsCount === 0) {
      return 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'; // Light gray gradient
    }

    if (actionsCount > 0 && followupsCount > 0) {
      return 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'; // Blue gradient
    }

    if (actionsCount > 0) {
      return 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)'; // Green gradient
    }

    return 'linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)'; // Orange gradient
  }

  public onNodeClick(nodeData: any): void {
    this.selectedNode.set(nodeData.data);
    this.activeTab.set('actions');
  }

  // Chart control methods
  public fitChart(): void {
    if (this.chart) {
      const containerRect = this.chartContainer.nativeElement.getBoundingClientRect();
      this.chart.fit(containerRect.width, containerRect.height);
    }
  }

  public centerChart(): void {
    if (this.chart) {
      this.chart.centerGraph();
    }
  }

  public expandAll(): void {
    if (this.chart) {
      this.chart.expandAll();
    }
  }

  public collapseAll(): void {
    if (this.chart) {
      this.chart.collapseAll();
    }
  }

  public closeModal(): void {
    this.selectedNode.set(null);
  }

  // Action Modal Methods
  public openActionModal(node: AssignmentTreeNode, type: 'action' | 'follow'): void {
    this.actionSelectedNode.set(node);
    this.actionType.set(type);
    this.resetActionForm();

    const modal = document.getElementById('treeActionModal');
    if (modal) {
      const bootstrapModal = new (window as any).bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

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

  public async saveAction(): Promise<void> {
    if (!this.validateActionForm()) return;

    this.isSaving.set(true);
    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const node = this.actionSelectedNode();

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
      this.closeActionModal();
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

  public async deleteAction(actionId: number): Promise<void> {
    const result = await this.swalService.fireSwal('آیا از حذف این مورد اطمینان دارید؟');

    if (result.isConfirmed) {
      try {
        await firstValueFrom(this.actionService.delete(actionId));
        await this.loadTree();
        this.onDataChanged.emit();
        this.toastService.success('مورد با موفقیت حذف شد');

        // Close modal if it's open
        this.closeModal();
      } catch (error) {
        console.error('Error deleting action:', error);
        this.toastService.error('خطا در حذف مورد');
      }
    }
  }

  public closeActionModal(): void {
    const modal = document.getElementById('treeActionModal');
    if (modal) {
      const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) {
        bootstrapModal.hide();
      }
    }
    this.resetActionForm();
  }

  private resetActionForm(): void {
    this.editMode.set(false);
    this.editingActionId.set(null);
    this.actionStatus = '';
    this.actionDate = '';
    this.actionDescription = '';
  }

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

  // Status helper methods
  public getStatusColor(status: string): string {
    switch (status) {
      case 'Done': return '#28a745';
      case 'InProgress': return '#ffc107';
      case 'NotDone': return '#dc3545';
      case 'FollowingUp': return '#007bff';
      case 'NotFollowedUp': return '#6c757d';
      default: return '#6c757d';
    }
  }

  public getStatusText(status: string): string {
    switch (status) {
      case 'Done': return 'انجام شده';
      case 'InProgress': return 'در حال انجام';
      case 'NotDone': return 'انجام نشده';
      case 'FollowingUp': return 'در حال پیگیری';
      case 'NotFollowedUp': return 'پیگیری نشده';
      default: return status || 'نامشخص';
    }
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

  public getActiveTasksCount(): number {
    return this.countActiveTasks(this.treeData());
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

  private countActiveTasks(node: AssignmentTreeNode | null): number {
    if (!node) return 0;

    const activeActions = node.actions.filter(action =>
      action.statusStr === 'InProgress' || action.statusStr === 'NotDone'
    ).length;

    const activeFollowups = node.followups.filter(followup =>
      followup.followStatusStr === 'FollowingUp' || followup.followStatusStr === 'NotFollowedUp'
    ).length;

    return activeActions + activeFollowups +
      node.children.reduce((sum, child) => sum + this.countActiveTasks(child), 0);
  }
}