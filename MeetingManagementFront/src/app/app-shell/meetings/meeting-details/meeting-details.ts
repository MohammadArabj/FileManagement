import { PasswordFlowService } from './../../../services/framework-services/password-flow.service';
import {
  Component,
  OnInit,
  signal,
  computed,
  effect,
  input,
  inject,
  DestroyRef
} from '@angular/core';
import { ParamMap, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MeetingService } from '../../../services/meeting.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { base64ToArrayBuffer, IsDeletage, ISSP, POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { Location } from '@angular/common';
import { CreatType } from '../../../core/types/enums';
import { MeetingMemberService } from '../../../services/meeting-member.service';
import { MeetingMember } from '../../../core/models/Meeting';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';
import { ResolutionService } from '../../../services/resolution.service';
import { FileService } from '../../../services/file.service';
import { catchError, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SwalService } from '../../../services/framework-services/swal.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { MeetingOpsComponent } from '../meeting-ops/meeting-ops';
import { MeetingBehaviorService } from './meeting-behavior-service';
import { MeetingDetailsTabComponent } from './meeting-details-tab/meeting-details-tab';
import { MeetingMembersTabComponent } from './meeting-members-tab/meeting-members-tab';
import { MeetingMinutesTabComponent } from './meeting-minutes-tab/meeting-minutes-tab';
import { MeetingContentTabComponent } from './meeting-content-tab/meeting-content-tab';
import { MeetingAttendanceAnnouncementTabComponent } from './meeting-attendance-announcement-tab/meeting-attendance-announcement-tab';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeetingAgendaTabComponent } from './meeting-agenda-tab/meeting-agenda-tab.component';

declare var $: any;
declare var Swal: any;

@Component({
  selector: 'app-meeting-details',
  templateUrl: './meeting-details.html',
  styleUrls: ['./meeting-details.css'],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MeetingContentTabComponent,
    MeetingMinutesTabComponent,
    MeetingOpsComponent,
    MeetingAgendaTabComponent,
    MeetingDetailsTabComponent,
    MeetingAttendanceAnnouncementTabComponent,
    MeetingMembersTabComponent
  ]
})
export class MeetingDetailsComponent implements OnInit {

  // Injected services
  private readonly route = inject(ActivatedRoute);
  private readonly meetingService = inject(MeetingService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly fileService = inject(FileService);
  private readonly swalService = inject(SwalService);
  private readonly toastService = inject(ToastService);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);


  // Private writable signals for internal state
  private readonly _meetingGuid = signal<string>('');
  private readonly _meetingTitle = signal<string>('');
  private readonly _activeTab = signal<string>('navs-meetingDetails');
  private readonly _permissions = signal<Set<string>>(new Set());
  private readonly _isDelegate = signal<boolean>(false);
  private readonly _buttonText = signal<string>('');
  private readonly _showButton = signal<boolean>(false);
  private readonly _buttonStatus = signal<number>(0);
  private readonly _checkChairman = signal<any>(null);
  private readonly _isSubstitute = signal<boolean>(false);
  readonly _loaded = signal(false);

  // Public readonly signals
  readonly meetingGuid = this._meetingGuid.asReadonly();
  readonly meetingTitle = this._meetingTitle.asReadonly();
  readonly activeTab = this._activeTab.asReadonly();
  readonly permissions = this._permissions.asReadonly();
  readonly isDelegate = this._isDelegate.asReadonly();
  readonly buttonText = this._buttonText.asReadonly();
  readonly showButton = this._showButton.asReadonly();
  readonly buttonStatus = this._buttonStatus.asReadonly();
  readonly checkChairman = this._checkChairman.asReadonly();
  readonly isSubstitute = this._isSubstitute.asReadonly();

  // Computed signals from behavior service
  readonly meeting = computed(() => this.meetingBehaviorService.meeting());
  readonly currentMember = computed(() => this.meetingBehaviorService.currentMember());
  readonly members = computed(() => this.meetingBehaviorService.members());
  readonly resolutions = computed(() => this.meetingBehaviorService.resolutions());
  readonly isBoardMeeting = computed(() => this.meetingBehaviorService.isBoardMeeting());

  readonly statusId = computed(() => this.meeting()?.statusId);
  readonly roleId = computed(() => this.meeting()?.roleId);

