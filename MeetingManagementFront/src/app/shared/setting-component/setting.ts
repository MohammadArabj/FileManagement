import { operationSuccessful } from '../app-messages'
import { createPreSelectedOption } from '../constants'
import { ActivatedRoute, ParamMap } from '@angular/router'
import { AfterViewChecked, Component, OnInit } from '@angular/core'
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service'
import { UserManagementSettingService } from '../../services/framework-services/user-management-setting.service'
import { ToastService } from '../../services/framework-services/toast.service'
import { FormsModule } from '@angular/forms'
import { NgFor, NgSwitch, NgSwitchCase } from '@angular/common'
import { UserManagementSettingModel } from '../../core/models/UserManagementSetting'
import { CustomSelectComponent, SelectOption } from '../custom-controls/custom-select'
import { CustomInputComponent } from '../custom-controls/custom-input'
import { ComboBase } from '../combo-base'
declare var $: any

@Component({
  selector: 'app-setting',
  templateUrl: './setting.html',
  imports: [CustomInputComponent, CustomSelectComponent, NgFor, FormsModule, NgSwitch, NgSwitchCase],
  standalone: true
})
export class SettingComponent implements OnInit, AfterViewChecked {

  calibrationSettings = []
  userManagementSettings: UserManagementSettingModel[] = []
  bitOptions = [
    { id: 0, name: 'خیر' },
    { id: 1, name: 'بلی' },
  ] as unknown as ComboBase[]

  constructor(private readonly route: ActivatedRoute,
    private readonly crumbService: BreadcrumbService,
    private readonly userManagementSettingService: UserManagementSettingService,
    private readonly toastService: ToastService) { }

  ngAfterViewChecked(): void {
  }

  ngOnInit(): void {
    this.crumbService.setTitle("تنظیمات کاربری")
    this.getUsermanagementSettings()
  }

  getUsermanagementSettings() {
    this.userManagementSettingService
      .getSettings()
      .subscribe(data => {

        this.userManagementSettings = data

        this.userManagementSettings
          .filter(x => x.fieldType == 'list')
          .forEach(item => {
            if (item.valueLabel) {
              return createPreSelectedOption(`#${item.id}`, item.valueLabel, item.value);
            }
          })
      })
  }

  submitUsermanagement() {
    const command: { items: { settingId: string; value: any; fieldType: "string" | "int" | "bit" | "list"; }[] } = {
      items: []
    }

    this.userManagementSettings.forEach(item => {
      command.items.push({
        settingId: item.id,
        value: item.value,
        fieldType: item.fieldType
      })
    })

    this.userManagementSettingService
      .edit(command)
      .subscribe(_ => {
        this.getUsermanagementSettings()
        this.toastService.success(operationSuccessful)
      })
  }
}
