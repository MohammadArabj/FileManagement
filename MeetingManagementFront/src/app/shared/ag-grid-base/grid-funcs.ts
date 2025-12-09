export function isEnglish(key: string) {
    return key.match(/[a-z]/i);
}

export function formatNumber(params: { value: number; }) {
    var floor = Math.floor(params.value);
    if (!floor) return params.value;
    return floor.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

export function isNumber(value: number) {
    return Math.floor(value);
}

export function toPrice(value: { toString: () => string; }) {
    return value.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

export const noImagePath = "../../../../../assets/images/noimage.png";
