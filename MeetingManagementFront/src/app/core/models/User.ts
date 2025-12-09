export interface SystemUser {
    positionGuid: any;
    guid: string;
    name: string;
    userName: string;
    position: string;
    positions?: Position[];
    image: string;
    isSystem?: boolean;
    baseUserGuid?: string;
}
export interface Position{
    positionGuid: string;
    positionTitle:string
}

// گسترش interface SystemUser برای پشتیبانی از اطلاعات اضافی
export interface ExtendedSystemUser extends SystemUser {
    userType?: 'BoardMember' | 'SystemUser'; // نوع کاربر
    originalSource?: 'BoardMembers' | 'Users'; // منبع اصلی داده
    systemPosition?: string; // سمت سیستمی (اگر متفاوت از سمت هیئت مدیره باشد)
    hasSystemAccess?: boolean; // آیا دسترسی سیستمی دارد؟
    priority?: number; // اولویت نمایش
}

// یا می‌توانید از intersection type استفاده کنید
export type EnhancedSystemUser = SystemUser & {
    userType?: 'BoardMember' | 'SystemUser';
    originalSource?: 'BoardMembers' | 'Users';
    systemPosition?: string;
    hasSystemAccess?: boolean;
    priority?: number;
}