import {
  Component,
  output,
  viewChild,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  input,
  OutputEmitterRef,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormArray, FormControl, AbstractControl, ValidationErrors } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgOptionComponent, NgSelectComponent } from '@ng-select/ng-select';
import moment from 'jalali-moment';

import { Resolution } from '../../../../../core/models/Resolution';
import { SystemUser } from '../../../../../core/models/User';
import { fixPersianDigits, MeetingType } from '../../../../../core/types/configuration';
import { FileMeetingService } from '../../../../../services/file-meeting.service';
import { ToastService } from '../../../../../services/framework-services/toast.service';
import { ResolutionService } from '../../../../../services/resolution.service';
import { ComboBase } from '../../../../../shared/combo-base';
import { CustomInputComponent } from '../../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../../shared/custom-controls/custom-select';
import { base64ToArrayBuffer } from '../../../../../core/types/configuration';
import { NgStyle, SlicePipe } from '@angular/common';
import { environment } from '../../../../../../environments/environment';
import { MeetingService } from '../../../../../services/meeting.service';
import { AgendaService } from '../../../../../services/agenda.service';
import { FileService } from '../../../../../services/file.service';
import { MeetingBehaviorService } from '../../meeting-behavior-service';
import { first, firstValueFrom } from 'rxjs';

