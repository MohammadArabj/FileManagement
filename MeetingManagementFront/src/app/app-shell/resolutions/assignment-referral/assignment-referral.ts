import { Component, Input, Output, EventEmitter, OnInit, signal, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssignmentService } from '../../../services/assignment.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { firstValueFrom } from 'rxjs';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { UserService } from '../../../services/user.service';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { NgSelectComponent } from "@ng-select/ng-select";
import { SystemUser } from '../../../core/models/User';

@Component({
  selector: 'app-assignment-referral',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent],
  templateUrl: './assignment-referral.html',
  styleUrls: ['./assignment-referral.css']
})
export class AssignmentReferralComponent implements OnInit {
  // Injected services
  private readonly assignmentService = inject(AssignmentService);
  private readonly toastService = inject(ToastService);
  private readonly swalService = inject(SwalService);
  private readonly userService = inject(UserService);
  private readonly localStorageService = inject(LocalStorageService);

  // Inputs
  readonly assignmentId = input<number>(0);
  readonly canRefer = input<boolean>(false);

  // Outputs
  @Output() onClose = new EventEmitter<void>();
  @Output() onReferralCreated = new EventEmitter<void>();

  // State signals
  public referrals = signal<any[]>([]);
  public assignmentTree = signal<any>(null);
  public showReferralForm = signal<boolean>(false);
  public showTreeView = signal<boolean>(false);
  public loading = signal<boolean>(false);

  // Form controls for new referral
  public selectedUser = signal<string>('');
  public selectedPosition = signal<string>('');
  public referralNote = signal<string>('');
  public newDueDate = signal<string>('');

  // Available users and positions (should be loaded from services)
  public availableUsers = signal<SystemUser[]>([]);
  public availablePositions = signal<any[]>([]);

  ngOnInit(): void {
    this.loadReferrals();
    this.loadUsersAndPositions();
  }

  private async loadReferrals(): Promise<void> {
    if (!this.assignmentId()) return;

    try {
      this.loading.set(true);
      const referrals = await firstValueFrom(
        this.assignmentService.getReferrals(this.assignmentId())
      );
      this.referrals.set(referrals);
    } catch (error) {
      console.error('Error loading referrals:', error);
      this.toastService.error('خطا در بارگذاری ارجاعات');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadUsersAndPositions(): Promise<void> {
    try {
      // Load available users and positions from your services
      // This is a placeholder - implement according to your user management service
      const users = await this.userService.getAllByClientId(getClientSettings().client_id??'').toPromise()||[];
      const positions: any[] = []; // await this.positionService.getPositions();

      this.availableUsers.set(users);
    } catch (error) {
      console.error('Error loading users and positions:', error);
    }
  }

  public async loadAssignmentTree(): Promise<void> {
    if (!this.assignmentId()) return;

    try {
      this.loading.set(true);
      const tree = await firstValueFrom(
        this.assignmentService.getAssignmentTree(this.assignmentId())
      );
      this.assignmentTree.set(tree);
      this.showTreeView.set(true);
    } catch (error) {
      console.error('Error loading assignment tree:', error);
      this.toastService.error('خطا در بارگذاری درخت ارجاعات');
    } finally {
      this.loading.set(false);
    }
  }

  public toggleReferralForm(): void {
    this.showReferralForm.set(!this.showReferralForm());
    if (!this.showReferralForm()) {
      this.clearReferralForm();
    }
  }

  private clearReferralForm(): void {
    this.selectedUser.set('');
    this.selectedPosition.set('');
    this.referralNote.set('');
    this.newDueDate.set('');
  }

  public async createReferral(): Promise<void> {
    if (!this.selectedUser() || !this.referralNote().trim() || !this.newDueDate()) {
      this.toastService.error('لطفاً تمامی مقادیر ضروری را وارد کنید.');
      return;
    }
    var positionGuid = this.availableUsers().find(x => x.guid === this.selectedUser())?.positionGuid;
    try {
      const referralData = {
        parentAssignmentId: this.assignmentId(),
        actorGuid: this.selectedUser(),
        actorPositionGuid:positionGuid ,
        dueDate: this.newDueDate(),
        referralNote: this.referralNote()
      };

      await firstValueFrom(this.assignmentService.createReferral(referralData));

      await this.loadReferrals();
      this.toggleReferralForm();
      this.onReferralCreated.emit();
      this.toastService.success('ارجاع با موفقیت ایجاد شد');

    } catch (error) {
      console.error('Error creating referral:', error);
      this.toastService.error('خطا در ایجاد ارجاع');
    }
  }

  public async deleteReferral(referralId: number): Promise<void> {
    const result = await this.swalService.fireSwal('آیا از حذف این ارجاع اطمینان دارید؟');
    if (result.value === true) {
      try {
        await firstValueFrom(this.assignmentService.delete(referralId));
        await this.loadReferrals();
        this.toastService.success('ارجاع با موفقیت حذف شد');
      } catch (error) {
        console.error('Error deleting referral:', error);
        this.toastService.error('خطا در حذف ارجاع');
      }
    }
  }

  public viewReferralActions(referralId: number): void {
    // Navigate to actions view for this referral
    // Implementation depends on your routing strategy
  }

  public getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'انجام شده': 'badge bg-success',
      'انجام نشده': 'badge bg-danger',
      'در حال انجام': 'badge bg-warning',
      'پایان یافته': 'badge bg-secondary',
      'درحال پیگیری': 'badge bg-info',
      'پیگیری نشده': 'badge bg-warning',
      'پایان پیگیری': 'badge bg-secondary'
    };
    return statusClasses[status] || 'badge bg-secondary';
  }
}