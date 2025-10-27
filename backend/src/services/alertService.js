// backend/src/services/alertService.ts
import { query } from '../db/index.js';
import dayjs from 'dayjs'; // 日付操作ライブラリ
/**
 * 全ての案件のアラート状態をチェックし、必要であればDBを更新する
 */
export async function checkAllCaseAlerts() {
    console.log('Running alert check...');
    const today = dayjs().startOf('day');
    // 1. 有効なアラート条件と全案件データを取得
    const conditionsResult = await query('SELECT * FROM alert_conditions WHERE is_active = TRUE');
    const casesResult = await query('SELECT * FROM cases_progress');
    const conditions = conditionsResult.rows;
    const cases = casesResult.rows;
    // FIX 3: Change the type to include 'null'
    const updates = [];
    // 2. 各案件に対して、全てのアラート条件を判定
    for (const caseItem of cases) {
        let highestAlert = null;
        for (const condition of conditions) {
            const targetDateStr = caseItem[condition.target_column];
            if (!targetDateStr)
                continue;
            const targetDate = dayjs(targetDateStr);
            if (!targetDate.isValid())
                continue;
            let isTriggered = false;
            // 3. イベントタイプに応じたロジックで判定
            switch (condition.trigger_event) {
                case '書類督促遅延':
                case '初回挨拶遅延':
                case '事情聴取遅延':
                case '認可後確定遅延':
                    if (today.diff(targetDate, 'day') >= condition.threshold_days) {
                        isTriggered = true;
                    }
                    break;
                case '追完期日間近':
                case '再生計画案締切日間近':
                    const daysUntil = targetDate.diff(today, 'day');
                    if (daysUntil >= 0 && daysUntil <= condition.threshold_days) {
                        isTriggered = true;
                    }
                    break;
                case '猶予期間超過':
                    if (targetDate.isBefore(today)) {
                        isTriggered = true;
                    }
                    break;
            }
            // 4. アラートレベルを更新
            if (isTriggered) {
                if (condition.condition_type === '赤') {
                    highestAlert = '赤';
                }
                else if (condition.condition_type === '黄' && highestAlert !== '赤') {
                    highestAlert = '黄';
                }
            }
        }
        // 5. 状態に変化があれば更新リストに追加
        if (caseItem.alert_status !== highestAlert) {
            updates.push({ caseId: caseItem.case_id, newStatus: highestAlert });
        }
    }
    // 6. DBを一括更新
    if (updates.length > 0) {
        console.log(`Updating ${updates.length} cases...`);
        for (const update of updates) {
            await query('UPDATE cases_progress SET alert_status = $1 WHERE case_id = $2', [update.newStatus, update.caseId]);
        }
    }
    else {
        console.log('No status changes detected.');
    }
}
//# sourceMappingURL=alertService.js.map