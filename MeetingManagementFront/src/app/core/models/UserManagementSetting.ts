
export interface UserManagementSettingModel {

    id: string;

    description: string;

    fieldType: 'string' | 'int' | 'bit' | 'list';

    value: any;

    minValue?: number;

    maxValue?: number;

    listName?: string;

    valueLabel?: string;

}