export class TabConfig {
  
  id: string = 'ops-tab';
  size?: string;
  tabTitle?: string;
  closeButtonLabel: string = 'انصراف';
  submitButtonLabel: string = 'ذخیره';
  titleClassName?: string;
  disableSubmitButton: boolean = false;
  disableCloseButton: boolean = false;
  hideSubmitButton: boolean = false;
  hideCloseButton: boolean = false;
  hideHeader: boolean = false;
  hideFooter: boolean = false;
  dualSave: boolean = true;
  constructor(id: string) {
    this.id = id;
  }
}
