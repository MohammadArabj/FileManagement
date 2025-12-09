import { NgClass, NgIf } from '@angular/common'
import { ModalConfig } from './modal.config'
import { Component, EventEmitter, Input, Output, AfterViewChecked, signal } from '@angular/core'
declare var $: any

@Component({
    selector: 'app-modal',
    templateUrl: './modal.html',
    standalone: true,
})
export class ModalComponent implements AfterViewChecked {
    @Input() set config(value: ModalConfig) {
        this.modalConfig.set(value)
    }

    public modalConfig = signal<ModalConfig>({} as ModalConfig)

    @Output() submited = new EventEmitter<any>()
    @Output() onModalHide = new EventEmitter()

    ngAfterViewChecked(): void { }

    open() {
        const config = this.modalConfig()
        switch (config.size) {
            case 'large':
                this.modalConfig.update(c => ({ ...c, size: 'modal-lg'}))
                break
            case 'full':
                this.modalConfig.update(c => ({ ...c, size: 'modal-full-width' }))
                break
        }
        $(`#${config.id}`).modal('show')
        $('.modal-dialog').draggable({
            handle: ".modal-body"
        });
    }

    submit(action: any) {
        this.submited.emit(action)
    }

    close() {
        this.onModalHide.emit();
        $(`#${this.modalConfig().id}`).modal('hide')
    }
}