  // Constants
  readonly createType = CreatType.Edit;

  readonly steps = [
    { id: 2, label: 'ثبت اولیه', icon: '' },
    { id: 3, label: 'برگزار شده', icon: '' },
    { id: 4, label: 'ثبت نهایی', icon: '' },
    { id: 6, label: 'اتمام یافته', icon: '' }
  ];
  readonly boardMeetingsteps = [
    { id: 2, label: 'ثبت اولیه', icon: '' },
    { id: 3, label: 'برگزار شده', icon: '' },
    { id: 6, label: 'اتمام یافته', icon: '' }
  ];
  // Computed properties for UI logic
  readonly visibleMainTab = computed((): 'ops' | 'details' | null => {
    const isSuperAdmin = this.localStorageService.getItem(ISSP) === 'true';
    const currentMember = this.currentMember();
    const isDelegate = currentMember?.isDelegate ?? false;
    const statusId = this.statusId();
    const roleId = this.roleId();

    if (isSuperAdmin) {
      return 'ops';
    }

    const canShowMeetingOps =
      ![3, 4, 5, 6, 7].includes(statusId) &&
      [1, 2, 3].includes(roleId) &&
      !isDelegate;

    if (canShowMeetingOps) {
      return 'ops';
    }

    const canShowMeetingDetails =
      ([1, 2, 5, 3, 7].includes(statusId) && [0, 5].includes(roleId)) ||
      ([2, 3, 4, 5, 6, 7].includes(statusId) && [0, 1, 2, 3, 4, 5].includes(roleId)) ||
      ([1, 2, 3].includes(roleId) && isDelegate);

    if (canShowMeetingDetails) {
      return 'details';
    }

    return null;
  });

  readonly showMainTab = computed(() => this.visibleMainTab() !== null);

  constructor() {
    this.setupEffects();
  }

  private setupEffects(): void {
    //Effect to handle meeting GUID from input or route
    // effect(() => {
    //   const inputGuid = this.meetingGuidInput();
    //   if (inputGuid) {
    //     this._meetingGuid.set(inputGuid);
    //     this.getMeetingDetails();
    //   }
    // });

    // // Effect to update button configuration when meeting or members change
    effect(() => {
      const meeting = this.meeting();
      const currentMember = this.currentMember();
      const statusId = this.statusId();
      const roleId = this.roleId();

      if (meeting && statusId && roleId !== undefined) {
        this.updateButtonConfiguration();
      }
    });

    // // Effect to handle delegate status
    // effect(() => {
    //   const delegateStatus = this.localStorageService.getItem(IsDeletage) === 'true';
    //   this._isDelegate.set(delegateStatus);
    // });
  }

