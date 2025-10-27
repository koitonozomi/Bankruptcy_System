// backend/src/services/utils.ts
/**
 * 複雑な弁護士名の文字列から、最終的な担当者名を正規化（クリーニング）する
 * 例: "清水→高橋先生（管財）" → "高橋"
 * @param rawName DBから取得した生の弁護士名
 * @returns クリーニングされた弁護士名
 */
export function cleanAttorneyName(rawName) {
    if (!rawName || rawName === '--')
        return '';
    let name = rawName;
    // "→" が含まれていれば、最後の部分を名前とする
    if (name.includes('→')) {
        const parts = name.split('→');
        name = parts[parts.length - 1];
    }
    // "（" や "(" が含まれていれば、その前の部分を名前とする
    if (name.includes('（'))
        name = name.split('（')[0];
    if (name.includes('('))
        name = name.split('(')[0];
    // "先生" を取り除く
    name = name.replace(/先生/g, '');
    // 前後の空白をトリム
    return name.trim();
}
//# sourceMappingURL=utils.js.map