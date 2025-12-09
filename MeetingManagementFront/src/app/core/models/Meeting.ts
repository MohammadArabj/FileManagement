export interface Meeting {
  id?: string; // برای ویرایش جلسه
  title: string; // عنوان جلسه
  group: string; // گروه جلسه
  location: string; // محل برگزاری
  date: string; // تاریخ جلسه (فرمت YYYY-MM-DD)
  startTime: string; // ساعت شروع
  endTime: string; // ساعت پایان
  isFollowUp: boolean; // آیا پیرو جلسه دیگری است؟
  followUpMeetingId?: string; // شماره جلسه مادر در صورت پیرو بودن
  members: MeetingMember[]; // اعضای جلسه
  agendaItems: AgendaItem[]; // دستورات جلسه
}

export interface MeetingMember {
  boardMemberGuid?: any;
  userName?: string;
  signerName?: string;
  signerUserName?: string;
  isRemoved: boolean;
  replacementUserGuid?: any;
  role?: string;
  userGuid?: string;
  id?: number;
  roleId: any;
  image?: any;
  gender?:string;
  guid: string; // شناسه
  name: string; // نام کاربر یا عضو
  isExternal: boolean; // آیا خارج از سازمان است؟
  mobile?: string;
  email?: string;
  organization?: string;
  isPresent?: boolean | null;
  isAttendance?: boolean;//اعلام حضور
  isSign?: boolean;
  comment?: string;
  roleColor?: string;
  substitute?: string;
  isDelegate?: boolean;
  signatureGuid?: string;
  profileGuid?: string;
  positionGuid?: string;
  position?: string;
  signer?: string;
  isSystem?:boolean
}

export interface AgendaItem {
  id?: string; // شناسه دستور جلسه
  text: string; // توضیحات دستور
  fileUrl?: string; // لینک فایل آپلود شده
}

export interface MeetingDetails {
  id: any;
  userGuids: string[];
  creator?: string;
  followMeeting?: string;
  rider?: string;
  riderGuid?: string;
  guid?: string;
  title: string;
  date: string;
  category: string;
  mtDate: string;
  startTime: string;
  endTime: string;
  location: string;
  number: string;
  description?: string;
  followGuid?: string;
  agenda?: string;
  agendaFileGuid?: string;
  roleId: number;
  statusId: number;
  chairman: string;
  secretary: string;
}