interface FileItem {
  id?: number;
  name?: string;
  size?: number;
  sizeFormatted?: string;
  url: string;
  uploadDate: string;
  type: string;
  file?: File;
  guid?: string;
  isAgendaFile?: boolean;
  isLazyLoaded?: boolean;
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
  selector: 'app-resolution-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    CustomSelectComponent,
    NgSelectComponent,
    NgStyle,
    NgOptionComponent,
    SlicePipe
  ],
  templateUrl: './resolution-form.html',
  styleUrl: './resolution-form.css',
})
export class ResolutionFormComponent implements OnInit, OnChanges {

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  private readonly meetingService = inject(MeetingService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly fileMeetingService = inject(FileMeetingService);
  private readonly agendaService = inject(AgendaService);
  private readonly fileService = inject(FileService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);

  // Input signals
  readonly isEditingResolution = input<boolean>(false);
  readonly selectedResolution = input<Resolution | null>(null);
  readonly meetingGuid = input<any>();
  readonly meetingDate = input<Date | string | null>(null);
  readonly meetingType = input<'regular' | 'board'>('regular');
  readonly users = input<ComboBase[]>([]);
  readonly positions = input<ComboBase[]>([]);
  readonly assignmentTypes = input<{ guid: string; title: string }[]>([]);
  readonly userList = input<SystemUser[]>([]);

  // Output signals
  readonly resolutionSaved: OutputEmitterRef<void> = output<void>();
  readonly modalClosed: OutputEmitterRef<void> = output<void>();
  readonly filesUploaded = output<any>();

  // ViewChild signals
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly assignmentsContainer = viewChild<ElementRef>('assignmentsContainer');

  // Status and Result Lists
  readonly actionStatusList = [
    { guid: '1', title: 'در انتظار اقدام' },
    { guid: '2', title: 'در حال انجام' },
    { guid: '3', title: 'پایان یافته' }
  ];

  readonly assignmentResultList = [
    { guid: '1', title: 'انجام شده' },
    { guid: '2', title: 'انجام نشده' }
  ];

  // Private writable signals
  private readonly _uploadedFiles = signal<FileItem[]>([]);
  private readonly _selectedFileId = signal<number | null>(null);
  private readonly _uploadingFile = signal<boolean>(false);
  private readonly _uploadProgress = signal<number>(0);
  private readonly _isPastMeeting = signal<boolean>(false);
  private readonly _pdfUrl = signal<SafeResourceUrl | null>(null);
  private readonly _previousResolutions = signal<ComboBase[] | null>(null);
  private readonly _previousCommitteResolutions = signal<ComboBase[] | null>(null);
  private readonly _agendas = signal<any[]>([]);
  private readonly _actorGuidsControls = signal<FormControl[]>([]);
  private readonly _boardActorControls = signal<FormControl[]>([]);
  private readonly _loadingAgendaFiles = signal<boolean>(false);

  // Public readonly signals
  readonly uploadedFiles = this._uploadedFiles.asReadonly();
  readonly selectedFileId = this._selectedFileId.asReadonly();
  readonly uploadingFile = this._uploadingFile.asReadonly();
  readonly uploadProgress = this._uploadProgress.asReadonly();
  readonly pdfUrl = this._pdfUrl.asReadonly();
  readonly isPastMeeting = this._isPastMeeting.asReadonly();
  readonly previousResolutions = this._previousResolutions.asReadonly();
  readonly previousCommitteResolutions = this._previousCommitteResolutions.asReadonly();
  readonly agendas = this._agendas.asReadonly();
  readonly actorGuidsControls = this._actorGuidsControls.asReadonly();
  readonly boardActorControls = this._boardActorControls.asReadonly();
  readonly loadingAgendaFiles = this._loadingAgendaFiles.asReadonly();
  private buildUniqueKey(userGuid: string, positionGuid?: string | null): string {
    const pg = (positionGuid ?? '').toString().trim();
    return `${userGuid}_${pg !== '' ? pg : 'empty'}`;
  }

  private normalizeValue(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return (v.guid ?? v.value ?? v.id ?? '').toString();
    return v.toString();
  }

  private normalizeBoardStatus(rawStatus: any, rawResult: any): { status: string; result: string } {
    const s = this.normalizeValue(rawStatus);
    const r = this.normalizeValue(rawResult);

    // اگر قدیمی‌ها status را Done/NotDone ذخیره کرده باشند
    if (s === 'Done' || s === 'NotDone') {
      return { status: '3', result: s === 'Done' ? '1' : '2' };
    }

    // status جدید
    if (['1', '2', '3'].includes(s)) {
      return { status: s, result: this.normalizeBoardResult(r) };
    }

    // نگاشت انواع دیگر
    const sl = s.toLowerCase();
    if (sl === 'inprogress') return { status: '2', result: this.normalizeBoardResult(r) };
    if (sl === 'pending' || sl === 'waiting') return { status: '1', result: this.normalizeBoardResult(r) };
    if (sl === 'end' || sl === 'ended' || sl === 'completed') return { status: '3', result: this.normalizeBoardResult(r) };

    return { status: '1', result: this.normalizeBoardResult(r) };
  }

  private normalizeBoardResult(raw: any): string {
    const r = this.normalizeValue(raw);
    if (r === '1' || r === '2') return r;
    if (r === 'Done') return '1';
    if (r === 'NotDone') return '2';
    return '';
  }

  // Computed signal برای لیست کاربران با سمت‌ها
  readonly usersWithPositions = computed<UserWithPosition[]>(() => {
    const userList = this.userList();
    const positions = this.positions();
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

  // Computed signals
  readonly fileCount = computed(() => this._uploadedFiles().length);
  readonly hasFiles = computed(() => this._uploadedFiles().length > 0);
  readonly isBoardMeeting = computed(() => this.meetingType() === MeetingType.BOARD);
  readonly isRegularMeeting = computed(() => this.meetingType() === MeetingType.REGULAR);

  readonly hasAssignments = computed(() => {
    if (this.isBoardMeeting()) {
      return this.boardAssignments().length > 0;
    } else {
      return this.regularAssignments().controls.some(control => !control.get('isRemoved')?.value);
    }
  });

  readonly canAddAssignment = computed(() => !this._isPastMeeting());
  readonly currentMeeting = computed(() => this.meetingBehaviorService.meeting());
  readonly meetingNumber = computed(() => this.currentMeeting()?.number || '');

  // Forms
  regularResolutionForm!: FormGroup;
  boardResolutionForm!: FormGroup;

  // Other properties
  previousMeetings: ComboBase[] = [];
  previousCommitteMeetings: ComboBase[] = [];
  readonly statusList = [
    { guid: 'Done', title: 'انجام شده' },
    { guid: 'NotDone', title: 'انجام نشده' },
    { guid: 'InProgress', title: 'در حال انجام' },
  ];

  constructor() {
    this.initializeForms();
    this.setupEffects();
  }

  private initializeForms(): void {
    this.boardResolutionForm = this.fb.group({
      id: [''],
      title: ['', Validators.required],
      description: [''],
      parentMeetingGuid: [''],
      parentResolutionId: [''],
      approvedPrice: [''],
      committeeMeetingGuid: [''],
      committeeResolutionId: [''],
      contractNumber: [''],
      documentation: [''],
      decisionsMade: [''],
      boardAssignments: this.fb.array([])
    });

    this.regularResolutionForm = this.fb.group({
      id: [''],
      description: ['', Validators.required],
      regularAssignments: this.fb.array([])
    });
  }

  // ============= OPTIMIZED AGENDA FILES LOADING =============

  private loadAgendaFiles(): void {
    const meetingGuid = this.meetingGuid();
    this._loadingAgendaFiles.set(true);

    // نشان دادن placeholder برای loading
    const tempAgendaFile: FileItem = {
      id: -1,
      name: 'در حال بارگذاری فایل‌های دستور جلسه...',
      url: '',
      uploadDate: '',
      type: 'loading',
      isAgendaFile: true
    };

    this._uploadedFiles.update(current => [...current, tempAgendaFile]);

    this.agendaService.getListBy(meetingGuid).subscribe({
      next: (data: any) => {
        this._agendas.set(data);

        // حذف placeholder
        this._uploadedFiles.update(current =>
          current.filter(f => f.id !== -1)
        );

        // فقط metadata را ذخیره کن، نه خود فایل‌ها
        const agendaFilesMetadata: FileItem[] = [];
        data.forEach((agenda: any, index: number) => {
          if (agenda.fileGuid) {
            const fileObj: FileItem = {
              id: Date.now() + index,
              name: agenda.fileName || `دستور جلسه ${index + 1}`,
              url: '', // فعلاً خالی
              uploadDate: new Date().toLocaleDateString('fa-IR'),
              type: 'pdf',
              guid: agenda.fileGuid,
              isAgendaFile: true,
              isLazyLoaded: true
            };
            agendaFilesMetadata.push(fileObj);
          }
        });

        this._uploadedFiles.update(current => {
          const nonAgendaFiles = current.filter(f => !f.isAgendaFile);
          return [...nonAgendaFiles, ...agendaFilesMetadata];
        });

        this._loadingAgendaFiles.set(false);
      },
      error: () => {
        this._loadingAgendaFiles.set(false);
        this._uploadedFiles.update(current =>
          current.filter(f => f.id !== -1)
        );
        this.toastService.error('خطا در بارگذاری فایل‌های دستور جلسه');
      }
    });
  }

  private loadAgendaFileOnDemand(file: FileItem): void {
    if (file.guid && !file.url) {
      // نمایش loading
      this.toastService.info('در حال بارگذاری فایل...');

      this.fileService.getFileDetails(file.guid).subscribe({
        next: (fileDetails) => {
          const url = this.createFileUrl(fileDetails);

          // آپدیت فایل با URL واقعی
          this._uploadedFiles.update(current =>
            current.map(f =>
              f.id === file.id ? { ...f, url, name: fileDetails.fileName || f.name } : f
            )
          );

          // نمایش PDF
          this.showPdfPreview(url, fileDetails.fileName || file.name || '');
        },
        error: () => {
          this.toastService.error('خطا در بارگذاری فایل');
        }
      });
    } else if (file.url) {
      this.showPdfPreview(file.url, file.name || '');
    }
  }

  // ============= REGULAR ASSIGNMENT METHODS =============

  addNewRegularAssignment(notCheck: boolean): void {
    if (!notCheck && this.regularAssignments().invalid) {
      this.regularAssignments().controls.forEach((control) =>
        control.markAllAsTouched()
      );
      return;
    }

    const newAssignmentGroup = this.fb.group({
      actors: [[], Validators.required],
      type: ['', Validators.required],
      followerGuid: ['', Validators.required],
      followerPositionGuid: [''],
      followerUniqueKey: ['', Validators.required],
      dueDate: [
        '',
        [Validators.required, this.futureOrAfterMeetingDateValidator],
      ],
      status: ['1'], // Default: در انتظار اقدام
      result: [''],
      isRemoved: [false],
    });

    this.regularAssignments().push(newAssignmentGroup);

    const newActorControl = new FormControl([]);
    this._actorGuidsControls.update(controls => [...controls, newActorControl]);
  }

  // دکمه انتخاب همه اعضا
  selectAllMembersForAssignment(index: number): void {
    // اعضای جلسه از رفتار جلسه
    const members = this.meetingBehaviorService.members() || [];
    const usersWithPos = this.usersWithPositions();

    if (!members.length) {
      this.toastService.warning('هیچ عضوی برای جلسه یافت نشد');
      return;
    }

    if (!usersWithPos.length) {
      this.toastService.warning('هیچ کاربری با سمت برای انتخاب وجود ندارد');
      return;
    }

    // فقط اعضایی که هم در members هستند و هم در usersWithPositions
    const memberKeys = new Set<string>();

    members.forEach(member => {
      if (member.isRemoved) return;
      if (!member.userGuid) return;

      // اگر برای عضو positionGuid داریم، دقیقاً همان ترکیب user+position را در usersWithPositions پیدا می‌کنیم
      if (member.positionGuid) {
        const key = `${member.userGuid}_${member.positionGuid}`;
        const existsInUsers = usersWithPos.some(u => u.uniqueKey === key);
        if (existsInUsers) {
          memberKeys.add(key);
        }
      } else {
        // اگر positionGuid عضو خالی بود، تمام سمت‌های این کاربر در usersWithPositions انتخاب شود
        usersWithPos
          .filter(u => u.userGuid === member.userGuid)
          .forEach(u => memberKeys.add(u.uniqueKey));
      }
    });

    if (memberKeys.size === 0) {
      this.toastService.warning('هیچ عضو معتبری برای انتخاب در این جلسه یافت نشد');
      return;
    }

    const allKeys = Array.from(memberKeys);

    // ست کردن مقادیر در کنترل ng-select مربوط به این ایندکس
    const actorControls = this._actorGuidsControls();
    if (actorControls[index]) {
      actorControls[index].setValue(allKeys);
    }

    // به‌روزرسانی لیست actors در فرم تخصیص
    this.onActorGuidsChange(allKeys, index);

    this.toastService.success(`${allKeys.length} عضو جلسه انتخاب شد`);
  }

  removeRegularAssignment(index: number): void {
    const assignments = this.regularAssignments();
    if (index < 0 || index >= assignments.length) return;

    const isEditing = this.isEditingResolution();

    if (!isEditing) {
      assignments.removeAt(index);
      this._actorGuidsControls.update(controls => {
        const newControls = [...controls];
        if (newControls[index]) {
          newControls.splice(index, 1);
        }
        return newControls;
      });
    } else {
      const assignment = assignments.at(index);
      if (!assignment) return;

      const actors = assignment.get('actors')?.value || [];
      actors.forEach((actor: any) => {
        actor.isRemoved = true;
      });

      assignment.get('actors')?.setValue(actors);
      assignment.get('isRemoved')?.setValue(true);

      // غیرفعال کردن validators
      assignment.get('actors')?.clearValidators();
      assignment.get('type')?.clearValidators();
      assignment.get('followerGuid')?.clearValidators();
      assignment.get('followerUniqueKey')?.clearValidators();
      assignment.get('dueDate')?.clearValidators();

      assignment.get('actors')?.updateValueAndValidity();
      assignment.get('type')?.updateValueAndValidity();
      assignment.get('followerGuid')?.updateValueAndValidity();
      assignment.get('followerUniqueKey')?.updateValueAndValidity();
      assignment.get('dueDate')?.updateValueAndValidity();

      const actorControls = this._actorGuidsControls();
      if (actorControls[index]) {
        actorControls[index].setValue([]);
      }
    }
  }

  onActorGuidsChange(selectedItems: any[], index: number): void {
    const assignments = this.regularAssignments();
    if (index < 0 || index >= assignments.length) return;

    const assignment = assignments.at(index);
    if (!assignment) return;

    const isEditing = this.isEditingResolution();

    const selectedKeys = new Set(
      selectedItems.map((item: any) => {
        if (typeof item === 'string') return item;
        return item.uniqueKey || item;
      })
    );

    const oldActors = assignment.get('actors')?.value || [];

    if (selectedKeys.size === 0) {
      if (!isEditing) {
        assignment.get('actors')?.setValue([]);
      } else {
        const newActors = oldActors.map((actor: any) => ({
          ...actor,
          isRemoved: true,
        }));
        assignment.get('actors')?.setValue(newActors);
      }
    } else {
      let newActors: any[] = oldActors.map((actor: any) => {
        const actorKey = `${actor.actorGuid}_${actor.actorPositionGuid}`;
        const stillExists = selectedKeys.has(actorKey);
        return {
          ...actor,
          isRemoved: !stillExists,
        };
      });

      const usersWithPos = this.usersWithPositions();
      selectedKeys.forEach((key: any) => {
        const keyStr = typeof key === 'string' ? key : key.uniqueKey;
        const exists = oldActors.some(
          (actor: any) => `${actor.actorGuid}_${actor.actorPositionGuid}` === keyStr
        );

        if (!exists) {
          const userWithPos = usersWithPos.find(u => u.uniqueKey === keyStr);
          if (userWithPos) {
            newActors.push({
              actorGuid: userWithPos.userGuid,
              actorPositionGuid: userWithPos.positionGuid,
              id: isEditing ? 0 : 0,
              isRemoved: false,
            });
          }
        }
      });

      assignment.get('actors')?.setValue(newActors);
    }

    const actorControls = this._actorGuidsControls();
    if (actorControls[index]) {
      const activeActors = assignment.get('actors')?.value || [];
      const activeKeys = activeActors
        .filter((actor: any) => !actor.isRemoved)
        .map((actor: any) => `${actor.actorGuid}_${actor.actorPositionGuid}`);
      actorControls[index].setValue(activeKeys);
    }

    assignment.get('actors')?.markAsDirty();
    assignment.get('actors')?.markAsTouched();
  }

  onFollowerChange(selectedItem: any, index: number): void {
    const assignments = this.regularAssignments();
    if (index < 0 || index >= assignments.length) return;

    const assignment = assignments.at(index);
    if (!assignment) return;

    const usersWithPos = this.usersWithPositions();
    const selectedKey = typeof selectedItem === 'string' ? selectedItem : selectedItem.uniqueKey;
    const userWithPos = usersWithPos.find(u => u.uniqueKey === selectedKey);

    if (userWithPos) {
      assignment.patchValue({
        followerUniqueKey: selectedKey,
        followerGuid: userWithPos.userGuid,
        followerPositionGuid: userWithPos.positionGuid
      });
    }
  }

  onRegularStatusChange(index: number, statusValue: any): void {
    const assignment = this.regularAssignments().at(index);

    if (statusValue !== '3') {
      // اگر وضعیت "پایان یافته" نیست، نتیجه را پاک کن
      assignment?.patchValue({ result: '' });
    }
  }

  getActorGuids(index: number): string[] {
    const actorControls = this._actorGuidsControls();
    if (index >= 0 && index < actorControls.length) {
      return actorControls[index].value || [];
    }

    const assignments = this.regularAssignments();
    if (index >= 0 && index < assignments.length) {
      const assignment = assignments.at(index);
      const actors = assignment?.get('actors')?.value || [];
      return actors
        .filter((actor: any) => !actor.isRemoved)
        .map((actor: any) => `${actor.actorGuid}_${actor.actorPositionGuid}`);
    }

    return [];
  }

  getFollowerUniqueKey(index: number): string {
    const assignments = this.regularAssignments();
    if (index >= 0 && index < assignments.length) {
      const assignment = assignments.at(index);
      return assignment?.get('followerUniqueKey')?.value || '';
    }
    return '';
  }

  private loadExistingRegularAssignments(): void {
    const resolution = this.selectedResolution();
    if (!resolution?.assignments) {
      return;
    }

    const formArray = this.regularAssignments();
    formArray.clear();

    const groupedAssignments = resolution.assignments.reduce((acc: any, assignment: any) => {
      const key = `${assignment.assignmentType}-${assignment.dueDate}-${assignment.followerGuid}-${assignment.followerPositionGuid || ''}`;
      if (!acc[key]) {
        acc[key] = {
          actors: [],
          type: assignment.assignmentType,
          dueDate: assignment.dueDate,
          followerGuid: assignment.followerGuid,
          followerPositionGuid: assignment.followerPositionGuid || '',
          status: assignment.status || '1',
          result: assignment.result || ''
        };
      }
      acc[key].actors.push({
        id: assignment.id,
        actorGuid: assignment.actorGuid,
        actorPositionGuid: assignment.actorPositionGuid || '',
        isRemoved: false,
      });
      return acc;
    }, {});

    const newActorControls: FormControl[] = [];

    Object.values(groupedAssignments).forEach((group: any) => {
      const followerUniqueKey = `${group.followerGuid}_${group.followerPositionGuid}`;

      const assignmentFormGroup = this.fb.group({
        actors: [group.actors, Validators.required],
        type: [group.type, Validators.required],
        followerGuid: [group.followerGuid, Validators.required],
        followerPositionGuid: [group.followerPositionGuid],
        followerUniqueKey: [followerUniqueKey, Validators.required],
        dueDate: [
          group.dueDate,
          [Validators.required, this.futureOrAfterMeetingDateValidator],
        ],
        status: [group.status || '1'],
        result: [group.result || ''],
        isRemoved: [false],
      });

      formArray.push(assignmentFormGroup);

      const actorKeys = group.actors
        .filter((actor: any) => !actor.isRemoved)
        .map((actor: any) => `${actor.actorGuid}_${actor.actorPositionGuid}`);

      const actorControl = new FormControl(actorKeys, Validators.required);
      newActorControls.push(actorControl);
    });

    this._actorGuidsControls.set(newActorControls);

    setTimeout(() => {
      for (let idx = 0; idx < formArray.length; idx++) {
        const actorKeys = this.getActorGuids(idx);
        this.onActorGuidsChange(actorKeys, idx);

        const followerKey = this.getFollowerUniqueKey(idx);
        this.onFollowerChange(followerKey, idx);

        formArray.at(idx)?.get('type')?.markAsDirty();
      }
      this.ensureSyncBetweenControlsAndAssignments();
    }, 150);
  }

  private ensureSyncBetweenControlsAndAssignments(): void {
    const assignments = this.regularAssignments();
    const controls = this._actorGuidsControls();

    for (let i = 0; i < Math.min(assignments.length, controls.length); i++) {
      const assignment = assignments.at(i);
      const control = controls[i];

      if (assignment && control) {
        const actors = assignment.get('actors')?.value || [];
        const expectedKeys = actors
          .filter((actor: any) => !actor.isRemoved)
          .map((actor: any) => `${actor.actorGuid}_${actor.actorPositionGuid}`);

        const currentControlValue = control.value || [];
        const isSync = JSON.stringify(expectedKeys.sort()) === JSON.stringify(currentControlValue.sort());

        if (!isSync) {
          control.setValue(expectedKeys, { emitEvent: false });
        }
      }
    }
  }

  private saveRegularResolution(): void {
    const formData = new FormData();
    const form = this.regularResolutionForm;
    const id = form.get('id')?.value;

    if (id) formData.append('id', id);
    formData.append('description', form.get('description')?.value || '');
    formData.append('meetingGuid', this.meetingGuid());

    const assignments = form.get('regularAssignments')?.value || [];
    let assignmentIndex = 0;

    assignments.forEach((assignment: any) => {
      const validActors = assignment.actors || [];
      if (validActors.length === 0) return;

      validActors.forEach((actor: any, actorIndex: number) => {
        formData.append(`assignments[${assignmentIndex}].actors[${actorIndex}].id`, actor.id);
        formData.append(`assignments[${assignmentIndex}].actors[${actorIndex}].userGuid`, actor.actorGuid);
        formData.append(`assignments[${assignmentIndex}].actors[${actorIndex}].positionGuid`,
          actor.actorPositionGuid || '');
        formData.append(`assignments[${assignmentIndex}].actors[${actorIndex}].isRemoved`, actor.isRemoved);
      });

      formData.append(`assignments[${assignmentIndex}].follower.userGuid`, assignment.followerGuid);
      formData.append(`assignments[${assignmentIndex}].follower.positionGuid`,
        assignment.followerPositionGuid || '');

      const assignmentType = this.assignmentTypes().find(type => type.guid === assignment.type);
      formData.append(`assignments[${assignmentIndex}].type`, assignmentType?.guid || assignment.type);
      formData.append(`assignments[${assignmentIndex}].dueDate`, assignment.dueDate);
      formData.append(`assignments[${assignmentIndex}].status`, assignment.status || '1');
      formData.append(`assignments[${assignmentIndex}].result`, assignment.result || '');

      assignmentIndex++;
    });

    this._uploadedFiles()
      .filter(fileObj => !fileObj.guid && !fileObj.isAgendaFile)
      .forEach((fileObj) => {
        if (fileObj.file) {
          formData.append('files', fileObj.file);
        }
      });

    this.resolutionService.createOrEdit(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resolutionSaved.emit();
          this.resetForm();
        },
        error: (error: any) => {
          console.error('Error saving regular resolution:', error);
          this.toastService.error('خطا در ثبت مصوبه');
        }
      });
  }

  // ============= BOARD ASSIGNMENT METHODS (با multi-select) =============
  addBoardAssignment(notCheck: boolean): void {
    if (!notCheck && this.boardAssignments().invalid) {
      this.boardAssignments().controls.forEach(c => c.markAllAsTouched());
      return;
    }

    const currentAssignments = this.boardAssignments();

    for (const assignment of currentAssignments.controls) {
      if (!assignment.get('actorUniqueKey')?.value?.length || !assignment.get('dueDate')?.value) {
        assignment.get('actorUniqueKey')?.markAsTouched();
        assignment.get('dueDate')?.markAsTouched();
        return;
      }
    }

    const assignmentGroup = this.fb.group({
      id: [0],

      // ✅ این کنترل باید وجود داشته باشد چون HTML با آن بایند است
      actorUniqueKey: [[], Validators.required],

      // actors دیتای واقعی برای ارسال به بک‌اند
      actors: [[]],

      followerGuid: [environment.defaultFollowerGuid || ''],
      followerPositionGuid: [environment.defaultFollowerPositionGuid || ''],
      dueDate: ['', Validators.required],

      status: ['1'],
      result: [''],
      description: [''],
      isRemoved: [false]
    });

    currentAssignments.insert(0, assignmentGroup);

    this.scrollToLatestAssignment();
  }

  onBoardActorsChange(assignmentIndex: number, selectedItems: any[]): void {
    const group = this.boardAssignments().at(assignmentIndex) as FormGroup;
    if (!group) return;

    const isEditing = this.isEditingResolution();
    const usersWithPos = this.usersWithPositions();

    const selectedKeys = new Set<string>(
      (selectedItems || []).map(x => (typeof x === 'string' ? x : (x.uniqueKey ?? x)))
    );

    const oldActors: any[] = group.get('actors')?.value || [];

    // 1) بازیابی/حفظ actor های قبلی و فقط isRemoved را تنظیم کن
    let newActors = oldActors.map(a => {
      const key = this.buildUniqueKey(a.actorGuid, a.actorPositionGuid);
      return { ...a, isRemoved: !selectedKeys.has(key) };
    });

    // 2) اضافه کردن انتخاب‌های جدید که قبلاً نبودند
    selectedKeys.forEach(key => {
      const exists = oldActors.some(a => this.buildUniqueKey(a.actorGuid, a.actorPositionGuid) === key);
      if (exists) return;

      const u = usersWithPos.find(p => p.uniqueKey === key);
      if (!u) return;

      newActors.push({
        id: 0,
        actorGuid: u.userGuid,
        actorPositionGuid: u.positionGuid,
        isRemoved: false
      });
    });

    // اگر در حالت ایجاد هستیم، نیازی به نگه داشتن removed ها نیست
    if (!isEditing) {
      newActors = newActors.filter(a => !a.isRemoved);
    }

    group.get('actors')?.setValue(newActors, { emitEvent: false });

    // value کنترل ng-select را هم همسان کن
    const activeKeys = newActors
      .filter(a => !a.isRemoved)
      .map(a => this.buildUniqueKey(a.actorGuid, a.actorPositionGuid));

    group.get('actorUniqueKey')?.setValue(activeKeys, { emitEvent: false });
  }


  onBoardStatusChange(index: number, statusValue: any): void {
    const assignment = this.boardAssignments().at(index);

    if (statusValue !== '3') {
      // اگر وضعیت "پایان یافته" نیست، نتیجه را پاک کن
      assignment?.patchValue({ result: '' });
    }
  }


  getBoardActorKeys(index: number): string[] {
    const boardControls = this._boardActorControls();
    if (index >= 0 && index < boardControls.length) {
      return boardControls[index].value || [];
    }
    return [];
  }

  removeBoardAssignment(index: number): void {
    const currentAssignments = this.boardAssignments();
    const assignmentControl = currentAssignments.at(index) as FormGroup;

    if (assignmentControl.get('id')?.value === 0) {
      currentAssignments.removeAt(index);

      // حذف control مربوطه
      this._boardActorControls.update(controls => {
        const newControls = [...controls];
        if (newControls[index]) {
          newControls.splice(index, 1);
        }
        return newControls;
      });
    } else {
      assignmentControl.get('isRemoved')?.setValue(true);
    }
  }
  private loadExistingBoardAssignments(): void {
    const resolution = this.selectedResolution();
    if (!resolution?.id || !resolution.assignments) return;

    const formArray = this.boardAssignments();
    formArray.clear();

    // گروه‌بندی (همان منطق قبلی شما)
    const groupedAssignments = resolution.assignments.reduce((acc: any, a: any) => {
      const key = `${a.dueDate}-${a.status || ''}-${a.result || ''}-${a.description || ''}`;
      if (!acc[key]) {
        acc[key] = {
          actors: [],
          dueDate: a.dueDate,
          status: a.status,
          result: a.result,
          description: a.description || '',
          followerGuid: a.followerGuid || environment.defaultFollowerGuid,
          followerPositionGuid: a.followerPositionGuid || environment.defaultFollowerPositionGuid
        };
      }
      acc[key].actors.push({
        id: a.id,
        actorGuid: a.actorGuid || '',
        actorPositionGuid: a.actorPositionGuid || '',
        isRemoved: false
      });
      return acc;
    }, {});

    Object.values(groupedAssignments).forEach((group: any) => {
      const actorKeys = (group.actors || [])
        .filter((x: any) => !x.isRemoved)
        .map((x: any) => this.buildUniqueKey(x.actorGuid, x.actorPositionGuid));

      const normalized = this.normalizeBoardStatus(group.status, group.result);

      const assignmentGroup = this.fb.group({
        // اگر هر actor یک id دارد، برای اینکه removeBoardAssignment بفهمد این رکورد قدیمی است:
        id: [group.actors?.[0]?.id || 0],

        actorUniqueKey: [actorKeys, Validators.required],
        actors: [group.actors, Validators.required],

        followerGuid: [group.followerGuid],
        followerPositionGuid: [group.followerPositionGuid],
        dueDate: [group.dueDate, Validators.required],

        status: [normalized.status],
        result: [normalized.result],
        description: [group.description],
        isRemoved: [false]
      });

      formArray.push(assignmentGroup);

      // یک بار همسان‌سازی actors با actorUniqueKey (و حفظ idها)
      this.onBoardActorsChange(formArray.length - 1, actorKeys);

      // اگر status=3 نباشد و نتیجه دارید پاک شود (اختیاری)
      if (normalized.status !== '3') {
        assignmentGroup.get('result')?.setValue('', { emitEvent: false });
      }
    });
  }
  selectAllMembersForBoardAssignment(index: number): void {
    const availableUsers = this.usersWithPositions();
    if (!availableUsers.length) {
      this.toastService.warning('هیچ عضوی برای انتخاب وجود ندارد');
      return;
    }

    const keys = availableUsers.map(u => u.uniqueKey);

    const group = this.boardAssignments().at(index) as FormGroup;
    if (!group) return;

    group.get('actorUniqueKey')?.setValue(keys);
    this.onBoardActorsChange(index, keys);

    this.toastService.success(`${availableUsers.length} عضو انتخاب شد`);
  }


  private saveBoardResolution(): void {
    const formData = new FormData();
    const formValue = this.boardResolutionForm.value;

    Object.keys(formValue).forEach((key) => {
      if (key === 'boardAssignments') return;

      if (formValue[key] !== null && formValue[key] !== '' && formValue[key] !== undefined) {
        formData.append(key, formValue[key]);
      }
    });

    formData.append('meetingGuid', this.meetingGuid());

    const assignments = this.boardAssignments().controls;
    let assignmentIndex = 0;

    assignments.forEach((control) => {
      const assignment = control.value;
      if (!assignment.id && assignment.isRemoved) return;

      const actors = assignment.actors || [];
      actors.forEach((actor: any, actorIndex: number) => {
        formData.append(`items[${assignmentIndex}].actors[${actorIndex}].id`, (actor.id || 0).toString());
        formData.append(`items[${assignmentIndex}].actors[${actorIndex}].userGuid`, actor.actorGuid || '');
        formData.append(`items[${assignmentIndex}].actors[${actorIndex}].positionGuid`, actor.actorPositionGuid || '');
        formData.append(`items[${assignmentIndex}].actors[${actorIndex}].isRemoved`, actor.isRemoved ? 'true' : 'false');
      });

      formData.append(`items[${assignmentIndex}].followerGuid`,
        assignment.followerGuid || environment.defaultFollowerGuid);
      formData.append(`items[${assignmentIndex}].followerPositionGuid`,
        assignment.followerPositionGuid || environment.defaultFollowerPositionGuid);
      formData.append(`items[${assignmentIndex}].dueDate`, assignment.dueDate || '');
      formData.append(`items[${assignmentIndex}].status`, assignment.status || '1');
      formData.append(`items[${assignmentIndex}].result`, assignment.result || '');
      formData.append(`items[${assignmentIndex}].description`, assignment.description || '');
      formData.append(`items[${assignmentIndex}].isRemoved`,
        assignment.isRemoved ? 'true' : 'false');

      assignmentIndex++;
    });

    this._uploadedFiles()
      .filter(fileObj => !fileObj.guid && !fileObj.isAgendaFile)
      .forEach((fileObj) => {
        if (fileObj.file) {
          formData.append('files', fileObj.file);
        }
      });

    this.resolutionService.createOrEditBoardMeeting(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resolutionSaved.emit();
          this.resetForm();
        },
        error: (error: any) => {
          console.error('Error saving board resolution:', error);
          this.toastService.error('خطا در ثبت مصوبه هیئت مدیره');
        }
      });
  }

  // ============= سایر متدها بدون تغییر =============

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

  ngOnChanges(changes: SimpleChanges): void {
    // Handle changes if needed
  }

  private checkIfPastMeeting(meetingDate: Date | string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const meeting = new Date(meetingDate);
    meeting.setHours(0, 0, 0, 0);
    this._isPastMeeting.set(meeting < today);
  }

  private loadExistingFiles(): void {
    const resolution = this.selectedResolution();
    if (resolution?.id) {
      this.fileMeetingService.getFiles(resolution.id, 'Resolution')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((files: any) => {
          if (files.length > 0) {
            const processedFiles = files.map((file: any, index: number) => ({
              id: Date.now() + index,
              name: file.fileName,
              size: file.size || 0,
              sizeFormatted: this.formatFileSize(file.size || 0),
              url: this.createFileUrl(file),
              uploadDate: new Date().toLocaleDateString('fa-IR'),
              type: 'pdf',
              file: file,
              guid: file.guid,
              isAgendaFile: false
            }));
            this._uploadedFiles.update(current => {
              const agendaFiles = current.filter(f => f.isAgendaFile);
              return [...agendaFiles, ...processedFiles];
            });
          }
        });
    }
  }

  // تغییر متد selectFile برای lazy loading
  selectFile(fileId: number): void {
    this._selectedFileId.set(fileId);
    const file = this._uploadedFiles().find((f) => f.id === fileId);
    if (file) {
      if (file.isLazyLoaded && !file.url) {
        this.loadAgendaFileOnDemand(file);
      } else {
        this.showPdfPreview(file.url, file.name ?? '');
      }
    }
  }

  private patchFormForEdit(): void {
    const resolution = this.selectedResolution();
    if (!resolution) return;

    this.resetFormSilently();

    if (this.isBoardMeeting()) {
      this.boardResolutionForm.patchValue({
        id: resolution.id,
        title: resolution.title || '',
        description: resolution.text || '',
        parentResolutionId: resolution.parentResolutionId || '',
        committeeMeetingGuid: resolution.committeeMeetingGuid || '',
        committeeResolutionId: resolution.committeeResolutionId || '',
        approvedPrice: resolution.approvedPrice || '',
        contractNumber: resolution.contractNumber || '',
        documentation: resolution.documentation || '',
        decisionsMade: resolution.decisionsMade || ''
      });

      setTimeout(() => {
        this.loadExistingBoardAssignments();
      }, 0);
    } else {
      this.regularResolutionForm.patchValue({
        id: resolution.id,
        description: resolution.text || '',
      });

      setTimeout(() => {
        this.loadExistingRegularAssignments();
      }, 0);
    }

    setTimeout(() => {
      this.loadExistingFiles();
    }, 0);
  }

  private resetFormSilently(): void {
    this.boardResolutionForm.reset();
    this.regularResolutionForm.reset();

    this._uploadedFiles().forEach((file) => {
      if (file.url && file.url.startsWith('blob:') && !file.isAgendaFile) {
        URL.revokeObjectURL(file.url);
      }
    });

    this.boardAssignments().clear();
    this.regularAssignments().clear();

    this._selectedFileId.set(null);
    this._pdfUrl.set(null);
    this._uploadingFile.set(false);
    this._uploadProgress.set(0);
    this._actorGuidsControls.set([]);
    this._boardActorControls.set([]);

    this.hidePdfPreview();
  }

  resetForm(): void {
    this.boardResolutionForm.reset();
    this.regularResolutionForm.reset();

    this._uploadedFiles().forEach((file) => {
      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url);
      }
    });

    this.boardAssignments().clear();
    this.regularAssignments().clear();

    this._uploadedFiles.set([]);
    this._selectedFileId.set(null);
    this._pdfUrl.set(null);
    this._uploadingFile.set(false);
    this._uploadProgress.set(0);
    this._actorGuidsControls.set([]);
    this._boardActorControls.set([]);

    this.hidePdfPreview();

    if (!this.isEditingResolution() && this.meetingGuid()) {
      setTimeout(() => {
        this.loadAgendaFiles();
      }, 100);
    }

    if (this.isRegularMeeting() && !this.isEditingResolution()) {
      setTimeout(() => {
        if (this.regularAssignments().length === 0) {
          this.addNewRegularAssignment(true);
        }
      }, 100);
    }
  }

  cancelForm(): void {
    this.resetForm();
  }

  saveResolution(): void {
    if (this.isBoardMeeting()) {
      if (this.boardResolutionForm.invalid) {
        this.boardResolutionForm.markAllAsTouched();
        this.boardAssignments().controls.forEach((control) =>
          control.markAllAsTouched()
        );
        this.toastService.error('لطفاً اطلاعات فرم را تکمیل کنید');
        return;
      }
      this.saveBoardResolution();
    } else {
      if (this.regularResolutionForm.invalid) {
        this.regularResolutionForm.markAllAsTouched();
        this.toastService.error('لطفاً اطلاعات فرم را تکمیل کنید');
        return;
      }

      const hasValidAssignments = this.regularAssignments().controls.some(control =>
        !control.get('isRemoved')?.value && control.valid
      );

      if (!hasValidAssignments) {
        this.regularAssignments().controls.forEach((control) =>
          control.markAllAsTouched()
        );
        this.toastService.error('حداقل یک تخصیص معتبر ضروری است');
        return;
      }

      this.saveRegularResolution();
    }
  }

  // ============= VALIDATORS =============

  futureOrAfterMeetingDateValidator = (
    control: AbstractControl
  ): ValidationErrors | null => {
    if (!control.value) return null;

    const date = control.value;
    const fixedDate = fixPersianDigits(date);
    const georgianDate = moment(fixedDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
    const inputDate = new Date(georgianDate);

    const meetingDate = this.meetingDate();
    if (!meetingDate) return null;

    const meetingDateStr = typeof meetingDate === 'string' ? meetingDate : meetingDate.toISOString();
    const meetingFixedDate = fixPersianDigits(meetingDateStr);
    const meetingGeorgianDate = moment(meetingFixedDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
    const meetingDateObj = new Date(meetingGeorgianDate);

    return inputDate < meetingDateObj ? { beforeMeetingDate: true } : null;
  };

  // ============= FILE MANAGEMENT (بدون تغییر) =============

  triggerFileInput(): void {
    this.fileInput()?.nativeElement?.click();
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.add('dragover');
  }

  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('dragover');
  }

  handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('dragover');

    const files = Array.from(event.dataTransfer?.files || []);
    this.processFiles(files);
  }

  handleFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      this.processFiles(files);
      input.value = '';
    }
  }

  processFiles(files: File[]): void {
    const pdfFiles = files.filter((file) => file.type === 'application/pdf');
    const invalidFiles = files.filter((file) => file.type !== 'application/pdf');

    if (invalidFiles.length > 0) {
      this.toastService.error('فقط فایل‌های PDF پذیرفته می‌شوند');
    }

    if (pdfFiles.length > 0) {
      pdfFiles.forEach((file) => this.uploadFile(file));
    }
  }

  async uploadFile(file: File): Promise<void> {
    const fileId = Date.now() + Math.random();
    const fileSize = this.formatFileSize(file.size);

    const fileObj: FileItem = {
      id: fileId,
      name: file.name,
      size: file.size,
      sizeFormatted: fileSize,
      url: URL.createObjectURL(file),
      uploadDate: new Date().toLocaleDateString('fa-IR'),
      type: 'pdf',
      file: file,
      isAgendaFile: false
    };

    this._uploadingFile.set(true);

    try {
      await this.simulateUpload();
      this._uploadedFiles.update(current => [...current, fileObj]);
    } finally {
      this._uploadingFile.set(false);
      this._uploadProgress.set(0);
    }
  }

  private simulateUpload(): Promise<void> {
    return new Promise((resolve) => {
      this._uploadProgress.set(0);
      const interval = setInterval(() => {
        this._uploadProgress.update(current => {
          const newProgress = current + Math.random() * 20;
          if (newProgress >= 100) {
            clearInterval(interval);
            setTimeout(resolve, 200);
            return 100;
          }
          return newProgress;
        });
      }, 150);
    });
  }

  deleteFile(fileId: number): void {
    const file = this._uploadedFiles().find(f => f.id === fileId);

    if (file?.isAgendaFile) {
      this.toastService.error('فایل‌های دستور جلسه قابل حذف نیستند');
      return;
    }

    if (confirm('آیا از حذف این فایل اطمینان دارید؟')) {
      if (file) {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }

        this._uploadedFiles.update(current => current.filter(f => f.id !== fileId));

        if (this._selectedFileId() === fileId) {
          this._selectedFileId.set(null);
          this.hidePdfPreview();
        }

        this.toastService.success('فایل حذف شد');
      }
    }
  }

  showPdfPreview(url: string, name: string): void {
    const pdfPanel = document.getElementById('pdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    const pdfTitleElem = document.getElementById('pdf-title');
    if (pdfTitleElem) {
      pdfTitleElem.innerHTML = name;
    }
    if (pdfPanel) {
      pdfPanel.classList.remove('hidden');
    }
    if (mainContainer) {
      mainContainer.classList.remove('no-pdf');
    }
  }

  hidePdfPreview(): void {
    const pdfPanel = document.getElementById('pdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._pdfUrl.set(null);
    if (pdfPanel) {
      pdfPanel.classList.add('hidden');
    }
    if (mainContainer) {
      mainContainer.classList.add('no-pdf');
    }
    this._selectedFileId.set(null);
  }

  // ============= UTILITY METHODS =============

  onMeetingChange(meetingGuid: any): void {
    this.resolutionService
      .getRelatedResolutions(meetingGuid)
      .subscribe((data: any) => {
        this._previousResolutions.set(data);
      });
  }

  onCommitteeMeetingChange(meetingGuid: any) {
    this.resolutionService
      .getRelatedResolutions(meetingGuid)
      .subscribe((data: any) => {
        this._previousCommitteResolutions.set(data);
      });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 بایت';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private createFileUrl(file: any): string {
    if (file.file) {
      const blob = new Blob([base64ToArrayBuffer(file.file)], {
        type: file.contentType
      });
      return URL.createObjectURL(blob);
    }
    return '';
  }

  private scrollToLatestAssignment(): void {
    const container = this.assignmentsContainer()?.nativeElement;
    if (container) {
      setTimeout(() => {
        container.scrollTop = 0;
      }, 100);
    }
  }

  getSelectedUserTitle(guid: string): string {
    const users = this.users();
    const user = users.find(u => u.guid === guid);
    return user ? user.title ?? '' : '';
  }

  getAssignmentType(guid: string): string {
    return this.assignmentTypes().find(type => type.guid === guid)?.title || '';
  }

  getUserName(guid: string): string {
    return this.users().find(user => user.guid === guid)?.title || '';
  }

  isRegularAssignmentRemoved(index: number): boolean {
    const assignments = this.regularAssignments();
    return assignments.at(index)?.get('isRemoved')?.value || false;
  }

  boardAssignments(): FormArray {
    return this.boardResolutionForm?.get('boardAssignments') as FormArray;
  }

  regularAssignments(): FormArray {
    return this.regularResolutionForm?.get('regularAssignments') as FormArray;
  }

  get boardAssignmentControls() {
    return this.boardAssignments()?.controls as FormGroup[] || [];
  }

  get regularAssignmentControls() {
    return this.regularAssignments()?.controls as FormGroup[] || [];
  }

  // ============= LIFECYCLE & EFFECTS =============

  private setupEffects(): void {
    effect(() => {
      const meetingGuid = this.meetingGuid();
      const isEditing = this.isEditingResolution();

      if (meetingGuid && !isEditing) {
        this.loadAgendaFiles();
      }
    });

    effect(() => {
      const resolution = this.selectedResolution();
      const isEditing = this.isEditingResolution();

      if (resolution && isEditing) {
        setTimeout(() => {
          this.patchFormForEdit();
        }, 0);
      }
    });
  }

  ngOnInit(): void {
    const meetingDate = this.meetingDate();
    if (meetingDate) {
      this.checkIfPastMeeting(meetingDate);
    }

    if (this.isBoardMeeting()) {
      this.meetingService.getParentMeetings()
        .subscribe((data: any) => {
          this.previousMeetings = data.filter((m: any) => m.guid !== this.meetingGuid()).map((meeting: any) => ({
            guid: meeting.guid,
            title: meeting.title,
          }));
        });
      this.meetingService.getListByCategoryGuid(environment.committeeGuid)
        .subscribe((data: any) => {
          this.previousCommitteMeetings = data.map((meeting: any) => ({
            guid: meeting.guid,
            title: meeting.title,
          }));
        });
    }

    if (!this.isEditingResolution() && this.isRegularMeeting()) {
      setTimeout(() => {
        if (this.regularAssignments().length === 0) {
          this.addNewRegularAssignment(true);
        }
      }, 0);
    }
  }
}