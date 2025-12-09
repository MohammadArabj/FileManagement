export interface ConflictResult {
    usersWithConflict: ConflictItem[]; // لیست userGuidهایی که تداخل دارند
    roomConflict: boolean; // اگر اتاق در این بازه زمانی رزرو شده
}

export type ConflictItem={
  guid:string,
  type:string
}
