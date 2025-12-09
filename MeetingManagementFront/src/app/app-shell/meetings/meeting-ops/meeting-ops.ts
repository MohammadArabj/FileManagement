import { PasswordFlowService } from './../../../services/framework-services/password-flow.service';
import {
  Component,
  ElementRef,
  input,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  viewChild,
  output,
  OnInit,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroup,
  FormArray,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { map, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { CommonModule, NgClass } from '@angular/common';

import { MeetingMember } from '../../../core/models/Meeting';
import { Position, SystemUser } from '../../../core/models/User';
import { BoardMember } from '../../../core/models/BoardMember';
import { ComboBase } from '../../../shared/combo-base';
import { ConflictResult } from '../../../core/types/conflict-result';
import { CreatType } from '../../../core/types/enums';

import { CategoryService } from '../../../services/category.service';
import { FileService } from '../../../services/file.service';
import { MeetingService } from '../../../services/meeting.service';
import { RoomService } from '../../../services/room.service';
import { UserService } from '../../../services/user.service';
import { BoardMemberService } from '../../../services/board-member.service';
import { MeetingMemberService } from '../../../services/meeting-member.service';
import { CategoryPermissionService } from '../../../services/category-permission.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { ToastService } from '../../../services/framework-services/toast.service';

import { CustomSelectComponent } from "../../../shared/custom-controls/custom-select";
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MeetingBehaviorService } from '../meeting-details/meeting-behavior-service';
import { MeetingParticipantsComponent } from './meeting-participants/meeting-participants';
import { MeetingAgendasComponent } from './meeting-agendas/meeting-agendas';

import {
  base64ToArrayBuffer,
  generateGuid,
  POSITION_ID,
  USER_ID_NAME
} from '../../../core/types/configuration';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { environment } from '../../../../environments/environment';
import { FileDetails } from '../../../core/types/file';
import { AgendaService } from '../../../services/agenda.service';

// ===== INTERFACES =====
interface MeetingFormData {
  guid: string;
  title: string;
  categoryGuid: string;
  roomGuid: string;
  roomName: string;
  roomLink: string;
  number: string;
  locationType: string;
  date: string;
  startTime: string;
  endTime: string;
  followGuid: string;
  notAllowReplacement: boolean;
}

interface LoadedMeetingData {
  meeting: any;
  members: MeetingMember[];
  agendas: any[];
}

@Component({
  selector: 'app-meeting-ops',
  templateUrl: './meeting-ops.html',
  imports: [
    CustomSelectComponent,
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    RouterLink,
    CommonModule,
    MeetingParticipantsComponent,
    MeetingAgendasComponent,
    NgClass
  ],
  standalone: true,
  styleUrls: ['./meeting-ops.css']
})
export class MeetingOpsComponent implements OnInit {


  // ===== DEPENDENCY INJECTION =====
  private readonly fb = inject(FormBuilder);
  private readonly meetingService = inject(MeetingService);
  private readonly roomService = inject(RoomService);
  private readonly categoryService = inject(CategoryService);
  private readonly userService = inject(UserService);
  private readonly boardMemberService = inject(BoardMemberService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly categoryPermissionService = inject(CategoryPermissionService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly fileService = inject(FileService);
  private readonly agendaService = inject(AgendaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly swalService = inject(SwalService);
  private readonly toastService = inject(ToastService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly destroyRef = inject(DestroyRef);

  // ===== INPUT SIGNALS =====
  readonly createType = input<CreatType>(CreatType.Create);

  // ===== OUTPUT SIGNALS =====
  readonly membersUpdated = output<MeetingMember[]>();

  // ===== PRIVATE SIGNALS =====
  private readonly _meetingGuid = signal<string>('');
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isBoardMeetingCategory = signal<boolean>(false);

  // Data signals
  private readonly _categories = signal<ComboBase[]>([]);
  private readonly _rooms = signal<ComboBase[]>([]);
  private readonly _systemUsers = signal<SystemUser[]>([]);
  private readonly _boardMembers = signal<BoardMember[]>([]);
  private readonly _availableUsers = signal<SystemUser[]>([]);
  private readonly _allUsers = signal<SystemUser[]>([]);
  private readonly _meetings = signal<ComboBase[]>([]);
  private readonly _selectedMembers = signal<MeetingMember[]>([]);
  private readonly _conflictedUsers = signal<any[]>([]);
  private readonly _fileStorage = signal<{ [key: string]: { profile?: File; signature?: File } }>({});

  // Form state signals
  private readonly _isFollowUp = signal<boolean>(false);
  private readonly _isFollowUpChecked = signal<boolean>(false);

  // ===== PUBLIC COMPUTED SIGNALS =====
  readonly categories = this._categories.asReadonly();
  readonly rooms = this._rooms.asReadonly();
  readonly systemUsers = this._systemUsers.asReadonly();
  readonly boardMembers = this._boardMembers.asReadonly();
  readonly availableUsers = this._availableUsers.asReadonly();
  readonly meetings = this._meetings.asReadonly();
  readonly selectedMembers = this._selectedMembers.asReadonly();
  readonly conflictedUsers = this._conflictedUsers.asReadonly();
  readonly fileStorage = this._fileStorage.asReadonly();
  readonly meetingGuid = this._meetingGuid.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isBoardMeetingCategory = this._isBoardMeetingCategory.asReadonly();
  readonly isFollowUp = this._isFollowUp.asReadonly();
  readonly isFollowUpChecked = this._isFollowUpChecked.asReadonly();
  readonly allUsers = this._allUsers.asReadonly();
  // MeetingOpsComponent.ts


  readonly hasConflicts = computed(() => {
    const conflicts = this._conflictedUsers();
    const roomConflict = this.meetingForm?.get('roomGuid')?.hasError('conflict');

    // بررسی اینکه آیا کاربران در تداخل هنوز در لیست اعضای فعال هستند
    const activeMembers = this._selectedMembers().filter(m => !m.isRemoved);
    const activeUserGuids = activeMembers
      .map(m => m.userGuid)
      .filter(guid => guid);

    // فقط تداخل‌های مربوط به اعضای فعال را در نظر بگیر
    const activeConflicts = conflicts.filter(conflict =>
      activeUserGuids.includes(conflict.userGuid)
    );

    return activeConflicts.length > 0 || !!roomConflict;
  });

  readonly canSubmit = computed(() => {
    return this.meetingForm?.valid && !this.hasConflicts() && !this._isLoading();
  });

  readonly hasSecretary = computed(() => {
    return this._selectedMembers().some(member =>
      (member.roleId === 1 || member.roleId === 2) && !member.isRemoved
    );
  });

  readonly hasChairman = computed(() => {
    return this._selectedMembers().some(member =>
      member.roleId === 3 && !member.isRemoved
    );
  });

  // ===== FORM MANAGEMENT =====
  meetingForm!: FormGroup;
  agendas!: FormArray;

  // ===== CONSTANTS =====
  readonly locationTypes = [
    { guid: 'internal', title: 'حضوری درون شرکت' },
    { guid: 'external', title: 'بیرون از شرکت' },
    { guid: 'online', title: 'آنلاین' },
  ];

  // ===== REACTIVE SUBJECTS =====
  private readonly conflictCheck$ = new Subject<string>();
  // ===== LIFECYCLE METHODS =====
  constructor() {
    this.initializeBreadcrumbs();
    this.initializeForm();
    this.setupConflictChecking();
    this.setupEffects();
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.subscribeToRouteParams();
    this.loadMeetingsList();
  }

  // ===== INITIALIZATION METHODS =====
  private initializeBreadcrumbs(): void {
    this.breadcrumbService.setItems([
      { label: 'جلسات', routerLink: '/meetings/list' },
      { label: 'ثبت جلسه', routerLink: '/meetings/ops' }
    ]);
  }

  private initializeForm(): void {
    this.meetingForm = this.fb.group({
      guid: [''],
      title: ['', Validators.required],
      categoryGuid: [undefined],
      roomGuid: [undefined],
      roomName: [''],
      roomLink: [''],
      number: [''],
      locationType: ['internal'],
      date: ['', Validators.required],
      startTime: ['', this.timeFormatValidator()],
      endTime: ['', this.timeFormatValidator()],
      followGuid: [''],
      notAllowReplacement: [false],
      agendas: this.fb.array([])
    }, { validators: this.timeRangeValidator });

    this.agendas = this.meetingForm.get('agendas') as FormArray;
  }
  

  private setupConflictChecking(): void {
    this.conflictCheck$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.performConflictCheck());
  }
  operationMode = this.createType;
  // private setupEffects(): void {
  //   // Effect برای تغییرات route parameters
  //   effect(() => {
  //     const paramMap = this.route.snapshot.paramMap;
  //     const guid = paramMap.get('guid') || '';

  //     if (guid !== this._meetingGuid()) {
  //       this._meetingGuid.set(guid);
  //       if (guid) {

  //         untracked(() => this.loadMeeting());
  //       }
  //     }
  //   });

  //   // Effect برای تغییرات category
  //   effect(() => {
  //     const selectedCategoryId = this.meetingForm?.get('categoryGuid')?.value;
  //     if (selectedCategoryId) {
  //       this.handleCategoryChange(selectedCategoryId);
  //     }
  //   });
  // }

  private subscribeToRouteParams(): void {
    this.route.paramMap
      .pipe(
        map(params => params.get('guid') || ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(guid => {
        this._meetingGuid.set(guid);
        if (guid) {
          this.loadMeeting();
        }
      });
  }

  // ===== DATA LOADING METHODS =====
  private async loadInitialData(): Promise<void> {
    //this._isLoading.set(true);

    try {
      await Promise.all([
        this.loadRooms(),
        this.loadCategories(),
        this.loadSystemUsers(),
        this.loadBoardMembers(),
        this.loadAllUsers()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.toastService.error('خطا در بارگذاری اطلاعات اولیه');
    } finally {
      // this._isLoading.set(false);
    }
  }

  private async loadRooms(): Promise<void> {
    try {
      const rooms = await this.roomService.getForCombo<ComboBase[]>().toPromise() || [];
      this._rooms.set(rooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
      this._rooms.set([]);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      const categories = await this.categoryService.getForComboByCondition<ComboBase[]>(hasPermission).toPromise() || [];
      this._categories.set(categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      this._categories.set([]);
    }
  }
  private async loadAllUsers(): Promise<void> {
    try {
      const users = await this.userService.getAll<SystemUser[]>().toPromise() || [];

      const processedUsers = this.processUsersForMultiPosition(users)

      this._allUsers.set(processedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      this._systemUsers.set([]);
    }
  }
  private async loadSystemUsers(): Promise<void> {
    try {
      const clientId = getClientSettings().client_id ?? '';
      const users = await this.userService.getAllByClientId<SystemUser[]>(clientId).toPromise() || [];

      const processedUsers = this.processUsersForMultiPosition(users);

      this._systemUsers.set(processedUsers);
      this.updateAvailableUsers();
    } catch (error) {
      console.error('Error loading users:', error);
      this._systemUsers.set([]);
    }
  }

  private processUsersForMultiPosition(users: SystemUser[]): SystemUser[] {
    return users.flatMap(user => {
      if (user.positions && user.positions.length > 0) {
        return user.positions.map((position: Position) => ({
          guid: `${user.guid}_${position.positionGuid}`, // composite
          name: user.name,
          userName: user.userName,
          positions: [position],
          positionGuid: position.positionGuid,
          position: position.positionTitle,
          image: user.userName ? `${environment.fileManagementEndpoint}/photo/${user.userName}.jpg` : 'img/default-avatar.png',
          isSystem: true,
          baseUserGuid: user.guid // اصلی
        }));
      }
      // بدون سمت
      return [{
        ...user,
        guid: user.guid, // همان اصلی
        positionGuid: '',
        position: 'بدون سمت',
        image: user.userName ? `${environment.fileManagementEndpoint}/photo/${user.userName}.jpg` : 'img/default-avatar.png',
        isSystem: true,
        baseUserGuid: user.guid
      }];
    });
  }

  private async loadBoardMembers(): Promise<void> {
    try {
      const boardMembers = await this.boardMemberService.getList<BoardMember[]>().toPromise() || [];
      this._boardMembers.set(boardMembers);
    } catch (error) {
      console.error('Error loading board members:', error);
      this._boardMembers.set([]);
    }
  }

  private async loadMeetingsList(): Promise<void> {
    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');

      const filter = {
        userGuid,
        positionGuid,
        filterType: 'All',
        canViewAll: hasPermission
      };

      const meetings = (await this.meetingService.getMeetings(filter).toPromise()) as any[] || [];
      const processedMeetings = meetings
        .filter((meeting: any) => meeting.guid !== this._meetingGuid())
        .map((meeting: any) => ({
          guid: meeting.guid,
          title: `${meeting.number} - ${meeting.title}`
        }));

      this._meetings.set(processedMeetings);
    } catch (error) {
      console.error('Error loading meetings list:', error);
      this._meetings.set([]);
    }
  }

  private async loadMeeting(): Promise<void> {
    if (this._isLoading()) return;

    const meetingGuid = this._meetingGuid();
    if (!meetingGuid) return;

    this._isLoading.set(true);

    try {
      const meetingData = await this.loadMeetingData(meetingGuid);
      if (meetingData) {
        await this.processMeetingData(meetingData);
      }
    } catch (error) {
      console.error('Error loading meeting:', error);
      this.toastService.error('خطا در بارگذاری جلسه');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async loadMeetingData(meetingGuid: string): Promise<LoadedMeetingData | null> {
    try {
      const meeting = await this.meetingService.getForEdit<any>(meetingGuid).toPromise();
      if (!meeting) return null;

      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      let members: MeetingMember[] = [];

      // بارگذاری اعضا بر اساس حالت عملیات
      const isCloneOperation = this.router.url.includes('/clone/');

      if (this.createType() === CreatType.Edit) {
        // برای ویرایش: بارگذاری اعضای واقعی جلسه
        members = this.meetingBehaviorService.members() || [];
        // members = await this.memberService.getUserList(meetingGuid, userGuid).toPromise() || [];

      } else if (isCloneOperation) {
        // برای کپی: بارگذاری اعضا برای کپی کردن
        members = await this.memberService.getUserList(meetingGuid, userGuid).toPromise() || [];
      }

      return {
        meeting,
        members,
        agendas: meeting?.agendas
      };
    } catch (error) {
      console.error('Error loading meeting data:', error);
      return null;
    }
  }

  private async loadAuthorizedUsers(categoryId: string): Promise<SystemUser[]> {
    try {
      const permissions = await this.categoryPermissionService.getByCategoryGuid(categoryId).toPromise();
      if (!permissions || permissions.length === 0) {
        return [];
      }
      const clientId = getClientSettings()?.client_id ?? '';
      const allUsers = await this.userService.getAllByClientId(clientId).toPromise() || [];
      if (!allUsers) {
        return [];
      }
      const processedUsers = this.processUsersForMultiPosition(allUsers);

      const authorizedPositionGuids = permissions.map(p => p.positionGuid);
      const authorizedUsers = processedUsers.filter(user => {
        const userPositionGuid = user.positionGuid ? user.positionGuid.toLowerCase() : '';
        const isAuthorized = authorizedPositionGuids
          .filter(posGuid => !!posGuid)
          .map(posGuid => posGuid.toLowerCase())
          .includes(userPositionGuid);
        return isAuthorized;
      });
      // Process به composite
      return authorizedUsers;
    } catch (error) {
      console.error('خطا در بارگذاری کاربران مجاز:', error);
      return [];
    }
  }

  // به‌روزرسانی mergeSystemAndAuthorizedUsers (حالا هر دو processed)
  private async mergeSystemAndAuthorizedUsers(authorizedUsers: SystemUser[]): Promise<SystemUser[]> {
    const boardMembers = this._boardMembers();

    // boardAsUsers با guid اصلی board (نه composite، چون board جدا)
    const boardAsUsers: SystemUser[] = await Promise.all(boardMembers.map(async bm => ({
      guid: bm.guid || bm.id || generateGuid(), // اصلی board
      name: bm.fullName,
      userName: '',
      position: bm.position || '',
      positionGuid: '',
      image: await this.loadBoardMemberImageUrl(bm.profileImageGuid ?? ''),
      isSystem: false, // board
      baseUserGuid: undefined // no base for board
    })));

    // ترکیب: unique بر اساس guid (composite برای system، اصلی برای board)
    const allUsers = [...boardAsUsers, ...authorizedUsers];
    const uniqueUsers = new Map<string, SystemUser>();
    allUsers.forEach(user => {
      if (!uniqueUsers.has(user.guid)) {
        uniqueUsers.set(user.guid, { ...user });
      } else {
        // merge info اگر لازم (مثل image)
        const existing = uniqueUsers.get(user.guid)!;
        uniqueUsers.set(user.guid, { ...existing, image: user.image || existing.image });
      }
    });

    return Array.from(uniqueUsers.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }

  private async processExistingMembers(members: MeetingMember[]): Promise<MeetingMember[]> {
    const processedMembers: MeetingMember[] = [];
    const processedUsers = this._systemUsers(); // composite
    const processAllUsers = this._allUsers();
    const boardMembers = this._boardMembers();

    for (const member of members) {
      let processedMember = { ...member };

      // برای board members
      if (member.boardMemberGuid) {
        const boardMember = boardMembers.find(bm =>
          bm.guid === member.boardMemberGuid || bm.id === member.boardMemberGuid
        );
        if (boardMember) {
          processedMember.name = boardMember.fullName;
          processedMember.position = boardMember.position || '';
        }
      }
      // برای system users، compositeGuid set کن بر اساس positionGuid
      else if (member.userGuid) {
        const matchingEntry = processAllUsers.find(u =>
          u.baseUserGuid === member.userGuid &&
          (member.positionGuid ? u.positionGuid === member.positionGuid : !u.positionGuid)
        );

        if (matchingEntry) {
          processedMember.guid = matchingEntry.guid; // composite
          processedMember.position = matchingEntry.position;
          processedMember.positionGuid = matchingEntry.positionGuid;
        } else {
          // اگر پیدا نشد، از اطلاعات موجود استفاده کن
          console.warn(`User position not found for: ${member.name}, keeping original position`);
          processedMember.position = member.position || '';
        }
      }

      // بقیه process (substitute, image) unchanged
      if (member.replacementUserGuid) {
        const selectedMembers = this._selectedMembers();
        processedMember.substitute = selectedMembers.find(m => m.userGuid === member.replacementUserGuid)?.name || '';
      }
      if (member.profileGuid) {
        try {
          processedMember.image = await this.loadMemberProfileImage(member.profileGuid);
        } catch (error) {
          processedMember.image = this.getDefaultMemberImage(member);
        }
      } else {
        processedMember.image = this.getDefaultMemberImage(member);
      }

      processedMembers.push(processedMember);
    }

    return processedMembers;
  }

  private async setupAvailableUsersForMeeting(isBoardCategory: boolean, categoryGuid: string): Promise<void> {
    if (isBoardCategory) {
      try {
        // برای جلسات هیئت مدیره: ترکیب اعضای هیئت مدیره و کاربران مجاز
        const [authorizedUsers] = await Promise.all([
          this.loadAuthorizedUsers(categoryGuid)
        ]);

        // ترکیب کاربران سیستم با کاربران مجاز (بدون تکرار)
        const combinedUsers = this.mergeSystemAndAuthorizedUsers(authorizedUsers);
        this._availableUsers.set(await combinedUsers);
      } catch (error) {
        console.error('Error setting up board meeting users:', error);
        this._availableUsers.set([...this._systemUsers()]);
      }
    } else {
      // برای جلسات عادی: همه کاربران سیستم
      this._availableUsers.set(this._systemUsers().map(user => ({
        ...user,
        image: user.userName ? `${environment.fileManagementEndpoint}/photo/${user.userName}.jpg` : 'img/default-avatar.png',
        isSystem: true
      })));
    }
  }

  private async processMembersData(members: MeetingMember[], isCloneMode: boolean): Promise<MeetingMember[]> {
    if (isCloneMode) {
      // در حالت کپی: به‌روزرسانی اطلاعات اعضا با داده‌های فعلی
      return this.updateMembersForClone(members);
    } else {
      // در حالت ویرایش: پردازش عادی اعضا
      return this.processExistingMembers(members);
    }
  }
  // ===== CATEGORY HANDLING =====
  private async handleCategoryChange(selectedCategoryId: string): Promise<void> {
    const prevIsBoard = this._isBoardMeetingCategory();
    const isBoardCategory = selectedCategoryId === environment.boardCategoryGuid;

    this._isBoardMeetingCategory.set(isBoardCategory);
    this._availableUsers.set([]);
    await this.updateAvailableUsers();

    // ✅ شماره جلسه فقط برای هیئت‌مدیره required باشد
    this.applyBoardNumberValidator(isBoardCategory);

    const isCreateNew = this.createType() === CreatType.Create && !this._meetingGuid();

    if (isBoardCategory && isCreateNew) {
      // فقط وقتی از غیرهیئت -> هیئت می‌رویم اعضا را پاک/اتو انتخاب کن
      if (!prevIsBoard) this._selectedMembers.set([]);
      await this.autoSelectBoardMembers();
      return;
    }

    // اگر از هیئت -> عادی برگشتیم، اعضای خودکار هیئت را پاک کن
    if (!isBoardCategory && prevIsBoard) {
      this._selectedMembers.set([]);
    }

    // ✅ اگر عادی -> عادی تغییر کرد، اعضا حفظ شوند (هیچ کاری نکن)
  }

  private applyBoardNumberValidator(isBoard: boolean): void {
    const numberCtrl = this.meetingForm.get('number');
    if (!numberCtrl) return;

    if (isBoard) {
      numberCtrl.setValidators([Validators.required]);
    } else {
      numberCtrl.clearValidators();
      numberCtrl.setValue('', { emitEvent: false });
    }
    numberCtrl.updateValueAndValidity({ emitEvent: false });
  }
  private async updateAvailableUsers(): Promise<void> {
    const isBoardCategory = this._isBoardMeetingCategory();
    const selectedCategoryId = this.meetingForm?.get('categoryGuid')?.value;
    this._availableUsers.set([]);

    if (isBoardCategory && selectedCategoryId) {
      await this.setupAvailableUsersForMeeting(true, selectedCategoryId);
    } else {
      this._availableUsers.set([...this._systemUsers()]);
    }
  }


  private async autoSelectBoardMembers(): Promise<void> {
    const boardMembers = this._availableUsers();
    if (boardMembers.length === 0) return;

    const autoSelectedMembers: MeetingMember[] = [];

    for (const boardMember of boardMembers) {
      const memberData: MeetingMember = {
        id: 0,
        guid: generateGuid(),
        boardMemberGuid: boardMember.isSystem === false ? boardMember.guid : null,
        userGuid: boardMember.isSystem === true ? boardMember.baseUserGuid : undefined,
        positionGuid: boardMember.isSystem === true ? boardMember.positionGuid : null,
        name: boardMember.name,
        position: boardMember.position || '',
        roleId: 5, // عضو عادی
        isExternal: false,
        isRemoved: false,
        image: boardMember.image,
        isSystem: boardMember.isSystem
      };



      autoSelectedMembers.push(memberData);
    }

    this._selectedMembers.set(autoSelectedMembers);
  }

  // ===== IMAGE LOADING UTILITIES =====
  private async loadBoardMemberImageUrl(profileImageGuid: string): Promise<string> {
    try {
      const file = await this.fileService.getFileDetails(profileImageGuid).toPromise() as FileDetails;
      if (!file) {
        return 'img/default-avatar.png';
      }

      const blob = new Blob([base64ToArrayBuffer(file.file)], { type: file.contentType });
      return URL.createObjectURL(blob);
    } catch (error) {
      return 'img/default-avatar.png';
    }
  }

  private async loadMemberProfileImage(profileGuid: string): Promise<string> {
    try {
      const file = await this.fileService.getFileDetails(profileGuid).toPromise() as FileDetails;
      if (!file) {
        return 'img/default-avatar.png';
      }

      const blob = new Blob([base64ToArrayBuffer(file.file)], { type: file.contentType });
      return URL.createObjectURL(blob);
    } catch (error) {
      return 'img/default-avatar.png';
    }
  }

  private getDefaultMemberImage(member: MeetingMember): string {
    if (this._isBoardMeetingCategory() && member.boardMemberGuid) {
      return 'img/default-avatar.png';
    }

    if (member.userName) {
      return `${environment.fileManagementEndpoint}/photo/${member.userName}.jpg`;
    }

    return 'img/default-avatar.png';
  }

  // ===== FORM PATCHING METHODS =====
  private patchMeetingForm(meeting: any, formatTime: (time: string) => string): void {
    this.meetingForm.patchValue({
      guid: meeting.guid,
      title: meeting.title,
      categoryGuid: meeting.categoryGuid,
      roomGuid: meeting.roomGuid,
      roomName: meeting.roomName,
      roomLink: meeting.roomLink,
      locationType: meeting.roomGuid ? 'internal' : meeting.roomLink ? 'online' : 'external',
      followGuid: meeting.followGuid,
      date: meeting.date,
      number: meeting.number,
      notAllowReplacement: meeting.notAllowReplacement,
      startTime: formatTime(meeting.startTime),
      endTime: formatTime(meeting.endTime)
    });
  }

  // private patchCloneForm(meeting: any): void {
  //   this.meetingForm.patchValue({
  //     title: '',
  //     categoryGuid: meeting.categoryGuid,
  //     roomGuid: meeting.roomGuid,
  //     roomName: meeting.roomName,
  //     roomLink: meeting.roomLink,
  //     locationType: meeting.roomGuid ? 'internal' : meeting.roomLink ? 'online' : 'external',
  //     followGuid: meeting.followGuid,
  //     date: '',
  //     startTime: '',
  //     endTime: ''
  //   });
  // }

  private loadMeetingAgendas(agendas: any[], isCloneOperation: boolean): void {
    this.agendas.clear();

    if (!isCloneOperation && agendas && agendas.length > 0) {
      agendas.forEach((agenda: any) => {
        const agendaGroup = this.fb.group({
          id: [agenda.id],
          text: [agenda.text, Validators.required],
          fileUrl: [agenda.fileUrl],
          fileGuid: [agenda.fileGuid],
          fileObject: [null],
          isRemoved: [false]
        });
        this.agendas.push(agendaGroup);
      });
    }
  }

  // ===== EVENT HANDLERS =====
  // onLocationTypeChange(event: Event): void {
  //   this.meetingForm.patchValue({
  //     roomGuid: '',
  //     roomName: '',
  //     roomLink: '',
  //   });
  //   this.triggerConflictCheck();
  // }

  // async onCategoryChange(): Promise<void> {
  //   const selectedCategoryId = this.meetingForm.get('categoryGuid')?.value;
  //   if (selectedCategoryId) {
  //     await this.handleCategoryChange(selectedCategoryId);
  //   }
  // }

  // onMembersUpdated(updatedMembers: MeetingMember[]): void {
  //   this._selectedMembers.set(updatedMembers);
  //   this.triggerConflictCheck();
  //   this.membersUpdated.emit(updatedMembers);
  // }

  onFileStorageUpdated(updatedData: any): void {
    this._fileStorage.set(updatedData);
  }

  onAgendasUpdate(agendas: FormArray): void {
    const agendasControl = this.meetingForm.get('agendas');
    if (agendasControl instanceof FormArray) {
      while (agendasControl.length) {
        agendasControl.removeAt(0);
      }
      agendas.controls.forEach(control => {
        agendasControl.push(control);
      });
    }
    const agendasControl1 = this.agendas;
    if (agendasControl1 instanceof FormArray) {
      while (agendasControl1.length) {
        agendasControl1.removeAt(0);
      }
      agendas.controls.forEach(control => {
        agendasControl1.push(control);
      });
    }
  }

  // onRoomChange(): void {
  //   this.triggerConflictCheck();
  // }

  // onDateChange(): void {
  //   this.triggerConflictCheck();
  // }

  // onTimeChange(): void {
  //   this.meetingForm.updateValueAndValidity();
  //   this.triggerConflictCheck();
  // }

  onCheckboxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this._isFollowUpChecked.set(target.checked);

    if (!target.checked) {
      this.meetingForm.get('followGuid')?.setValue('');
    }
  }

  onTemplateSelect(event: Event): void {
    const templateId = (event.target as HTMLSelectElement).value;
    if (!templateId) return;

    this.meetingService.getBy(templateId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (template: any) => {
          this.applyTemplate(template);
        },
        error: (error) => {
          console.error('Error loading template:', error);
          this.toastService.error('خطا در بارگذاری قالب');
        }
      });
  }

  private applyTemplate(template: any): void {
    this.meetingForm.patchValue(template);
    this._selectedMembers.set(template.members || []);

    this.agendas.clear();
    (template.agendas || []).forEach((agenda: any) => {
      const agendaGroup = this.fb.group({
        id: [agenda.id ?? 0],
        description: [agenda.description, Validators.required],
        fileUrl: [agenda.fileUrl]
      });
      this.agendas.push(agendaGroup);
    });
  }

  private performConflictCheck(): void {
    const form = this.meetingForm.value;
    const { date, startTime, endTime, roomGuid } = form;

    // بررسی اینکه فیلدهای ضروری پر شده باشند
    if (!date || !startTime || !endTime) {
      console.log('⚠️ Missing required fields for conflict check:', { date, startTime, endTime });
      return;
    }

    if (this.isBoardMeetingCategory()) return;

    // آماده‌سازی لیست اعضا برای بررسی کانفلیکت - فقط اعضای فعال
    const members = this._selectedMembers()
      .filter(m => !m.isRemoved && !(m.roleId === 6 || m.roleId === 2)) // فقط اعضای غیر حذف شده و غیر مهمان
      .map<any>(m => {
        return {
          userGuid: m.userGuid,
          userName: m.userName || '',
          boardMemberId: null
        };
      })
      .filter(m => m.userGuid); // فقط کاربرانی که userGuid دارند

    const conflictData = {
      meetingGuid: this._meetingGuid() || '',
      date,
      startTime,
      endTime,
      members,
      roomGuid: roomGuid || '',
      isBoardMeeting: this._isBoardMeetingCategory()
    };

    this.meetingService.checkConflicts(conflictData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: ConflictResult) => {
          this.handleConflictResult(result);
        },
        error: (error) => {
          console.error('❌ Error checking conflicts:', error);
          // در صورت خطا، کانفلیکت‌ها را پاک کن
          this.handleConflictResult({ roomConflict: false, usersWithConflict: [] });
        }
      });
  }

  // بهبود فراخوانی conflict check در event handlerها
  onLocationTypeChange(event: Event): void {
    this.meetingForm.patchValue({
      roomGuid: '',
      roomName: '',
      roomLink: '',
    });

    // تاخیر کوتاه برای اطمینان از به‌روزرسانی فرم
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }

  onRoomChange(): void {
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }

  onDateChange(): void {
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }

  onTimeChange(): void {
    this.meetingForm.updateValueAndValidity();
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }

  private handleConflictResult(result: ConflictResult): void {
    // Clear previous errors
    this.meetingForm.get('roomGuid')?.setErrors(null);
    this._conflictedUsers.set([]);

    if (result.roomConflict) {
      this.meetingForm.get('roomGuid')?.setErrors({ conflict: true });
    }

    this._conflictedUsers.set(result.usersWithConflict || []);
  }

  // ===== FORM VALIDATION =====
  private timeFormatValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
      return timePattern.test(control.value) ? null : { invalidTimeFormat: true };
    };
  }

  private timeRangeValidator(group: AbstractControl): ValidationErrors | null {
    const startTime = group.get('startTime')?.value;
    const endTime = group.get('endTime')?.value;

    if (!startTime || !endTime) return null;

    return startTime >= endTime ? { timeInvalid: true } : null;
  }

  // ===== MEETING SUBMISSION =====
  submitMeeting(status: number): void {
    if (!this.validateMeeting()) {
      return;
    }

    this._isLoading.set(true);
    const formData = this.buildFormData(status);

    this.meetingService.createWithFile(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {

          this.handleSubmissionSuccess(response);
        },
        error: (error: any) => {
          console.error('Error submitting meeting:', error);
          this.toastService.error('خطا در ثبت جلسه');
        },
        complete: () => {
          this._isLoading.set(false);
        }
      });
  }

  private validateMeeting(): boolean {
    // Check conflicts
    if (this.hasConflicts()) {
      this.toastService.error('ثبت جلسه به دلیل وجود تداخل امکان پذیر نیست.');
      return false;
    }

    // Validate form
    if (this.meetingForm.invalid) {
      this.meetingForm.markAllAsTouched();
      return false;
    }

    // Validate agendas
    if (this.agendas.invalid) {
      this.agendas.controls.forEach(agenda => {
        if (!agenda.get('text')?.value) {
          agenda.get('text')?.markAsTouched();
        }
      });
      return false;
    }

    // Validate required roles
    if (!this.hasSecretary()) {
      this.toastService.error("لطفا دبیر جلسه را مشخص کنید.");
      return false;
    }

    if (!this.hasChairman()) {
      this.toastService.error("لطفا رئیس جلسه را مشخص کنید.");
      return false;
    }

    return true;
  }

  private buildFormData(status: number): FormData {
    const formData = new FormData();

    // Set status and notification
    if (status === 3) {
      formData.append('sendNotification', 'True');
      formData.append('statusId', '2');
    } else {
      formData.append('statusId', status.toString());
    }

    formData.append('isBoardMeeting', this._isBoardMeetingCategory().toString());

    // Add form fields
    Object.keys(this.meetingForm.controls).forEach(key => {
      if (key !== 'locationType') {
        const control = this.meetingForm.get(key);
        if (control instanceof FormArray) {
          control.controls.forEach((ctrl, index) => {
            Object.keys(ctrl.value).forEach(subKey => {
              const value = ctrl.value[subKey];
              if (value !== null && value !== undefined) {
                formData.append(`${key}[${index}].${subKey}`, value);
              }
            });
          });
        } else if (control?.value !== null && control?.value !== undefined) {
          formData.append(key, control.value);
        }
      }
    });

    // Add agenda files
    this.agendas.controls.forEach((agenda, index) => {
      const fileControl = agenda.get('fileUrl');
      if (fileControl?.value) {
        formData.append(`agendas[${index}].file`, fileControl.value);
      }
    });

    // Add members
    this._selectedMembers().forEach((member, index) => {
      this.appendMemberToFormData(formData, member, index);
    });

    // Add meeting guid if editing
    const meetingGuid = this.meetingForm.get('guid')?.value;
    if (meetingGuid) {
      formData.append('guid', meetingGuid);
    }

    // Add creator position
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    formData.append('CreatorPositionGuid', positionGuid);

    return formData;
  }

  private appendMemberToFormData(formData: FormData, member: MeetingMember, index: number): void {
    const prefix = `members[${index}]`;

    // Basic member info
    formData.append(`${prefix}.id`, member.id ?
      (this.createType() === CreatType.Edit ? member.id.toString() : '0') : '0');
    formData.append(`${prefix}.name`, member.name);
    formData.append(`${prefix}.isExternal`, member.isExternal.toString());
    formData.append(`${prefix}.isRemoved`, (member.isRemoved ?? false).toString());
    formData.append(`${prefix}.roleId`, member.roleId.toString());

    // User-specific info
    if (!member.isExternal && member.userGuid) {
      formData.append(`${prefix}.userGuid`, member.userGuid);
      formData.append(`${prefix}.positionGuid`, member.positionGuid || '');
      formData.append(`${prefix}.persNo`, member.userName || '');
    }

    // Board member specific info
    if (this._isBoardMeetingCategory() && member.boardMemberGuid) {
      formData.append(`${prefix}.boardMemberGuid`, member.boardMemberGuid.toString());
    }

    // Optional fields
    if (member.mobile) formData.append(`${prefix}.mobile`, member.mobile);
    if (member.email) formData.append(`${prefix}.email`, member.email);
    if (member.organization) formData.append(`${prefix}.organization`, member.organization);
    if (member.gender) formData.append(`${prefix}.gender`, member.gender ?? '');

    // Files
    const memberFiles = this._fileStorage()[member.guid];
    if (memberFiles?.profile) formData.append(`${prefix}.profile`, memberFiles.profile);
    if (memberFiles?.signature) formData.append(`${prefix}.signature`, memberFiles.signature);
  }

  private handleSubmissionSuccess(response: any): void {
    const meetingGuid = this.meetingForm.get('guid')?.value;
    const isEdit = !!meetingGuid;

    const title = isEdit ? "ویرایش جلسه" : "ثبت جلسه";
    const text = isEdit
      ? "جلسه با موفقیت ویرایش شد"
      : `جلسه با موفقیت ثبت گردید<br>شماره جلسه:<a href="/#/meetings/details/${response.guid}" target="_blank">${response.number}</a>`;

    this.swalService.fireSucceddedSwal(title, text);
    this.router.navigateByUrl('/meetings/list');
  }
  // ===== اصلاحات برای متد setupEffects =====
  private setupEffects(): void {
    // Effect برای تغییرات route parameters
    effect(() => {
      const paramMap = this.route.snapshot.paramMap;
      const guid = paramMap.get('guid') || '';

      if (guid !== this._meetingGuid()) {
        this._meetingGuid.set(guid);
        if (guid) {
          untracked(() => this.loadMeeting());
        }
      }
    });

    // Effect برای تغییرات category
    effect(() => {
      const selectedCategoryId = this.meetingForm?.get('categoryGuid')?.value;
      if (selectedCategoryId) {
        untracked(() => this.handleCategoryChange(selectedCategoryId));
      }
    });

    // Effect برای نظارت بر تغییرات فرم و trigger کردن conflict check
    // فقط برای جلسات غیر هیئت مدیره
    effect(() => {
      const formValues = this.meetingForm?.value;
      if (formValues && formValues.date && formValues.startTime && formValues.endTime && !this.isBoardMeetingCategory()) {
        untracked(() => {
          setTimeout(() => {
            this.triggerConflictCheck();
          }, 300);
        });
      }
    });
  }

  // ===== اصلاح متد processMeetingData =====
  private async processMeetingData(data: LoadedMeetingData): Promise<void> {
    const { meeting, members, agendas } = data;
    const formatTime = (time: string) => time ? time.slice(0, 5) : '';
    const isBoardCategory = meeting.categoryGuid === environment.boardCategoryGuid;
    const isCloneOperation = this.router.url.includes('/clone/');

    // تنظیم نوع دسته‌بندی
    this._isBoardMeetingCategory.set(isBoardCategory);

    // آماده‌سازی کاربران در دسترس بر اساس نوع جلسه
    await this.setupAvailableUsersForMeeting(isBoardCategory, meeting.categoryGuid);

    // تنظیم فرم
    if (this.createType() === CreatType.Edit) {
      this.patchMeetingForm(meeting, formatTime);
    } else if (isCloneOperation) {
      this.patchCloneForm(meeting);
    }

    // پردازش اعضا - برای clone operation اعضا را به روزرسانی کن
    if (members && members.length > 0) {
      const processedMembers = await this.processMembersData(members, isCloneOperation);
      this._selectedMembers.set(processedMembers);
    }

    // پردازش دستور جلسات - برای clone عدم کپی agendas
    if (!isCloneOperation) {
      this.loadMeetingAgendas(agendas, false);
    }

    // تنظیم وضعیت پیگیری
    const isFollowUp = !!(meeting.followGuid);
    this._isFollowUp.set(isFollowUp);
    this._isFollowUpChecked.set(isFollowUp);

    // بررسی conflict بعد از لود کامل داده‌ها
    // فقط برای جلسات غیر هیئت مدیره
    if (!isBoardCategory) {
      setTimeout(() => {
        this.triggerConflictCheck();
      }, 500);
    }
  }

  // ===== اصلاح متد updateMembersForClone =====
  private async updateMembersForClone(originalMembers: MeetingMember[]): Promise<MeetingMember[]> {
    const systemUsers = this._systemUsers();
    const boardMembers = this._boardMembers();
    const isBoardMeeting = this._isBoardMeetingCategory();
    const allSystemUsers = this._allUsers(); // همه کاربران سیستم

    const updatedMembers: MeetingMember[] = [];

    for (const originalMember of originalMembers) {
      try {
        const updatedMember = await this.updateSingleMemberForClone(
          originalMember,
          systemUsers,
          boardMembers,
          allSystemUsers,
          isBoardMeeting
        );

        if (updatedMember) {
          updatedMembers.push(updatedMember);
        }
      } catch (error) {
        console.warn(`Failed to update member ${originalMember.name}:`, error);

        // در صورت خطا، عضو را به عنوان مهمان خارجی اضافه کن
        const fallbackMember = await this.createFallbackExternalMember(originalMember);
        if (fallbackMember) {
          updatedMembers.push(fallbackMember);
        }
      }
    }

    return updatedMembers;
  }

  // ===== اصلاح متد updateSingleMemberForClone =====
  private async updateSingleMemberForClone(
    originalMember: MeetingMember,
    systemUsers: SystemUser[],
    boardMembers: BoardMember[],
    allSystemUsers: SystemUser[],
    isBoardMeeting: boolean
  ): Promise<MeetingMember | null> {
    // کپی اطلاعات پایه
    let updatedMember: MeetingMember = {
      ...originalMember,
      id: 0, // ID جدید برای کپی
      guid: generateGuid() // GUID جدید برای کپی
    };

    if (isBoardMeeting && originalMember.boardMemberGuid) {
      // عضو هیئت مدیره
      const currentBoardMember = boardMembers.find(bm =>
        bm.id === originalMember.boardMemberGuid || bm.guid === originalMember.boardMemberGuid
      );

      if (currentBoardMember) {
        updatedMember = {
          ...updatedMember,
          name: currentBoardMember.fullName,
          position: currentBoardMember.position || '',
          boardMemberGuid: currentBoardMember.id || currentBoardMember.guid
        };

        // بارگذاری تصویر جدید
        if (currentBoardMember.profileImageGuid) {
          updatedMember.image = await this.loadBoardMemberImageUrl(currentBoardMember.profileImageGuid);
        } else {
          updatedMember.image = 'img/default-avatar.png';
        }
      } else {
        console.warn(`Board member not found: ${originalMember.name}`);
        return null; // حذف عضو اگر دیگر وجود ندارد
      }
    } else if (originalMember.userGuid && !originalMember.isExternal) {
      // کاربر سیستم - ابتدا در لیست در دسترس جستجو کن، سپس در همه کاربران
      let currentUser = systemUsers.find(u => u.baseUserGuid === originalMember.userGuid);

      if (!currentUser) {
        // اگر در لیست در دسترس نبود، در همه کاربران جستجو کن
        currentUser = allSystemUsers.find(u => u.baseUserGuid === originalMember.userGuid);
      }

      if (currentUser) {
        updatedMember = {
          ...updatedMember,
          name: currentUser.name,
          position: currentUser.position || '',
          positionGuid: currentUser.positionGuid || '',
          userName: currentUser.userName,
          userGuid: currentUser.baseUserGuid,
          image: this.getSystemUserImage(currentUser)
        };
      } else {
        // تبدیل به مهمان خارجی اگر کاربر وجود ندارد
        console.warn(`User not found, converting to external guest: ${originalMember.name}`);
        return await this.createFallbackExternalMember(originalMember);
      }
    }
    // برای مهمان‌های خارجی تغییری لازم نیست، فقط تصویر را بررسی کن
    else if (originalMember.isExternal) {
      // حفظ تصویر موجود یا استفاده از تصویر پیش‌فرض
      if (!updatedMember.image || updatedMember.image === '') {
        updatedMember.image = 'img/default-avatar.png';
      }
    }

    return updatedMember;
  }

  // ===== متد جدید برای ایجاد عضو fallback =====
  private async createFallbackExternalMember(originalMember: MeetingMember): Promise<MeetingMember> {
    return {
      ...originalMember,
      id: 0,
      guid: generateGuid(),
      isExternal: true,
      userGuid: undefined,
      boardMemberGuid: undefined,
      positionGuid: '',
      userName: undefined,
      roleId: 6, // مهمان
      organization: originalMember.position || originalMember.organization || 'سازمان نامشخص',
      image: originalMember.image || 'img/default-avatar.png'
    };
  }

  // ===== اصلاح متد patchCloneForm =====
  private patchCloneForm(meeting: any): void {
    this.meetingForm.patchValue({
      title: '', // خالی برای clone
      categoryGuid: meeting.categoryGuid,
      roomGuid: '', // خالی برای clone - کاربر باید مجدداً انتخاب کند
      roomName: '', // خالی
      roomLink: '', // خالی
      locationType: 'internal', // مقدار پیش‌فرض
      followGuid: '', // خالی برای clone
      date: '', // خالی - کاربر باید وارد کند
      startTime: '', // خالی
      endTime: '', // خالی
      number: '', // خالی برای جلسات هیئت مدیره
      notAllowReplacement: false // پیش‌فرض
    });

    // تنظیم مجدد وضعیت پیگیری
    this._isFollowUp.set(false);
    this._isFollowUpChecked.set(false);
  }

  // ===== اصلاح متد triggerConflictCheck =====
  public triggerConflictCheck(): void {
    // فقط برای جلسات غیر هیئت مدیره conflict check انجام بده
    if (this.isBoardMeetingCategory()) {
      console.log('Conflict check skipped for board meetings');
      return;
    }

    // بررسی اینکه آیا اطلاعات کافی برای بررسی موجود است
    const form = this.meetingForm?.value;
    if (form && form.date && form.startTime && form.endTime) {
      // ایجاد یک key منحصر به فرد برای distinctUntilChanged
      const conflictKey = `${form.date}-${form.startTime}-${form.endTime}-${form.roomGuid || ''}-${this._selectedMembers().length}`;
      this.conflictCheck$.next(conflictKey);
    }
  }

  // ===== اصلاح متد onCategoryChange =====
  async onCategoryChange(): Promise<void> {
    const selectedCategoryId = this.meetingForm.get('categoryGuid')?.value;
    if (selectedCategoryId) {
      await this.handleCategoryChange(selectedCategoryId);

      // بعد از تغییر category، conflict check انجام بده
      // فقط اگر جلسه هیئت مدیره نباشد
      if (!this.isBoardMeetingCategory()) {
        setTimeout(() => {
          this.triggerConflictCheck();
        }, 200);
      }
    }
  }

  onMembersUpdated(updatedMembers: MeetingMember[]): void {
    this._selectedMembers.set(updatedMembers);

    // حذف کاربران حذف شده از لیست تداخل‌ها
    const currentConflicts = this._conflictedUsers();
    if (currentConflicts.length > 0) {
      const activeUserGuids = updatedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.userGuid)
        .filter(guid => guid); // حذف undefined/null

      // فقط کاربرانی را نگه دار که هنوز در لیست اعضای فعال هستند
      const filteredConflicts = currentConflicts.filter(conflict =>
        activeUserGuids.includes(conflict.userGuid)
      );

      this._conflictedUsers.set(filteredConflicts);
    }

    // فقط برای جلسات غیر هیئت مدیره conflict check کن
    if (!this.isBoardMeetingCategory()) {
      setTimeout(() => {
        this.triggerConflictCheck();
      }, 100);
    }

    this.membersUpdated.emit(updatedMembers);
  }

  // ===== متد کمکی برای تشخیص حالت clone =====
  private isCloneMode(): boolean {
    return this.router.url.includes('/clone/') && this.createType() === CreatType.Create;
  }

  // ===== اصلاح متد getSystemUserImage =====
  private getSystemUserImage(user: SystemUser): string {
    if (user.userName && user.userName.trim() !== '') {
      return `${environment.fileManagementEndpoint}/photo/${user.userName}.jpg`;
    }
    return 'img/default-avatar.png';
  }
}