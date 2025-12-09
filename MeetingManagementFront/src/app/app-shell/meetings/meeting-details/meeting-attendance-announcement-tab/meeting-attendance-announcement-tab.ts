import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { SwalService } from '../../../../services/framework-services/swal.service';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { MeetingService } from '../../../../services/meeting.service';
import { RoleService } from '../../../../services/role.service';
import { UserService } from '../../../../services/user.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { SystemUser } from '../../../../core/models/User';
import { USER_ID_NAME } from '../../../../core/types/configuration';
import { ComboBase } from '../../../../shared/combo-base';
import { CustomSelectComponent } from '../../../../shared/custom-controls/custom-select';
import { getClientSettings } from '../../../../services/framework-services/code-flow.service';

@Component({
  selector: 'app-meeting-attendance-announcement-tab',
  imports: [CustomSelectComponent, ReactiveFormsModule],
  templateUrl: './meeting-attendance-announcement-tab.html',
  styleUrl: './meeting-attendance-announcement-tab.css'
})
export class MeetingAttendanceAnnouncementTabComponent {
  // ═══════════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════════
  private readonly meetingMemberService = inject(MeetingMemberService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly meetingService = inject(MeetingService);
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly swalService = inject(SwalService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly roleService = inject(RoleService);

  // ═══════════════════════════════════════════════════════════════
  // Signals - Reactive State
  // ═══════════════════════════════════════════════════════════════
  readonly meetingGuid = signal<string>('');
  readonly meeting = signal<any>(null);
  readonly members = signal<MeetingMember[]>([]);
  readonly currentMember = signal<MeetingMember | null>(null);
  readonly users = signal<ComboBase[]>([]);
  readonly userList = signal<SystemUser[]>([]);
  readonly isSubstitute = signal<boolean>(false);
  readonly substituteName = signal<string>('');
  readonly attendance = signal<string | null>(null);
  readonly substitute = signal<string | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // Computed Properties
  // ═══════════════════════════════════════════════════════════════

  /** آیا گزینه جانشین فعال است */
  readonly substituteEnabled = computed(() => this.attendance() === 'notAttending');

  /** شناسه کاربر جاری */
  readonly currentUserGuid = computed(() =>
    this.localStorageService.getItem(USER_ID_NAME)
  );

  /** عضوی که کاربر جاری جانشین آن است */
  readonly replacementMember = computed(() => {
    const members = this.members();
    const userGuid = this.currentUserGuid();
    return members.find(member => member.replacementUserGuid === userGuid);
  });

  /**
   * ✅ لیست کاربران مجاز برای انتخاب به عنوان جانشین
   * 
   * فیلترها:
   * 1. خود کاربر فعلی نباید در لیست باشد
   * 2. کاربرانی که در حال حاضر جانشین کس دیگری هستند نباید در لیست باشند
   * 3. دبیر و رئیس جلسه نباید در لیست باشند (roleId = 1, 2, 3)
   */
  readonly filteredUsers = computed(() => {
    const members = this.members();
    const currentUserGuid = this.currentUserGuid();
    const currentMember = this.currentMember();
    const allUsers = this.userList();

    // اگر داده‌ای نیست، لیست خالی برگردان
    if (!currentMember || !allUsers.length) {
      return [];
    }

    // ═══════════════════════════════════════════════════════════════
    // مرحله 1: پیدا کردن کاربرانی که در حال حاضر جانشین کسی هستند
    // ═══════════════════════════════════════════════════════════════
    const usersWhoAreAlreadySubstitutes = new Set(
      members
        .filter(member => member.replacementUserGuid !== null && member.replacementUserGuid !== undefined)
        .map(member => member.replacementUserGuid)
    );

    // ═══════════════════════════════════════════════════════════════
    // مرحله 2: پیدا کردن اعضایی که دبیر یا رئیس جلسه هستند
    // ═══════════════════════════════════════════════════════════════
    const secretaryAndChairGuids = new Set(
      members
        .filter(member => [1, 2, 3].includes(member.roleId))
        .map(member => member.userGuid)
    );

    // ═══════════════════════════════════════════════════════════════
    // مرحله 3: فیلتر کردن کاربران
    // ═══════════════════════════════════════════════════════════════
    const eligibleUsers = allUsers.filter(user => {
      // ❌ خود کاربر فعلی نباشد
      if (user.guid === currentUserGuid) {
        return false;
      }

      // ❌ کاربرانی که در حال حاضر جانشین کس دیگری هستند
      if (usersWhoAreAlreadySubstitutes.has(user.guid)) {
        return false;
      }

      // ❌ دبیر یا رئیس جلسه نباشند
      if (secretaryAndChairGuids.has(user.guid)) {
        return false;
      }

      // ✅ این کاربر مجاز است
      return true;
    });

    // ═══════════════════════════════════════════════════════════════
    // مرحله 4: تبدیل به فرمت ComboBase
    // ═══════════════════════════════════════════════════════════════
    return eligibleUsers.map(user => ({
      guid: user.guid,
      title: user.name
    }));
  });

  // ═══════════════════════════════════════════════════════════════
  // Form
  // ═══════════════════════════════════════════════════════════════
  readonly replacementForm = this.fb.group({
    attendance: [''],
    replacementUserGuid: ['']
  });

  // ═══════════════════════════════════════════════════════════════
  // Constructor & Effects
  // ═══════════════════════════════════════════════════════════════
  constructor() {
    this.setupRouteEffect();
    this.setupMeetingDataEffect();
    this.setupFormUpdateEffect();
    this.setupUsersLoadEffect();
    this.setupUsersListEffect();
    this.setupFormControlStateEffect();
  }

  /** Effect برای هندل کردن تغییرات route parameter */
  private setupRouteEffect(): void {
    effect(() => {
      this.route.paramMap.subscribe(params => {
        const guid = params.get('guid') || '';
        this.meetingGuid.set(guid);
      });
    });
  }

  /** Effect برای همگام‌سازی با meeting behavior service */
  private setupMeetingDataEffect(): void {
    effect(() => {
      // همگام‌سازی داده‌های جلسه
      this.meeting.set(this.meetingBehaviorService.meeting());

      // همگام‌سازی داده‌های اعضا
      const members = this.meetingBehaviorService.members();
      this.members.set(members);

      // به‌روزرسانی عضو فعلی
      const userGuid = this.currentUserGuid();
      const currentMember = members.find(member => member.userGuid === userGuid);
      this.currentMember.set(currentMember || null);
    });
  }

  /** Effect برای به‌روزرسانی فرم وقتی عضو فعلی تغییر می‌کند */
  private setupFormUpdateEffect(): void {
    effect(() => {
      const currentMember = this.currentMember();
      const replacementMember = this.replacementMember();

      if (currentMember) {
        // تعیین وضعیت حضور
        const attendanceValue = currentMember.isAttendance === true
          ? 'attending'
          : currentMember.isAttendance === false
            ? 'notAttending'
            : '';

        this.replacementForm.patchValue({
          attendance: attendanceValue,
          replacementUserGuid: replacementMember ? replacementMember.userGuid : ''
        });

        // آیا کاربر جانشین کسی است؟
        this.isSubstitute.set(currentMember.replacementUserGuid !== null);

        // نام فردی که کاربر جانشین اوست
        if (currentMember.replacementUserGuid) {
          const originalMember = this.members().find(
            m => m.userGuid === currentMember.replacementUserGuid
          );
          this.substituteName.set(originalMember?.name || '');
        } else {
          this.substituteName.set('');
        }

        // به‌روزرسانی signal حضور
        this.attendance.set(
          currentMember.isAttendance === true
            ? 'attending'
            : currentMember.isAttendance === false
              ? 'notAttending'
              : null
        );
      }
    });
  }

  /** Effect برای لود کردن لیست کاربران */
  private setupUsersLoadEffect(): void {
    effect(() => {
      this.loadUsers();
    });
  }

  /** Effect برای به‌روزرسانی لیست کاربران dropdown */
  private setupUsersListEffect(): void {
    effect(() => {
      this.users.set(this.filteredUsers());
    });
  }

  /** Effect برای کنترل وضعیت enable/disable فرم */
  private setupFormControlStateEffect(): void {
    effect(() => {
      const meeting = this.meeting();
      const control = this.replacementForm.get('replacementUserGuid');

      if (meeting?.statusId === 2) {
        control?.enable({ emitEvent: false });
      } else {
        control?.disable({ emitEvent: false });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════

  /** تغییر وضعیت حضور */
  onAttendanceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.attendance.set(target.value);

    // اگر حضور دارد، جانشین را پاک کن
    if (target.value === 'attending') {
      this.substitute.set(null);
      this.replacementForm.get('replacementUserGuid')?.setValue(null);
    }
  }

  /** تغییر جانشین انتخاب شده */
  onReplacementUserChange(selectedUserGuid: string): void {
    if (!selectedUserGuid) return;

    const members = this.members();
    const selectedMember = members.find(member => member.userGuid === selectedUserGuid);

    if (selectedMember) {
      // ❌ بررسی: آیا این کاربر قبلاً جانشین کسی است؟
      if (selectedMember.replacementUserGuid) {
        this.swalService.fireDangeredSwal(
          'انتخاب جانشین',
          'این کاربر قبلاً جانشین انتخاب شده است'
        );
        this.replacementForm.get('replacementUserGuid')?.setValue(null);
        return;
      }

      // ❌ بررسی: آیا دبیر یا رئیس جلسه است؟
      if ([1, 2, 3].includes(selectedMember.roleId)) {
        this.swalService.fireDangeredSwal(
          'انتخاب جانشین',
          'دبیر یا رئیس جلسه نمی‌توانند به عنوان جانشین انتخاب شوند'
        );
        this.replacementForm.get('replacementUserGuid')?.setValue(null);
        return;
      }
    }

    // ❌ بررسی: آیا این کاربر جانشین کس دیگری است؟
    const isAlreadySubstitute = members.some(
      member => member.replacementUserGuid === selectedUserGuid
    );

    if (isAlreadySubstitute) {
      this.swalService.fireDangeredSwal(
        'انتخاب جانشین',
        'این کاربر در حال حاضر جانشین یکی از اعضا است'
      );
      this.replacementForm.get('replacementUserGuid')?.setValue(null);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════

  /** لود کردن لیست کاربران از سرور */
  private loadUsers(): void {
    const currentMember = this.currentMember();
    if (!currentMember) return;

    const clientId = getClientSettings().client_id ?? '';

    this.userService.getAllByClientId<SystemUser[]>(clientId).subscribe({
      next: (data: SystemUser[]) => {
        this.userList.set(data);
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.userList.set([]);
      }
    });
  }

  /** ثبت وضعیت حضور */
  submitAttendance(): void {
    const currentMember = this.currentMember();
    const userList = this.userList();

    if (!currentMember) {
      this.swalService.fireDangeredSwal('خطا', 'اطلاعات عضو یافت نشد');
      return;
    }

    const isAttending = this.attendance() === 'attending';
    const replacementUserGuid = this.replacementForm.value.replacementUserGuid;

    // ساخت body درخواست
    const body: any = {
      id: currentMember.id,
      isAttendance: isAttending
    };

    // اگر حضور ندارد و جانشین انتخاب کرده
    if (!isAttending && replacementUserGuid) {
      const replacementUser = userList.find(user => user.guid === replacementUserGuid);

      body.replacementUserGuid = replacementUserGuid;
      body.replacementPositionGuid = replacementUser?.positionGuid;
    }

    this.meetingMemberService.setSubstitute(body).subscribe({
      next: () => {
        location.reload();
      },
      error: (error) => {
        console.error('Error submitting attendance:', error);
        this.swalService.fireDangeredSwal('خطا', 'خطا در ثبت وضعیت حضور');
      }
    });
  }
}