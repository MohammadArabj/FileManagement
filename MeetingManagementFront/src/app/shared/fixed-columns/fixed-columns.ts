import {
  Component,
  AfterViewChecked,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { IconButtonComponent } from "../custom-buttons/icon-button";
import { NgClass, NgIf } from '@angular/common';
// import { ServiceBase } from '../../framework-services/service.base';

@Component({
  selector: 'app-fixed-columns',
  templateUrl: './fixed-columns.html',
  styleUrls: ['./fixed-columns.css'],
  imports: [IconButtonComponent, NgIf, NgClass],
  standalone: true
})
export class FixedColumnsComponent {
  itemGuid = ""
  @Input() public item: any;
  @Input() public permissions: any;
  @Input() public customClassName!: string;
  @Output() public activate = new EventEmitter()
  @Output() public deactivate = new EventEmitter()
  @Output() public delete = new EventEmitter()
  @Output() public openOpsModal = new EventEmitter()
  @Output() public download = new EventEmitter()

  constructor() { }
  ngOnInit(): void {
    console.log(this.customClassName);

  }
  onDelete(guid: any) {
    this.delete.emit(guid)
  }
  onActivate(guid: any) {
    this.activate.emit(guid)
  }
  onDeactivate(guid: string) {
    this.deactivate.emit(guid)
  }
  onOpenOpsModal(guid: any) {
    this.openOpsModal.emit(guid)
  }
  onDownloadFile(guid: any) {
    this.download.emit(guid)
  }
  showDetail(guid: string) {
    this.itemGuid = guid;
  }
}
