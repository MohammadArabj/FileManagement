import { environment } from "../../../environments/environment";
import { FileService } from "../../services/file.service";
import { MeetingMember } from "../models/Meeting";
import { base64ToArrayBuffer } from "./configuration";
import { FileDetails } from "./file";

export class ImageCacheManager {
    private readonly cache = new Map<string, string>();
    private readonly loadingPromises = new Map<string, Promise<string>>();
    private readonly defaultImages = {
        board: '/assets/images/default-board-avatar.png',
        user: 'img/default-avatar.png',
        external: '/assets/images/default-guest-avatar.png'
    };
    getCachedImage(member: MeetingMember): string | null {
        const cacheKey = this.generateCacheKey(member);
        return this.cache.get(cacheKey) || null;
    }
    private generateCacheKey(member: MeetingMember): string {
        if (member.boardMemberGuid) {
            return `board_${member.boardMemberGuid}`;
        }
        if (member.userGuid && member.userName) {
            return `user_${member.userGuid}_${member.userName}`;
        }
        return `external_${member.guid}`;
    }

    async getImage(member: MeetingMember, fileService?: FileService): Promise<string> {
        const cacheKey = this.generateCacheKey(member);

        // بررسی کش
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        // بررسی اینکه آیا در حال بارگذاری است
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey)!;
        }

        // ایجاد promise جدید برای بارگذاری
        const loadPromise = this.loadImage(member, cacheKey, fileService);
        this.loadingPromises.set(cacheKey, loadPromise);

        try {
            const result = await loadPromise;
            this.cache.set(cacheKey, result);
            return result;
        } finally {
            this.loadingPromises.delete(cacheKey);
        }
    }

    private async loadImage(member: MeetingMember, cacheKey: string, fileService?: FileService): Promise<string> {
        try {
            if (member.isExternal) {
                return member.image || this.defaultImages.external;
            }

            if (member.boardMemberGuid && member.profileGuid && fileService) {
                const file = await fileService.getFileDetails(member.profileGuid).toPromise() as FileDetails;
                if (file) {
                    const blob = new Blob([base64ToArrayBuffer(file.file)], { type: file.contentType });
                    return URL.createObjectURL(blob);
                }
            }

            if (member.userName) {
                return `${environment.fileManagementEndpoint}/photo/${member.userName}.jpg`;
            }

            return this.getDefaultImage(member);
        } catch (error) {
            console.warn(`Failed to load image for member ${member.name}:`, error);
            return this.getDefaultImage(member);
        }
    }

    private getDefaultImage(member: MeetingMember): string {
        if (member.boardMemberGuid) return this.defaultImages.board;
        if (member.isExternal) return this.defaultImages.external;
        return this.defaultImages.user;
    }

    preloadImages(members: MeetingMember[], fileService?: FileService): void {
        // بارگذاری دسته‌ای تصاویر
        const BATCH_SIZE = 3;
        const batches: MeetingMember[][] = [];

        for (let i = 0; i < members.length; i += BATCH_SIZE) {
            batches.push(members.slice(i, i + BATCH_SIZE));
        }

        batches.forEach((batch, batchIndex) => {
            setTimeout(() => {
                batch.forEach(member => {
                    if (!member.isRemoved) {
                        this.getImage(member, fileService).catch(() => {
                            // خطاها در پیش‌بارگذاری نادیده گرفته می‌شوند
                        });
                    }
                });
            }, batchIndex * 100); // تاخیر بین batch ها
        });
    }

    cleanup(activeMembers: MeetingMember[]): void {
        const activeCacheKeys = new Set(
            activeMembers.map(member => this.generateCacheKey(member))
        );

        // حذف cache های غیرفعال
        for (const [key, value] of this.cache) {
            if (!activeCacheKeys.has(key) && value.startsWith('blob:')) {
                URL.revokeObjectURL(value);
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        // پاک کردن کامل کش
        for (const [key, value] of this.cache) {
            if (value.startsWith('blob:')) {
                URL.revokeObjectURL(value);
            }
        }
        this.cache.clear();
        this.loadingPromises.clear();
    }
}
