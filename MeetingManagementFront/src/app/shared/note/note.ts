import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { createGuid } from '../constants';
import { USER_ID_NAME } from '../../core/types/configuration';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { NoteService } from '../../services/framework-services/note.service';
import { SwalService } from '../../services/framework-services/swal.service';
import { NgClass, NgFor, NgIf } from '@angular/common';
declare var $: any;

@Component({
  selector: 'app-note',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, ReactiveFormsModule, FormsModule],
  templateUrl: './note.html'
})
export class NoteComponent implements OnInit {

  currentUserId!: number;
  newNote: string | null | undefined;
  newEngNote: string | null | undefined;

  @Input()
  table!: string;
  @Input()
  isInViewMode!: boolean;
  @Input()
  useSecondLang!: boolean;

  @Input() set masterId(value: any) {
    this.notesFrm.get('masterId')?.setValue(value);
  }

  @Output() count: EventEmitter<number> = new EventEmitter();

  notesFrm = new FormGroup({
    masterId: new FormControl(),
    notes: new FormArray([])
  });

  get notes(): FormArray {
    return this.notesFrm.get("notes") as FormArray;
  }

  constructor(private readonly fb: FormBuilder,
    private readonly noteService: NoteService,
    private readonly swalService: SwalService,
    private readonly localStorageService: LocalStorageService) { }

  ngOnInit(): void {
    this.getNotes();
  }

  createNoteControl(note: string | null | undefined = null,
    engNote: string | null | undefined = null,
    id = 0,
    creationDate = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    creatorName = '',
    creator = this.currentUserId) {

    return this.fb.group({
      id,
      guid: createGuid(),
      creationDate,
      creatorName,
      creator,
      note,
      engNote,
      canEdit: false
    });
  }

  getNotes() {
    const masterId = this.notesFrm.get('masterId')?.value;
    this.noteService.getListByMasterId(masterId, this.table).subscribe(data => {
      data.forEach((note: { note: null | undefined; engNote: null | undefined; id: number | undefined; creationDate: string | undefined; creatorName: string | undefined; creator: number | undefined; }) => {
        const formGroup = this.createNoteControl(note.note, note.engNote, note.id, note.creationDate,
          note.creatorName, note.creator);

        this.currentUserId = parseInt(this.localStorageService.getItem(USER_ID_NAME));
        if (formGroup.get('creator')?.value !== this.currentUserId) {
          formGroup.disable();
        }

        this.notes.push(formGroup);
      });

      this.emitCount();
    });
  }

  addNote() {
    const note = this.createNoteControl(this.newNote, this.newEngNote);
    this.submit(note);
    this.newNote = '';
    this.newEngNote = '';
    $('#newNote').focus();
  }

  removeNote(index: number) {
    this.swalService.fireSwal("آیا از حذف یادداشت اطمینان دارید؟", "توجه داشته باشید که حذف اطلاعات وابسته سند، در لحظه اعمال خواهد شد.")
      .then((t: { value: boolean; }) => {
        if (t.value === true) {
          const id = this.notes.controls[index].get('id')?.value;
          if (!id) return;
          this.noteService.deleteNote(this.table, id).subscribe(() => {
            this.notes.removeAt(index);
            this.emitCount();
          });
        } else {
          this.swalService.dismissSwal(t);
        }
      });
  }

  submit(note: any) {
    const masterId = this.notesFrm.get('masterId')?.value;
    const command: any = note.value;
    command.masterId = masterId;
    command.table = this.table;

    if (command.id) {
      this.noteService.edit(command).subscribe(data => {
        this.goToEditMode(note, false);
      });
    } else {
      this.noteService
        .create(command)
        .subscribe((data: any) => {
          this.notes.push(note);
          note.get('id')?.setValue(data.id);
          note.get('creatorName')?.setValue(data.creatorName);
          this.emitCount();
        });
    }
  }

  emitCount() {
    this.count.emit(this.notes.controls.length);
  }

  canEditNote(note: any) {
    return note.get('canEdit').value;
  }

  goToEditMode(note: AbstractControl<any, any>, mode: boolean) {
    const index = this.notes.controls.indexOf(note);
    this.notes.controls[index].get('canEdit')?.setValue(mode);
  }
}