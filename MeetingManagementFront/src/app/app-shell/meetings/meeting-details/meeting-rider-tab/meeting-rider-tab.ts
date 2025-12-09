import { Component, ElementRef, NgZone, OnInit, ViewChild, signal, computed, effect, input, untracked } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { FileMeetingService } from '../../../../services/file-meeting.service';
import { FileService } from '../../../../services/file.service';
import { MeetingService } from '../../../../services/meeting.service';
import { ResolutionService } from '../../../../services/resolution.service';
import { FormsModule } from '@angular/forms';
import { Modal } from 'bootstrap';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

declare var Swal: any;

@Component({
  selector: 'app-meeting-rider-tab',
  imports: [FormsModule],
  templateUrl: './meeting-rider-tab.html',
  styleUrl: './meeting-rider-tab.css'
})
export class MeetingRiderTabComponent implements OnInit {

  @ViewChild('fileModal') fileModal!: ElementRef;
  @ViewChild('fileViewerModal') fileViewerModal!: ElementRef;

  // Signals for reactive state management
  private readonly _fileUrl = signal<string>('');
  readonly fileUrl = this._fileUrl.asReadonly();

  private readonly _fileContent = signal<string>('');
  readonly fileContent = this._fileContent.asReadonly();

  private readonly _fileType = signal<'image' | 'pdf' | 'text' | 'other'>('other');
  readonly fileType = this._fileType.asReadonly();

  private readonly _fileName = signal<string>('');
  readonly fileName = this._fileName.asReadonly();

  private readonly _editableRider = signal<string>('');
  readonly editableRider = this._editableRider.asReadonly();

  private readonly _isEditingRider = signal<boolean>(false);
  readonly isEditingRider = this._isEditingRider.asReadonly();

  private readonly _selectedFile = signal<any | null>(null);
  readonly selectedFile = this._selectedFile.asReadonly();

  private readonly _attachments = signal<any[]>([]);
  readonly attachments = this._attachments.asReadonly();

  private readonly _downloadUrl = signal<string>('');
  readonly downloadUrl = this._downloadUrl.asReadonly();

  private readonly _meetingGuid = signal<string>('');
  readonly meetingGuid = this._meetingGuid.asReadonly();

