import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject, input, effect, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionService } from '../../../services/action.service';
import { AssignmentService } from '../../../services/assignment.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { UserService } from '../../../services/user.service';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { firstValueFrom } from 'rxjs';
import { NgOptionComponent, NgSelectComponent } from "@ng-select/ng-select";
import { SystemUser } from '../../../core/models/User';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { AssignmentOrgChart } from "../assignment-org-chart/assignment-org-chart";
import { AssignmentTree } from "../assignment-tree/assignment-tree";
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgStyle } from '@angular/common';
import { environment } from '../../../../environments/environment';

// Interfaces
interface ActionItem {
  id: number;
  description: string;
  status?: string;
  statusStr?: string;
  followStatus?: string;
  followStatusStr?: string;
  userName: string;
  date: string;
  type: 'Action' | 'Follow';
  userGuid: string;
}

interface AssignmentData {
  id: number;
  meetingNumber: string;
  meetingDate: string;
  meetingTitle: string;
  number: string;
  title: string;
  decisionsMade: string;
  dueDate: string;
  isBoardMeeting: boolean;
  isFollower: boolean;
  isActor: boolean;
  status: number; // ActionStatus (1=Pending, 2=InProgress, 3=End)
  followStatusId: number; // ActionFollowStatus (1=Pending, 2=InProgress, 3=End)
  canRefer: boolean;
  resolution: string;
  referralsCount: number;
  actorName?: string;
  actorGuid?: string;
  followerName?: string;
  followerGuid?: string;
  actionStatus?: string; // Display name
  followStatusStr?: string; // Display name

  // Referral fields
  parentAssignmentId?: number;
  referrerGuid?: string;
  referrerName?: string;
  isReferral?: boolean;
  referralNote?: string;
  referralDate?: string;

  // Result fields
  result?: string; // '1' = Done, '2' = NotDone
  resultName?: string;
  resultDate?: string;
  resultDescription?: string;
}

interface UserWithPosition {
  userGuid: string;
  userName: string;
  positionGuid: string;
  positionTitle: string;
  personalNo: string;
  uniqueKey: string;
}

