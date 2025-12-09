export class NotificationSettingDto {
    statusId: number;
    sendType: NotificationTriggerType;
    templateId: number;
    reminderHoursBefore?: number;

    constructor(
        statusId: number,
        sendType: NotificationTriggerType,
        templateId: number,
        reminderHoursBefore?: number
    ) {
        this.statusId = statusId;
        this.sendType = sendType;
        this.templateId = templateId;
        this.reminderHoursBefore = reminderHoursBefore;
    }
}

export enum NotificationTriggerType {
    Email = 'Email',
    SMS = 'SMS',
    PushNotification = 'PushNotification',
}