  // Computed signals from behavior service
  readonly meeting = computed(() => this.meetingBehaviorService.meeting());
  readonly currentMember = computed(() => this.meetingBehaviorService.currentMember());
  readonly roleId = computed(() => this.meeting()?.roleId);
  readonly statusId = computed(() => this.meeting()?.statusId);
  readonly rider = computed(() => this.meeting()?.rider ?? '');
  readonly file = computed(() => this.meeting()?.riderGuid ?? '');
  // Input for meeting GUID (optional - if passed from parent)
  meetingGuidInput = input<string>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly meetingService: MeetingService,
    private readonly resolutionService: ResolutionService,
    private readonly fileManagemnetService: FileMeetingService,
    private readonly zone: NgZone,
    private readonly meetingBehaviorService: MeetingBehaviorService,
    private readonly fileService: FileService,
  ) {
    // Effect to handle meeting GUID from input or route
    effect(() => {
      const inputGuid = this.meetingGuidInput();
      if (inputGuid && inputGuid !== this.meetingGuid()) {
        this._meetingGuid.set(inputGuid);
      }
    });
    // Effect to sync editableRider when rider changes
    effect(() => {
      const currentRider = this.rider();
      if (!this.isEditingRider()) {
        this._editableRider.set(currentRider);
      }
    });
  }

  ngOnInit(): void {
    // Only subscribe to route if no input is provided
    if (!this.meetingGuidInput()) {
      this.route.paramMap
        .pipe(takeUntilDestroyed())
        .subscribe((params: ParamMap) => {
          const guid = params.get('guid');
          if (guid) {
            this._meetingGuid.set(guid);
          }
        });
    }
  }

  updateList(): void {
    const guid = this.meetingGuid();
    if (guid) {
      this.resolutionService.getListBy(guid)
        .pipe(takeUntilDestroyed())
        .subscribe(data => {
          this.meetingBehaviorService.updateResolutions(data);
        });
    }
  }

  editMeetingRider(): void {
    this.zone.run(() => {
      this._editableRider.set(this.rider());
      this._isEditingRider.set(true);
    });
  }

  cancelEditMeetingRider(): void {
    this.zone.run(() => {
      this._isEditingRider.set(false);
      this._editableRider.set(this.rider());
    });
  }

  showFiles(resolutionId: number): void {
    this.fileManagemnetService.getFiles(resolutionId, 'Resolution')
      .pipe(takeUntilDestroyed())
      .subscribe((files:any) => {
        this._attachments.set(files);
      });
    this.showModal(this.fileModal);
  }

  showModal(modalRef: ElementRef): void {
    if (!modalRef?.nativeElement) {
      console.error("Modal reference is invalid", modalRef);
      return;
    }

    const modalInstance = Modal.getInstance(modalRef.nativeElement) ||
      new Modal(modalRef.nativeElement);
    modalInstance.toggle();
  }

  saveMeetingRider(): void {
    const editableText = this.editableRider();
    const guid = this.meetingGuid();
    const selectedFile = this.selectedFile();

    if (editableText.length > 1000) {
      return; // اگر طول متن بیشتر از 1000 کاراکتر باشد، ویرایش انجام نشود
    }

    this._isEditingRider.set(false);

    const formData = new FormData();
    formData.append('rider', editableText);
    formData.append('meetingGuid', guid);

    if (selectedFile) {
      formData.append('file', selectedFile);
    }
    this.meetingService.updateRider(formData).subscribe((response: any) => {
      untracked(() => {
        this.meetingBehaviorService.updateMeeting({
          rider: editableText,
          riderGuid: response.riderGuid
        });
      });
    });
  }

  trackByFn(index: number, item: any): any {
    return item.id;
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this._selectedFile.set(input.files[0]);
    }
  }

  // Method to update editable rider (for template binding)
  updateEditableRider(value: string): void {
    this._editableRider.set(value);
  }

  viewFile(fileGuid?: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!fileGuid) return;

    this.fileService.getFileDetails(fileGuid)
      .pipe(takeUntilDestroyed())
      .subscribe(file => {
        this._fileName.set(file.fileName);
        this._downloadUrl.set(`${this.fileService.baseUrl}/Download/${fileGuid}`);

        const arrayBuffer = this.fileService.base64ToArrayBuffer(file.file);
        const blob = new Blob([arrayBuffer], { type: file.contentType });
        this._fileUrl.set(URL.createObjectURL(blob));

        if (file.contentType.startsWith('image')) {
          this._fileType.set('image');
        } else if (file.contentType === 'application/pdf') {
          this._fileType.set('pdf');
        } else if (file.contentType.startsWith('text')) {
          this._fileType.set('text');
          this.readTextFile(blob);
        } else {
          this._fileType.set('other');
        }

        setTimeout(() => {
          this.showModal(this.fileViewerModal);
        }, 100);
      });
  }

  private readTextFile(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = () => {
      this._fileContent.set(reader.result as string);
    };
    reader.readAsText(blob);
  }

  download(fileGuid?: string): void {
    if (fileGuid) {
      this.fileService.download(fileGuid);
    }
  }

  confirmDeleteFile(fileGuid: any): void {
    Swal.fire({
      title: "حذف فایل پیوست",
      text: "آیا از حذف این فایل اطمینان دارید؟",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "خیر",
    }).then((result: { isConfirmed: any; }) => {
      if (result.isConfirmed) {
        this.deleteFile(fileGuid);
      }
    });
  }

  deleteFile(id: any): void {
    const guid = this.meetingGuid();
    this.meetingService.deleteRiderFile(guid)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.meetingBehaviorService.updateMeeting({ riderGuid: '' });
        },
        error: () => {
          // Handle error - you can add toast service here
          console.error("خطا در حذف فایل.");
        }
      });
  }
}