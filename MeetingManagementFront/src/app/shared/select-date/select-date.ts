import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { datePickerConfig } from '../constants'
import { FormsModule } from '@angular/forms'
import { DateMaskDirective } from '../../core/directives/date-mask.directive'
import { NgClass, NgIf } from '@angular/common'

@Component({
  selector: 'app-select-date',
  imports: [FormsModule, DateMaskDirective, NgClass, NgIf],
  standalone: true,
  templateUrl: './select-date.html'
})
export class SelectDateComponent implements OnInit {

  fromDate: any
  toDate: any
  datePickerConfig = datePickerConfig

  @Input() id: any
  @Input() type: any
  @Output() submited: EventEmitter<any> = new EventEmitter()

  constructor() { }

  ngOnInit() {
  }

  submit() {
    this.submited.emit({ fromDate: this.fromDate, toDate: this.toDate })
  }
}
