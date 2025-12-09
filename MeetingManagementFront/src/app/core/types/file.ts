export interface FileDetails {
    id: any;
    guid: string;
    fileName: string;
    contentType: string; // نوع MIME (مانند image/jpeg, application/pdf)
    file: string; // URL فایل برای بارگذاری در Angular
}
