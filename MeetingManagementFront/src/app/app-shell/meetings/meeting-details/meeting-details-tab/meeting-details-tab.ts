import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  input,
  output
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { catchError, of, map, forkJoin } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { MeetingMember, AgendaItem } from '../../../../core/models/Meeting';
import { Resolution } from '../../../../core/models/Resolution';
import { IsDeletage, POSITION_ID, USER_ID_NAME } from '../../../../core/types/configuration';
import { CategoryService } from '../../../../services/category.service';
import { FileService } from '../../../../services/file.service';
import { CodeFlowService } from '../../../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { MeetingService } from '../../../../services/meeting.service';
import { RoomService } from '../../../../services/room.service';
import { ComboBase } from '../../../../shared/combo-base';
import { CustomInputComponent } from '../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../shared/custom-controls/custom-select';
import { MeetingBehaviorService } from '../meeting-behavior-service';


declare var $: any;
declare var Swal: any;

@Component({
  selector: 'app-meeting-details-tab',
  imports: [ReactiveFormsModule, FormsModule, CustomInputComponent, CustomSelectComponent, NgClass],
  standalone: true,
  templateUrl: './meeting-details-tab.html',
  styleUrl: './meeting-details-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingDetailsTabComponent implements OnInit {
  // Inject dependencies using new inject function
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly roomService = inject(RoomService);
  private readonly categoryService = inject(CategoryService);
  private readonly meetingService = inject(MeetingService);
  private readonly toastService = inject(ToastService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly fileService = inject(FileService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly meetingMemberService = inject(MeetingMemberService);
  private readonly destroyRef = inject(DestroyRef);

  // Inputs and Outputs using new Angular syntax
  meetingGuid = input<string>('');
  currentTab = input<string>('details');

  // Output events
  tabChanged = output<string>();
  memberUpdated = output<MeetingMember>();
  agendaUpdated = output<string>();

  // Signals for reactive state management
  readonly isEditingAgenda = signal<boolean>(false);
  readonly agendaText = signal<string | null>(null);
  readonly agendaFile = signal<File | null>(null);
  readonly statusId = signal<any>(null);
  readonly roleId = signal<any>(null);
  readonly downloadUrl = signal<string>('');
  readonly isDelegate = signal<boolean>(false);
  readonly isFollowUpChecked = signal<boolean>(false);

  // File viewer signals
  readonly fileUrl = signal<string>('');
  readonly fileContent = signal<string>('');
  readonly fileType = signal<'image' | 'pdf' | 'text' | 'other'>('other');
  readonly fileName = signal<string>('');

  // Combo data signals
  readonly memberTypes = signal<ComboBase[]>([]);
  readonly categories = signal<ComboBase[]>([]);
  readonly rooms = signal<ComboBase[]>([]);
  readonly meetings = signal<ComboBase[]>([]);
  readonly attendees = signal<any[]>([]);
  readonly agendas = signal<AgendaItem[]>([]);
  readonly resolutions = signal<Resolution[]>([]);

  // Computed signals for derived state
  readonly currentMember = computed(() => this.meetingBehaviorService.currentMember());
  readonly meeting = computed(() => this.meetingBehaviorService.meeting());
  readonly members = computed(() => {
    const members = this.meetingBehaviorService.members();
    const rolePriority: { [key: number]: number } = { 3: 1, 1: 2, 2: 3, 4: 4, 5: 5, 6: 6 };

    return members.sort((a: MeetingMember, b: MeetingMember) => {
      const aPriority = rolePriority[a.roleId] ?? 99;
      const bPriority = rolePriority[b.roleId] ?? 99;
      return aPriority - bPriority;
    }).map(member => {
      if (member.replacementUserGuid) {
        const replacementMember = members.find(m => m.userGuid === member.replacementUserGuid);
        if (replacementMember) {
          member.substitute = replacementMember.name;
        }
      }
      return member;
    });
  });
  // در بخش signals اضافه کنید:
  readonly hasChairmanSigned = computed(() => {
    const members = this.members();
    const chairman = members.find(m => m.roleId === 3);
    return chairman?.isSign === true;
  });
  // computed جدید برای دسترسی به ویرایش
  readonly canEditMeeting = computed(() => {
    const meeting = this.meeting();
    const currentMember = this.currentMember();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (meeting?.roleId === 3 && !hasChairmanSigned);

    // شرایط عادی ویرایش
    const normalEditConditions =
      [1, 2, 3].includes(meeting?.roleId) &&
      !currentMember?.isDelegate &&
      meeting?.statusId !== 4 &&
      meeting?.statusId !== 6;

    return isUnsignedChairman || normalEditConditions;
  });
  // computed برای دسترسی به تغییر حضور و غیاب
  readonly canChangeAttendance = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    // شرایط عادی
    const normalConditions = [1, 2, 3].includes(roleId) && statusId === 3;

    return isUnsignedChairman || normalConditions;
  });
  readonly locationTypes = signal([
    { guid: 'internal', title: 'حضوری درون شرکت' },
    { guid: 'external', title: 'بیرون از شرکت' },
    { guid: 'online', title: 'آنلاین' }
  ]);

  // ViewChild
  @ViewChild('memberTableContainer') memberTableContainer!: ElementRef;

  // Forms
  meetingForm: FormGroup;
  agendaForm: FormGroup;

  constructor() {
    // Initialize forms
    this.meetingForm = this.fb.group({
      title: ['', Validators.required],
      categoryGuid: ['', Validators.required],
      locationType: ['', Validators.required],
      roomGuid: [''],
      roomName: [''],
      roomLink: [''],
      date: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      isFollowUp: [false],
      followGuid: [''],
    });

    this.agendaForm = this.fb.group({
      text: [''],
      file: ['']
    });

    // Effects for reactive updates
    effect(() => {
      const meeting = this.meeting();
      if (meeting) {
        this.agendaText.set(meeting.agenda || null);
        this.statusId.set(meeting.statusId);
        this.roleId.set(meeting.roleId);
        this.downloadUrl.set(
          meeting.agendaFileGuid !== null
            ? `${this.fileService.baseUrl}/Download/${meeting.agendaFileGuid}`
            : ""
        );
      }
    });

    // Effect for route parameter changes
    effect(() => {
      const guid = this.meetingGuid();
      if (guid) {
        this.loadMeetingDetails();
      }
    });
  }

  ngOnInit(): void {
    // Set initial values
    this.isDelegate.set(this.localStorageService.getItem(IsDeletage) === 'true');

    // Subscribe to route parameters
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: ParamMap) => {
        const guid = params.get('guid');
        if (guid) {
          // Update meetingGuid signal if it's writable or handle differently
          this.loadMeetingDetails();
        }
      });
  }

  // متد جدید برای تنظیم حضور/غیاب همه اعضا
  setAllPresence(isPresent: boolean): void {
    const scrollTop = this.memberTableContainer.nativeElement?.scrollTop;
    const members = this.members();
    const meetingToUpdateMembers = {
      meetingGuid: this.meetingGuid(),
      isPresent: isPresent
    };
    this.meetingMemberService.setGroupAttendance(meetingToUpdateMembers)
      .subscribe(data => {
        this.refreshMembersList();
      })


  }

  togglePresence(member: MeetingMember, status: any): void {
    const scrollTop = this.memberTableContainer.nativeElement?.scrollTop;
    const memberItem = {
      id: member.id,
      isPresent: status
    };

    const userGuid = this.localStorageService.getItem(POSITION_ID);

    this.memberService.attendance(memberItem)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshMembersList();

        setTimeout(() => {
          if (this.memberTableContainer.nativeElement) {
            this.memberTableContainer.nativeElement.scrollTop = scrollTop;
          }
        }, 0);

        // Emit event
        this.memberUpdated.emit(member);
      });
  }

  // متد کمکی برای بارگذاری مجدد لیست اعضا
  private refreshMembersList(): void {
    const userGuid = this.localStorageService.getItem(POSITION_ID);

    this.memberService.getUserList(this.meetingGuid(), userGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userList => {
        const requests = userList.map((member: MeetingMember) => {
          if (member.replacementUserGuid) {
            member.substitute = userList.find((m: MeetingMember) =>
              m.userGuid === member.replacementUserGuid)?.name || '';
          }

          if (member.profileGuid) {
            return this.fileService.getFileDetails(member.profileGuid).pipe(
              catchError(() => of(null)),
              map(file => {
                if (file) {
                  const arrayBuffer = this.base64ToArrayBuffer(file.file);
                  const blob = new Blob([arrayBuffer], { type: file.contentType });
                  member.image = URL.createObjectURL(blob);
                }
                else
                  member.image = '/img/default-avatar.png';
                return member;
              })
            );
          } else {
            member.image = member.userName !== '00000' ? environment.fileManagementEndpoint + '/photo/' + member.userName + '.jpg' : '/img/default-avatar.png';
          }
          return of(member);
        });

        forkJoin(requests).subscribe((resolvedMembers: MeetingMember[]) => {
          this.meetingBehaviorService.setMembers(resolvedMembers);
        });
      });
  }

  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  loadMeetingDetails(): void {
    // Meeting details are now handled by computed signals
    // This method can be used for additional loading if needed
  }

  getRooms(): void {
    this.roomService.getForCombo<ComboBase[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.rooms.set(data));
  }

  getCategories(): void {
    this.categoryService.getForCombo<ComboBase[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.categories.set(data));
  }

  openEditModal(): void {
    this.meetingService.getForEdit(this.meetingGuid())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => {
        this.meetingForm.patchValue({
          title: data.title,
          categoryGuid: data.categoryGuid,
          locationType: data.roomGuid != null ? 'internal' : data.roomName != "" ? 'external' : 'online',
          roomGuid: data.roomGuid,
          roomName: data.roomName,
          roomLink: data.roomLink,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          isFollowUp: data.followGuid != null,
          followGuid: data.followGuid,
          members: data.members,
        });

        this.getCategories();
        this.getRooms();

        const userGuid = this.localStorageService.getItem(USER_ID_NAME);
        const filter = {
          userGuid: userGuid,
          filterType: 'All'
        };

        const meetingData = this.meetingBehaviorService.meeting();
        if (meetingData) {
          this.meetings.set(
            meetingData
              .filter((meeting: any) => meeting.guid !== this.meetingGuid())
              .map((meeting: any) => ({
                guid: meeting.guid,
                title: `${meeting.number} - ${meeting.title}`
              }))
          );
        }

        $('#editModal').modal('show');
      });
  }

  saveMeeting(): void {
    const meetingData = { ...this.meetingForm.value, guid: this.meetingGuid() };

    this.meetingService.edit(meetingData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response: any) => {
        this.meetingBehaviorService.setMeeting(response);
        $('#editModal').modal('hide');
        this.meetingForm.reset();
      });
  }

  onLocationTypeChange(event: Event): void {
    this.meetingForm.patchValue({
      roomGuid: '',
      externalLocation: '',
      online: '',
    });
  }

  onCheckboxChange(event: any): void {
    this.isFollowUpChecked.set(event.target.checked);

    if (!this.isFollowUpChecked()) {
      this.meetingForm.patchValue({
        followGuid: ''
      });
    }
  }

  toggleEditAgenda(): void {
    if (this.isEditingAgenda()) {
      // Save logic here if needed
    } else {
      this.agendaForm = this.fb.group({
        text: [this.agendaText()],
        file: ['']
      });
    }

    this.isEditingAgenda.update(value => !value);
    this.agendaUpdated.emit(this.agendaText() || '');
  }

  removeAgendaItem(): void {
    this.agendaText.set(null);
    this.agendaFile.set(null);
    this.isEditingAgenda.set(false);
    this.agendaForm.reset();
    this.agendaUpdated.emit('');
  }

  onFileChange(event: any): void {
    if (event.target.files.length > 0) {
      this.agendaForm.patchValue({
        file: event.target.files[0]
      });
      this.agendaFile.set(event.target.files[0]);
    }
  }

  onRoomChange(): void {
    // Check location conflicts logic here
  }

  viewFile(fileGuid?: string): void {
    if (!fileGuid) return;

    this.fileService.getFileDetails(fileGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(file => {
        this.fileName.set(file.fileName);
        this.downloadUrl.set(`${this.fileService.baseUrl}/Download/${fileGuid}`);

        const arrayBuffer = this.base64ToArrayBuffer(file.file);
        const blob = new Blob([arrayBuffer], { type: file.contentType });
        this.fileUrl.set(URL.createObjectURL(blob));

        if (file.contentType.startsWith('image')) {
          this.fileType.set('image');
        } else if (file.contentType === 'application/pdf') {
          this.fileType.set('pdf');
        } else if (file.contentType.startsWith('text')) {
          this.fileType.set('text');
          this.readTextFile(blob);
        } else {
          this.fileType.set('other');
        }

        this.showModal();
      });
  }

  download(fileGuid?: any): void {
    const token = this.codeFlowService.getToken();

    fetch(`${this.fileService.baseUrl}/Download/${fileGuid}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(resp => resp.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        $(`#${a.id}`).remove();
      })
      .catch(() => { });
  }

  readTextFile(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.fileContent.set(reader.result as string);
    };
    reader.readAsText(blob);
  }

  showModal(): void {
    $("#fileViewerModal").modal("toggle");
  }

  showImageModal(imageUrl: string): void {
    Swal.fire({
      imageUrl: imageUrl,
      imageAlt: "فایل پیوست",
      showConfirmButton: false,
      showCloseButton: true
    });
  }

  confirmDeleteFile(): void {
    Swal.fire({
      title: "حذف فایل پیوست",
      text: "آیا از حذف این فایل اطمینان دارید؟",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "خیر",
    }).then((result: { isConfirmed: any; }) => {
      if (result.isConfirmed) {
        this.deleteFile();
      }
    });
  }

  deleteFile(): void {
    const meeting = this.meeting();
    if (!meeting?.agendaFileGuid) return;

    this.fileService.delete(meeting.agendaFileGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.meetingBehaviorService.updateMeeting({ agendaFileGuid: undefined });
      }, () => {
        this.toastService.error("خطا در حذف فایل.");
      });
  }
}
