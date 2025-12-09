import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
import { operationSuccessful } from '../../../shared/app-messages';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { PermissionService } from '../../../services/permission.service';
import { startWith } from 'rxjs';
import { DelegationService } from '../../../services/delegation.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { USER_ID_NAME } from '../../../core/types/configuration';
import { CustomSelectComponent } from "../../../shared/custom-controls/custom-select";
import { CustomInputComponent } from "../../../shared/custom-controls/custom-input";
import { UserService } from '../../../services/user.service';
import { SystemUser } from '../../../core/models/User';
import { ComboBase } from '../../../shared/combo-base';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
declare var $: any;
@Component({
  selector: 'app-delegation-op',
  imports: [ReactiveFormsModule, CustomSelectComponent, CustomInputComponent],
  templateUrl: './delegation-op.html',
  styleUrl: './delegation-op.css'
})
export class DelegationOpComponent implements OnInit {
  title = "ایجاد تفویض اختیار"
  guid: '' = ""
  hasGuid = false
  permissions = []
  selectedPermissions: any[] = []
  users: ComboBase[] = [];
  delegationOpsForm = new FormGroup({
    guid: new FormControl(),
    delegatorGuid: new FormControl(''),
    delegateeGuid: new FormControl('', Validators.required),
    startDate: new FormControl('', Validators.required),
    endDate: new FormControl('', Validators.required),
    clientId: new FormControl(''),
    permissions: new FormControl()
  })
  constructor(
    private readonly delegationService: DelegationService,
    private readonly route: ActivatedRoute,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly router: Router,
    private readonly permissionService: PermissionService,
    private readonly localStorageService: LocalStorageService,
    private readonly userService: UserService) {
  }

  loadUsers() {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);

    this.userService.getAllByClientId<SystemUser[]>(getClientSettings().client_id ?? "").subscribe((data: SystemUser[]) => {
      this.users = data
        .filter(c => c.guid !== userGuid)
        .map(user => ({
          guid: user.guid,
          title: user.name
        }));
    });
  }

  ngOnInit() {
    this.title = 'ثبت تفویض اختیار';


    this.route.paramMap.subscribe((params: ParamMap) => {
      const guid = params.get('guid')
      if (guid) {
        this.title = 'ویرایش تفویض اختیار';
        this.getDelegationDetails();
      }
      this.breadcrumbService.setItems([{ label: 'تفویض اختیار', routerLink: '/delegation/list' },
      { label: this.title, routerLink: '' }]);


      this.getPermissions();
    })
    this.loadUsers();
  }

  getPermissions() {
    this.permissionService
      .getDelegationPermissions(this.guid)
      .subscribe((data: any) => {
        data.forEach((item: any) => {

          if (data.find((x: { parent: any; selected: any; }) => x.parent == item.id && x.selected)) {
            item.state = { undetermined: true }
          } else if (data.find((x: { parent: any; selected: any; }) => x.parent != item.id && x.selected)) {
            item.state = { selected: item.selected }
          }

          if (item.selected)
            this.selectedPermissions.push(item.id)

        })

        $("#basicTree").jstree({
          checkbox: {
            "keep_selected_style": false
          },
          core: {
            "check_callback": true,
            themes: { responsive: !1 },
            'data': data,
          },
          types: {
            default: { icon: "fa fa-folder text-warning" }
          },
          plugins: ["types", "search", "checkbox"],
        })

        var to: any
        $('#plugins4_q').keyup(function () {
          if (to) { clearTimeout(to) }
          to = setTimeout(function () {
            var v = $('#plugins4_q').val()
            $('#basicTree').jstree(true).search(v)
          }, 250)
        })
      })
  }



  collapseAll() {
    $("#basicTree").jstree("close_all")
  }

  expandAll() {
    $("#basicTree").jstree("open_all")
  }

  getDelegationDetails() {
    this.delegationService
      .getForEdit(this.guid)
      .subscribe((data: any) => {
        this.delegationOpsForm.patchValue(data);
      })
  }

  onBtnCancelClick() {
    this.router.navigateByUrl('/delegation/list')
  }

  submit(action: any) {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const command = this.delegationOpsForm.value;
    command.delegatorGuid = userGuid;
    command.clientId = getClientSettings().client_id;
    command.permissions = $("#basicTree").jstree("get_selected")
    const undetermined = $("#basicTree").jstree("get_undetermined")
    undetermined.forEach((item: any) => {
      command.permissions.push(item)
    })

    if (!this.guid) {
      this.delegationService.create(command).subscribe((id: any) => {
        this.handleCreateEditOps(action, id)
      })
    } else {
      command.guid = this.guid
      this.delegationService.edit(command).subscribe(() => {
        this.handleCreateEditOps(action, this.guid)
      })
    }
  }

  handleCreateEditOps(action: string, id: any) {
    if (action == "new") {
      this.delegationOpsForm.reset()
      this.title = 'ایجاد تفویض اختیار='
    }
    else if (action == "exit") {
      this.router.navigateByUrl('/delegation/list')
    }
    else {
      this.title = 'ویرایش تفویض اختیار'
      this.router.navigateByUrl(`/delegation/edit/${id}`)
    }

  }

  onPermissionAdded(id: any) {
    this.selectedPermissions.push(id)
  }

  onPermissionRemoved(id: any) {
    const permissionIndex = this.selectedPermissions.findIndex(x => x.id == id)
    this.selectedPermissions.splice(permissionIndex, 1)
  }
}