  ngOnInit(): void {
    // Only subscribe to route if no input is provided
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: ParamMap) => {
        const guid = params.get('guid');
        if (guid) {
          this._meetingGuid.set(guid);
          this.getMeetingDetails();
        }
      });

    this.loadPermissions();
  }

  private async loadPermissions(): Promise<void> {
    const permissionsToCheck = [
      'MT_Resolutions_Add',
      'MT_Resolutions_Edit',
      'MT_Resolutions_Delete',
      'MT_Resolutions_Assign',
      'MT_Resolutions_ViewFiles',
      'MT_Resolutions_DeleteFiles',
      'MT_Descriptions_Edit',
      'MT_Meetings_Hold',
      'MT_Meetings_FinalRegister',
      'MT_Meetings_Finalize'
    ];

    const newPermissions = new Set<string>();
    const isDelegateValue = this._isDelegate();

    for (const perm of permissionsToCheck) {
      const hasPermission = await this.passwordFlowService.checkPermission(perm);
      if (hasPermission && isDelegateValue) {
        newPermissions.add(perm);
      }
    }

    this._permissions.set(newPermissions);
  }

  goBack(): void {
    this.location.back();
  }
  // اضافه کردن computed signal جدید
  readonly hasChairmanSigned = computed(() => {
    const members = this.members();
    const chairman = members.find(m => m.roleId === 3);
    return chairman?.isSign === true;
  });

  // تغییر متد hasAccessToTab
  hasAccessToTab(tab: string): boolean {
    const isSuperAdmin = this.localStorageService.getItem(ISSP) === 'true';
    const currentMember = this.currentMember();
    const isDelegate = currentMember?.isDelegate;
    const isBoardMeeting = this.isBoardMeeting();
    const statusId = this.statusId();
    const roleId = this.roleId();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر کاربر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    const accessRules: { [key: string]: () => boolean } = {
      meetingDetails: () => [1, 2, 3, 4, 5, 6, 7].includes(statusId),
      adminAttendance: () => (isSuperAdmin && statusId > 2 && statusId != 5),
      agendas: () => (([2, 3, 4, 6].includes(statusId)) && roleId != 0) ,
      attendance: () => ((statusId === 2 && !isBoardMeeting) && roleId != 0),
      content: () => ((([3, 4, 6].includes(statusId)) && roleId != 0) || (isBoardMeeting && statusId === 2)) ,
      minutes: () => (([3, 4, 6].includes(statusId)) && roleId != 0 && !isBoardMeeting) ,
    };

    return accessRules[tab]?.() ?? false;
  }

  // تغییر متد updateButtonConfiguration
  private updateButtonConfiguration(): void {
    const statusId = this.statusId();
    const roleId = this.roleId();
    const isDelegateValue = this._isDelegate();
    const permissions = this._permissions();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده، همه دکمه‌ها فعال باشند
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    switch (statusId) {
      case 1:
        this._buttonText.set('ثبت اولیه');
        this._buttonStatus.set(2);
        this._showButton.set(
          isUnsignedChairman ||
          (isDelegateValue && permissions.has("MT_Meetings_Hold")) ||
          ([1, 2, 3].includes(roleId) && statusId === 1)
        );
        break;
      case 2:
        this._buttonText.set('برگزاری جلسه');
        this._buttonStatus.set(3);
        this._showButton.set(
          isUnsignedChairman ||
          (isDelegateValue && permissions.has("MT_Meetings_FinalRegister")) ||
          ([1, 2, 3].includes(roleId) && statusId === 2)
        );
        break;
      case 3:
        this._buttonText.set('ثبت نهایی');
        this._buttonStatus.set(4);
        this._showButton.set(
          isUnsignedChairman ||
          (isDelegateValue && permissions.has("MT_Meetings_Hold")) ||
          ([1, 2, 3].includes(roleId) && statusId === 3)
        );
        break;
      case 4:
        this._buttonText.set('اتمام جلسه');
        this._buttonStatus.set(6);
        this._showButton.set(
          isUnsignedChairman ||
          (isDelegateValue && permissions.has("MT_Meetings_Finalize")) ||
          ([1, 2, 3].includes(roleId) && statusId === 4)
        );
        break;
      default:
        this._buttonText.set('');
        this._showButton.set(false);
        break;
    }
  }

  private hasPermission(permission: string): boolean {
    return this._permissions().has(permission);
  }

  getTabVisibility(tab: string): boolean {
    const currentMember = this.currentMember();
    const isDelegate = !!currentMember?.isDelegate;
    const isSuperAdmin = this.localStorageService.getItem(ISSP) === 'true';
    const isBoardMeeting = this.isBoardMeeting();
    const statusId = this.statusId();

    const visibilityRules: Record<string, () => boolean> = {
      main: () => [1, 2, 3, 4, 5, 6, 7].includes(statusId),
      adminAttendance: () => isSuperAdmin && statusId > 2,
      attendance: () => statusId === 2,
      agenda: () => [1, 2, 3, 4, 6].includes(statusId),
      content: () => ([3, 4, 6].includes(statusId)) || (isBoardMeeting && statusId === 2),
      minutes: () => [3, 4, 6].includes(statusId) && !isBoardMeeting,
    };

    return visibilityRules[tab]?.() ?? false;
  }



  changeStatus(status: number): void {
    const meetingGuid = this._meetingGuid();

    if (status === 6 && !this.isBoardMeeting()) {
      this.meetingService.checkSign(meetingGuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data) => {
          if (data === false) {
            Swal.fire({
              title: "خطا",
              text: "جهت اتمام جلسه ،امضای همه اعضای حاضر جلسه الزامی است",
              icon: "error",
              confirmButtonText: "باشه",
            });
            return;
          }
          this.performStatusChange(status);
        });
      return;
    }

    if (status === 4) {
      this.meetingService.checkMeeting(meetingGuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data) => {
          if (data.existResolution === false) {
            Swal.fire({
              title: "خطا",
              text: "بدون شرح جلسه یا ثبت مصوبه امکان ثبت نهایی جلسه وجود ندارد",
              icon: "error",
              confirmButtonText: "باشه",
            });
            return;
          }
          else if (data.attendance === false) {
            Swal.fire({
              title: "خطا",
              text: 'بدون ثبت حضور وغیاب اعضای جلسه امکان ثبت نهایی جلسه وجود ندارد',
              icon: "error",
              confirmButtonText: "باشه",
            });
            return;
          }
          this.performStatusChange(status);
        });
      return;
    }

    this.performStatusChange(status);
  }

  private performStatusChange(status: number): void {
    this.swalService.fireSwal('آیا از انجام عملیات اطمینان دارید؟').then((result: any) => {
      if (result.value === true) {
        const meetingGuid = this._meetingGuid();
        this.meetingService.changeStatus(meetingGuid, status)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              location.reload();
            },
            error: () => {
              this.toastService.error('خطا در تغییر وضعیت جلسه.');
            }
          });
      } else {
        this.swalService.dismissSwal(result);
      }
    });
  }

  getMeetingDetails(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const isSuperAdmin = this.localStorageService.getItem(ISSP) === 'true';
    const meetingGuid = this._meetingGuid();

    if (!meetingGuid) return;

    const resolutions = this.resolutionService.getListBy(meetingGuid);
    const meetingRequest = this.meetingService.getUserMeeting(meetingGuid, userGuid, positionGuid, isSuperAdmin);
    //    const membersRequest = this.memberService.getUserList(meetingGuid, userGuid);

    forkJoin([meetingRequest, resolutions])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([meetingData, resolutions]: [any, any]) => {
        this.meetingBehaviorService.setMeeting(meetingData);

        this._meetingTitle.set(meetingData.title);
        this.breadcrumbService.setItems([
          { label: 'جلسات', routerLink: '/meetings/list' },
          { label: `جلسه ${meetingData.title}`, routerLink: `/meetings/details/${meetingGuid}` },
        ]);
        this.meetingBehaviorService.setBoardMeetingResult(meetingData.categoryGuid === environment.boardCategoryGuid)
        this.meetingBehaviorService.setResolutions(resolutions);
        this.loadMembers(meetingGuid, userGuid);
      });
  }
  private loadMembers(meetingGuid: string, userGuid: string) {
    this.memberService.getUserList(meetingGuid, userGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((membersData: MeetingMember[]) => {

        // Sort members by role priority
        const rolePriority: { [key: number]: number } = { 3: 1, 1: 2, 2: 3, 4: 4, 5: 5, 6: 6 };
        membersData = membersData.slice().sort((a: MeetingMember, b: MeetingMember) => {
          const aPriority = rolePriority[a.roleId] ?? 99;
          const bPriority = rolePriority[b.roleId] ?? 99;
          return aPriority - bPriority;
        });

        const requests = membersData.map((member) => {
          if (member.replacementUserGuid) {
            member.substitute = membersData.find(m => m.userGuid === member.replacementUserGuid)?.name || '';
          }

          if (member.profileGuid) {
            return this.fileService.getFileDetails(member.profileGuid).pipe(
              catchError(() => of(null)),
              map(file => {
                if (file) {
                  const arrayBuffer = base64ToArrayBuffer(file.file);
                  const blob = new Blob([arrayBuffer], { type: file.contentType });
                  member.image = URL.createObjectURL(blob);
                }
                return member;
              })
            );
          } else {
            member.image = environment.fileManagementEndpoint + '/photo/' + member.userName + '.jpg';
            return of(member);
          }
        });

        forkJoin(requests)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((resolvedMembers: MeetingMember[]) => {
            this.meetingBehaviorService.setMembers(resolvedMembers);

            const currentMember = resolvedMembers.find(m => m.userGuid === userGuid);
            if (currentMember) {
              currentMember.isDelegate = resolvedMembers.some(m => m.replacementUserGuid === currentMember.userGuid);
              this.meetingBehaviorService.setCurrentMember(currentMember);
            }
            this._loaded.set(true);

          });
      });
  }


  // Method to update active tab
  setActiveTab(tab: string): void {
    this._activeTab.set(tab);
  }
}
