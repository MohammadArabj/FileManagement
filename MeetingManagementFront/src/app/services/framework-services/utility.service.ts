import { Injectable } from '@angular/core';
declare var $: any;

@Injectable()
export class UtilityService {
    generateSlug(text: string) {
        let slug = '';
        const trimmed = $.trim(text);
        slug = trimmed.replace(/[^a-z0-9-آ-ی-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        return slug.toLowerCase();
    }
}