@Component({
  selector: 'app-assignment-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectComponent,
    AssignmentOrgChart,
    AssignmentTree,
    NgOptionComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-management.html',
  styleUrls: ['./assignment-management.css']
})
export class AssignmentManagement implements OnInit {
  // Services
  private readonly actionService = inject(ActionService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly toastService = inject(ToastService);
  private readonly swalService = inject(SwalService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly userService = inject(UserService);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // State signals
  readonly assignmentId = signal<number>(0);
  readonly assignmentData = signal<AssignmentData>({
    id: 0,
    meetingNumber: '',
    meetingDate: '',
    meetingTitle: '',
    number: '',
    title: '',
    decisionsMade: '',
    dueDate: '',
    isBoardMeeting: false,
    isFollower: false,
    isActor: false,
    status: 0,
    followStatusId: 0,
    canRefer: false,
    resolution: '',
    referralsCount: 0
  });

  // Output events
  @Output() onClose = new EventEmitter<void>();
  @Output() onDataChanged = new EventEmitter<void>();

  // Tab and loading states
  public readonly activeTab = signal<'actions' | 'referrals' | 'tree'>('actions');
  public readonly isLoading = signal<boolean>(false);
  public readonly isLoadingReferrals = signal<boolean>(false);
  public readonly isLoadingTree = signal<boolean>(false);
  public readonly isSaving = signal<boolean>(false);

  // Data states
  public readonly actions = signal<ActionItem[]>([]);
  public readonly followups = signal<ActionItem[]>([]);
  public readonly referrals = signal<any[]>([]);
  public readonly treeData = signal<any>(null);
  public readonly treeViewMode = signal<'list' | 'org'>('list');

  // Search state
  public readonly searchReferral = signal<string>('');

  // Computed signals
  public readonly filteredReferrals = computed(() => {
    const query = this.searchReferral().toLowerCase();
    return this.referrals().filter(r =>
      (r.actorName?.toLowerCase().includes(query)) ||
      (r.referrerName?.toLowerCase().includes(query)) ||
      (r.referralNote?.toLowerCase().includes(query))
    );
  });

  public readonly modalTitle = computed(() =>
    this.editMode() ?
      `ویرایش ${this.actionType() === 'action' ? 'اقدام' : 'پیگیری'}` :
      `ثبت ${this.actionType() === 'action' ? 'اقدام' : 'پیگیری'} جدید`
  );

  public readonly usersWithPositions = computed<UserWithPosition[]>(() => {
    const userList = this.availableUsers();
    const result: UserWithPosition[] = [];

    userList.forEach(user => {
      if (user.positions) {
        user.positions.forEach(position => {
          result.push({
            userGuid: user.guid,
            userName: user.name,
            positionGuid: position.positionGuid,
            positionTitle: position.positionTitle || '',
            personalNo: user.userName || '',
            uniqueKey: `${user.guid}_${position.positionGuid}`
          });
        });
      } else {
        result.push({
          userGuid: user.guid,
          userName: user.name,
          positionGuid: '',
          positionTitle: 'بدون سمت',
          personalNo: user.userName || '',
          uniqueKey: `${user.guid}_empty`
        });
      }
    });

    return result;
  });

  // Action modal state
  public readonly editMode = signal<boolean>(false);
  public readonly editingActionId = signal<number | null>(null);
  public readonly actionType = signal<'action' | 'follow'>('action');

  // Form fields - Action
  public actionStatus = '';
  public actionDate = '';
  public actionDescription = '';

  // Form fields - Referral
  public readonly showReferralForm = signal<boolean>(false);
  public readonly availableUsers = signal<SystemUser[]>([]);
  public selectedUserUniqueKey = '';
  public newDueDate = '';
  public referralNote = '';

  // Form fields - Result
  public resultStatus = '';
  public resultDate = '';
  public resultDescription = '';
  public readonly isSavingResult = signal<boolean>(false);
  private resultModalInstance: any = null;

  constructor() {
    // Auto-load data when assignmentId changes
    effect(() => {
      if (this.assignmentId() > 0) {
        this.loadAllData();
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: ParamMap) => {
        const id = params.get('id');
        if (id) {
          this.assignmentId.set(parseInt(id));
          this.loadUsersAndPositions();
        }
      });
  }

  // ============= Permission Methods =============

  // چک کردن اینکه آیا کاربر اقدام کننده اصلی است
  isMainActor(): boolean {
    const assignment = this.assignmentData();
    const currentUserGuid = this.localStorageService.getItem(USER_ID_NAME);

    return !assignment.parentAssignmentId &&
      assignment.isActor &&
      assignment.actorGuid === currentUserGuid;
  }


  // چک کردن اینکه آیا اقدام پایان یافته
  isActionEnded(): boolean {
    const assignment = this.assignmentData();
    return assignment.status === 3; // ActionStatus.End = 3
  }

  // چک امکان انجام عملیات
  public canPerformAction(): boolean {
    const assignment = this.assignmentData();

    if (assignment.isFollower) {
      // پیگیری فقط بعد از پایان اقدام امکان‌پذیر است
      return this.isActionEnded() && assignment.followStatusId !== 3;
    }

    if (assignment.isActor) {
      // اگر اقدام پایان یافته، هیچکس نمی‌تواند اقدام جدید ثبت کند
      return !this.isActionEnded();
    }

    return false;
  }

  // چک امکان ثبت اقدام
  public canRegisterAction(): boolean {
    const assignment = this.assignmentData();

    if (!assignment.isActor) {
      return false;
    }

    return !this.isActionEnded();
  }

  // چک امکان ثبت پیگیری
  public canRegisterFollowup(): boolean {
    const assignment = this.assignmentData();

    if (!assignment.isFollower) {
      return false;
    }

    return this.isActionEnded() && assignment.followStatusId !== 3;
  }

  // چک امکان پایان دادن
  public canEndAssignment(): boolean {
    const assignment = this.assignmentData();

    if (assignment.isFollower) {
      return this.isActionEnded() &&
        assignment.followStatusId !== 3 &&
        this.followups().length > 0;
    }

    if (assignment.isActor) {
      return this.isMainActor() &&
        assignment.status !== 3 &&
        this.actions().length > 0;
    }

    return false;
  }


  // ============= Data Loading Methods =============

  private async loadAllData(): Promise<void> {
    await Promise.all([
      this.loadAssignment(),
      this.loadActions()
    ]);
  }

  private async loadActions(): Promise<void> {
    if (!this.assignmentId()) return;

    this.isLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.actionService.getListBy(this.assignmentId())
      );

      if (Array.isArray(response)) {
        this.actions.set(response.filter(item => item.type === 'Action'));
        this.followups.set(response.filter(item => item.type === 'Follow'));
      }
    } catch (error) {
      console.error('Error loading actions:', error);
      this.toastService.error('خطا در بارگذاری اقدامات');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadAssignment(): Promise<void> {
    if (!this.assignmentId()) return;

    this.isLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.assignmentService.getBy(this.assignmentId())
      );
      this.assignmentData.set(response as AssignmentData);
    } catch (error) {
      console.error('Error loading assignment:', error);
      this.toastService.error('خطا در بارگذاری اطلاعات تخصیص');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadReferrals(): Promise<void> {
    if (!this.assignmentId()) return;

    this.isLoadingReferrals.set(true);
    try {
      const referrals = await firstValueFrom(
        this.assignmentService.getReferrals(this.assignmentId())
      );
      this.referrals.set(referrals);
    } catch (error) {
      console.error('Error loading referrals:', error);
      this.toastService.error('خطا در بارگذاری ارجاعات');
    } finally {
      this.isLoadingReferrals.set(false);
    }
  }

  private async loadTree(): Promise<void> {
    if (!this.assignmentId()) return;

    this.isLoadingTree.set(true);
    try {
      const tree = await firstValueFrom(
        this.assignmentService.getAssignmentTree(this.assignmentId())
      );
      this.treeData.set(tree);
    } catch (error) {
      console.error('Error loading tree:', error);
      this.toastService.error('خطا در بارگذاری درخت ارجاعات');
    } finally {
      this.isLoadingTree.set(false);
    }
  }

  private async loadUsersAndPositions(): Promise<void> {
    try {
      const users = await this.userService
        .getAllByClientId(getClientSettings().client_id ?? '')
        .toPromise() || [];
      this.availableUsers.set(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  // ============= Navigation Methods =============

  goBack(): void {
    this.location.back();
  }

  public setReferralTab(): void {
    this.activeTab.set('referrals');
    if (this.referrals().length === 0) {
      this.loadReferrals();
    }
  }

  public setTreeTab(): void {
    this.activeTab.set('tree');
    if (!this.treeData()) {
      this.loadTree();
    }
  }

  public setOrgChartMode(): void {
    this.treeViewMode.set('org');
    if (!this.treeData()) {
      this.loadTree();
    }
  }

  // ============= Action Management Methods =============

  public openActionModal(type: 'action' | 'follow'): void {
    // بررسی دسترسی
    if (type === 'action' && !this.canRegisterAction()) {
      this.toastService.error('شما مجاز به ثبت اقدام نیستید');
      return;
    }

    if (type === 'follow' && !this.canRegisterFollowup()) {
      this.toastService.error('پیگیری فقط بعد از پایان اقدام امکان‌پذیر است');
      return;
    }

    this.actionType.set(type);
    this.resetActionForm();

    const modal = document.getElementById('actionModal');
    if (modal) {
      const bootstrapModal = new (window as any).bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  public editAction(action: ActionItem, type: 'action' | 'follow'): void {
    if (this.isActionEnded() && type === 'action') {
      this.toastService.error('امکان ویرایش اقدام بعد از پایان وجود ندارد');
      return;
    }

    this.editMode.set(true);
    this.editingActionId.set(action.id);
    this.actionType.set(type);

    this.actionDescription = action.description || '';
    this.actionStatus = type === 'action' ?
      (action.statusStr || '') :
      (action.followStatusStr || '');
    this.actionDate = action.date || '';

    const modal = document.getElementById('actionModal');
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
      const data = {
        id: this.editMode() ? this.editingActionId() : null,
        assignmentId: this.assignmentId(),
        description: this.actionDescription.trim(),
        actionDate: this.actionDate,
        actionStatus: this.actionStatus,
        userGuid,
        type: this.actionType() === 'action' ? 'Action' : 'Follow',
      };

      await firstValueFrom(this.actionService.createOrEditAction(data));
      await this.loadActions();

      this.closeActionModal();
      this.onDataChanged.emit();

    } catch (error) {
      console.error('Error saving action:', error);
      this.toastService.error('خطا در ذخیره اطلاعات');
    } finally {
      this.isSaving.set(false);
    }
  }

  public async deleteAction(actionId: number): Promise<void> {
    const result = await this.swalService.fireSwal(
      'آیا از حذف این مورد اطمینان دارید؟'
    );

    if (result.isConfirmed) {
      try {
        await firstValueFrom(this.actionService.delete(actionId));
        await this.loadActions();
        this.onDataChanged.emit();
      } catch (error) {
        console.error('Error deleting action:', error);
        this.toastService.error('خطا در حذف');
      }
    }
  }

  public closeActionModal(): void {
    const modal = document.getElementById('actionModal');
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
    if (!this.actionDate) {
      this.toastService.error('لطفاً تاریخ را انتخاب کنید');
      return false;
    }
    if (!this.actionDescription.trim()) {
      this.toastService.error('لطفاً توضیحات را وارد کنید');
      return false;
    }
    return true;
  }

  // ============= Status Change Methods =============

  public async changeStatus(): Promise<void> {
    const assignment = this.assignmentData();

    if (assignment.isFollower) {
      // بررسی پیش‌نیازهای پیگیری
      if (!this.isActionEnded()) {
        this.toastService.error('ابتدا باید اقدام توسط اقدام کننده پایان یابد');
        return;
      }

      if (this.followups().length === 0) {
        this.toastService.error('حداقل یک پیگیری باید ثبت شود');
        return;
      }

      const message = 'آیا از اتمام پیگیری اطمینان دارید؟';
      const result = await this.swalService.fireSwal(message);

      if (result.isConfirmed) {
        try {
          await firstValueFrom(
            this.actionService.changeStatus(this.assignmentId(), true)
          );
          await this.loadAssignment();
          this.onDataChanged.emit();
        } catch (error) {
          console.error('Error changing follow status:', error);
          this.toastService.error('خطا در تغییر وضعیت پیگیری');
        }
      }
    } else if (assignment.isActor) {
      // بررسی پیش‌نیازهای اقدام
      if (!this.isMainActor()) {
        this.toastService.error('فقط اقدام کننده اصلی می‌تواند اقدام را پایان دهد');
        return;
      }

      if (this.actions().length === 0) {
        this.toastService.error('حداقل یک اقدام باید ثبت شود');
        return;
      }

      this.openResultModal();
    }
  }

  // ============= Result Modal Methods =============

  public openResultModal(): void {
    this.resetResultForm();
    const modal = document.getElementById('resultModal');
    if (modal) {
      this.resultModalInstance = new (window as any).bootstrap.Modal(modal);
      this.resultModalInstance.show();
    }
  }

  public closeResultModal(): void {
    if (this.resultModalInstance) {
      this.resultModalInstance.hide();
      this.resultModalInstance = null;
    }
    this.resetResultForm();
  }

  private resetResultForm(): void {
    this.resultStatus = '';
    this.resultDate = '';
    this.resultDescription = '';
  }

  private validateResultForm(): boolean {
    if (!this.resultStatus) {
      this.toastService.error('لطفاً نتیجه اقدام را انتخاب کنید');
      return false;
    }
    if (!this.resultDate) {
      this.toastService.error('لطفاً تاریخ را انتخاب کنید');
      return false;
    }
    if (!this.resultDescription.trim()) {
      this.toastService.error('لطفاً توضیحات را وارد کنید');
      return false;
    }
    return true;
  }

  public async submitResult(): Promise<void> {
    if (!this.validateResultForm()) return;

    this.isSavingResult.set(true);

    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      const actionData = {
        id: this.assignmentId(),
        description: this.resultDescription.trim(),
        date: this.resultDate,
        userGuid,
        result: this.resultStatus === 'done' ? '1' : '2',
        isMainActorEnding: true
      };

      await firstValueFrom(
        this.assignmentService.createActionResult(actionData)
      );

      // اطلاع‌رسانی به ارجاعات
      // if (this.referrals().length > 0) {
      //   try {
      //     await firstValueFrom(
      //       this.assignmentService.notifyReferralsActionEnded(this.assignmentId())
      //     );
      //   } catch (error) {
      //     console.error('Error notifying referrals:', error);
      //   }
      // }

      await this.loadAllData();

      this.closeResultModal();
      this.onDataChanged.emit();


      // بازگشت به صفحه قبل بعد از کمی تاخیر
      setTimeout(() => {
        this.onClose.emit();
      }, 1000);

    } catch (error) {
      console.error('Error submitting result:', error);
      this.toastService.error('خطا در ثبت نتیجه اقدام');
    } finally {
      this.isSavingResult.set(false);
    }
  }

  // ============= Referral Methods =============

  public toggleReferralForm(): void {
    if (!this.isMainActor() || this.isActionEnded()) {
      this.toastService.error('فقط اقدام کننده اصلی قبل از پایان اقدام می‌تواند ارجاع دهد');
      return;
    }

    this.showReferralForm.set(!this.showReferralForm());
    if (!this.showReferralForm()) {
      this.clearReferralForm();
    }
  }

  private clearReferralForm(): void {
    this.selectedUserUniqueKey = '';
    this.newDueDate = '';
    this.referralNote = '';
  }

  onReferralUserChange(selectedItem: any): void {
    const selectedKey = typeof selectedItem === 'string' ?
      selectedItem : selectedItem.uniqueKey;
    this.selectedUserUniqueKey = selectedKey;
  }

  public async createReferral(): Promise<void> {
    if (!this.selectedUserUniqueKey || !this.newDueDate) {
      this.toastService.error('لطفاً تمامی مقادیر ضروری را وارد کنید.');
      return;
    }

    const usersWithPos = this.usersWithPositions();
    const userWithPos = usersWithPos.find(
      u => u.uniqueKey === this.selectedUserUniqueKey
    );

    if (!userWithPos) {
      this.toastService.error('کاربر انتخاب شده معتبر نیست.');
      return;
    }

    const exists = this.referrals().some(x =>
      x.actorGuid === userWithPos.userGuid &&
      x.actorPositionGuid === userWithPos.positionGuid
    );

    if (exists) {
      this.toastService.error('کاربر انتخاب شده تکراری است.');
      return;
    }
    const positionGuid=this.localStorageService.getItem(POSITION_ID)
    try {
      const referralData = {
        parentAssignmentId: this.assignmentId(),
        actorGuid: userWithPos.userGuid,
        actorPositionGuid: userWithPos.positionGuid,
        referrerPositionGuid: positionGuid,
        dueDate: this.newDueDate,
        referralNote: this.referralNote
      };

      await firstValueFrom(
        this.assignmentService.createReferral(referralData)
      );

      await this.loadReferrals();
      this.toggleReferralForm();
      this.onDataChanged.emit();

    } catch (error) {
      console.error('Error creating referral:', error);
      this.toastService.error('خطا در ایجاد ارجاع');
    }
  }

  public async deleteReferral(referralId: number): Promise<void> {
    if (!this.isMainActor() || this.isActionEnded()) {
      this.toastService.error('امکان حذف ارجاع وجود ندارد');
      return;
    }

    const result = await this.swalService.fireSwal(
      'آیا از حذف این ارجاع اطمینان دارید؟'
    );

    if (result.isConfirmed) {
      try {
        await firstValueFrom(this.assignmentService.delete(referralId));
        await this.loadReferrals();
        this.onDataChanged.emit();
        this.toastService.success('ارجاع با موفقیت حذف شد');
      } catch (error) {
        console.error('Error deleting referral:', error);
        this.toastService.error('خطا در حذف ارجاع');
      }
    }
  }

  // ============= Utility Methods =============

  public getStatusClass(status: string): string {
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

  public getStatusText(status: string): string {
    switch (status) {
      case 'Done':
        return 'انجام شده';
      case 'InProgress':
        return 'در حال انجام';
      case 'NotDone':
        return 'انجام نشده';
      case 'FollowingUp':
        return 'در حال پیگیری';
      case 'NotFollowedUp':
        return 'پیگیری نشده';
      default:
        return status || 'نامشخص';
    }
  }

  public getOverallStatusClass(): string {
    const status = this.assignmentData().status;
    switch (status) {
      case 3:
        return 'bg-success text-white';
      case 1:
      case 2:
        return 'bg-warning text-dark';
      default:
        return 'bg-secondary text-white';
    }
  }

  public getOverallStatusIcon(): string {
    const status = this.assignmentData().status;
    switch (status) {
      case 3:
        return 'fa-check-circle';
      case 1:
      case 2:
        return 'fa-clock';
      default:
        return 'fa-question-circle';
    }
  }

  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement && imgElement.nextElementSibling instanceof HTMLElement) {
      imgElement.style.display = 'none';
      imgElement.nextElementSibling.style.display = 'flex';
    }
  }

  getUserPhotoUrl(personalNo: string): string {
    return `${environment.fileManagementEndpoint}/photo/${personalNo}.jpg`;
  }

  getUserInitials(userName: string): string {
    if (!userName) return '';
    const words = userName.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }

  getReferralUserUniqueKey(): string {
    return this.selectedUserUniqueKey;
  }

  public clearSearch(): void {
    this.searchReferral.set('');
  }

  // Tree statistics methods
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

  private countNodes(node: any): number {
    if (!node) return 0;
    return 1 + (node.children || []).reduce(
      (sum: number, child: any) => sum + this.countNodes(child), 0
    );
  }

  private countActions(node: any): number {
    if (!node) return 0;
    const nodeActions = (node.actions || []).length;
    const childrenActions = (node.children || []).reduce(
      (sum: number, child: any) => sum + this.countActions(child), 0
    );
    return nodeActions + childrenActions;
  }

  private countFollowups(node: any): number {
    if (!node) return 0;
    const nodeFollowups = (node.followups || []).length;
    const childrenFollowups = (node.children || []).reduce(
      (sum: number, child: any) => sum + this.countFollowups(child), 0
    );
    return nodeFollowups + childrenFollowups;
  }

  private collectUsers(node: any, users: Set<string>): void {
    if (!node) return;
    if (node.actorName) users.add(node.actorName);
    if (node.referrerName) users.add(node.referrerName);
    (node.actions || []).forEach((action: any) => {
      if (action.userName) users.add(action.userName);
    });
    (node.followups || []).forEach((followup: any) => {
      if (followup.userName) users.add(followup.userName);
    });
    (node.children || []).forEach((child: any) =>
      this.collectUsers(child, users)
    );
  }
}