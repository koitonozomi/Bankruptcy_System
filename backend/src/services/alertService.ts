import type { CaseProgress, AlertCondition } from '../types/progress.js';
import { query } from '../db/index.js';
import dayjs from 'dayjs';
import axios from 'axios';

const RED_TO_BLACK_DAYS = 3;

export async function checkAllCaseAlerts() {
  console.log('Running alert check...');
  /*
  const today = dayjs().startOf('day');
  const todayString = today.format('YYYY-MM-DD');

  const [conditionsResult, casesResult] = await Promise.all([
    query('SELECT * FROM alert_conditions WHERE is_active = TRUE'),
    query(`
      SELECT cp.*, a.attorney_name 
      FROM cases_progress cp
      LEFT JOIN attorneys a ON cp.attorney_id = a.attorney_id
    `)
  ]);

  const conditions: AlertCondition[] = conditionsResult.rows;
  const cases: CaseProgress[] = casesResult.rows;

  const updates: { caseItem: CaseProgress; newStatus: '黒' | '赤' | '黄' | null, triggeringCondition?: AlertCondition }[] = [];

  for (const caseItem of cases) {
    let highestAlert: '黒' | '赤' | '黄' | null = null;
    let triggeringCondition: AlertCondition | undefined = undefined;

    for (const condition of conditions) {
      const targetDateStr = caseItem[condition.target_column as keyof CaseProgress] as string | null;
      if (!targetDateStr) continue;

      const targetDate = dayjs(targetDateStr);
      if (!targetDate.isValid()) continue;

      let isBlackTriggered = false;
      let isRedTriggered = false;
      let isYellowTriggered = false;

      switch (condition.trigger_event) {
        case '書類督促遅延':
        case '初回挨拶遅延':
        case '事情聴取遅延':
        case '認可後確定遅延':
        case '猶予期間超過': {
          const diffDays = today.diff(targetDate, 'day');
          if (diffDays >= condition.threshold_days_red + RED_TO_BLACK_DAYS) {
            isBlackTriggered = true;
          }
          if (diffDays >= condition.threshold_days_red) {
            isRedTriggered = true;
          }
          if (condition.threshold_days_yellow != null && diffDays >= condition.threshold_days_yellow) {
            isYellowTriggered = true;
          }
          break;
        }
        case '追完期日間近':
        case '再生計画案締切日間近': {
          const daysUntil = targetDate.diff(today, 'day');
          if (daysUntil >= 0) {
            if (daysUntil <= condition.threshold_days_red) {
              isRedTriggered = true;
            }
            if (condition.threshold_days_yellow != null && daysUntil <= condition.threshold_days_yellow) {
              isYellowTriggered = true;
            }
          }
          break;
        }
      }

      if (isYellowTriggered) {
        highestAlert = '黄';
        triggeringCondition = condition;
      }
      if (isRedTriggered) {
        highestAlert = '赤';
        triggeringCondition = condition;
      }
      if (isBlackTriggered) {
        highestAlert = '黒';
        triggeringCondition = condition;
      }
    }

    if (caseItem.alert_status !== highestAlert) {
      updates.push({ caseItem, newStatus: highestAlert, triggeringCondition });
    } else if (highestAlert === '黒') {
      // ステータスは'黒'のままだが、再通知が必要かチェックするためにリストに追加
      updates.push({ caseItem, newStatus: '黒', triggeringCondition });
    }
  }

  // --- DB更新と通知 ---
  if (updates.length > 0) {
    console.log(`Checking ${updates.length} cases for updates/notifications...`);
    for (const update of updates) {
      // 状態に変化があればDBのステータスを更新
      if(update.caseItem.alert_status !== update.newStatus) {
        await query(
          'UPDATE cases_progress SET alert_status = $1 WHERE case_id = $2',
          [update.newStatus, update.caseItem.case_id]
        );
      }

      // ★★★ 新しいChatwork通知のロジック ★★★
      const lastSentDate = update.caseItem.last_notification_sent_at 
        ? dayjs(update.caseItem.last_notification_sent_at).format('YYYY-MM-DD') 
        : null;

      // 新しいステータスが'黒'で、かつ、今日まだ通知を送っていない場合に通知
      if (update.newStatus === '黒' && lastSentDate !== todayString && update.triggeringCondition) {
        await sendChatworkNotification(update.caseItem, update.triggeringCondition);
        // DBに今日の日付を記録（再通知を防ぐため）
        await query(
          'UPDATE cases_progress SET last_notification_sent_at = $1 WHERE case_id = $2',
          [todayString, update.caseItem.case_id]
        );
      }
    }
  } else {
    console.log('No status changes detected.');
  }

  // 「対応された」案件の通知日をリセット
  const blackStatusCases = cases.filter(c => c.alert_status === '黒');
  for (const caseItem of blackStatusCases) {
    const isStillBlack = updates.some(u => u.caseItem.case_id === caseItem.case_id && u.newStatus === '黒');
    // 以前は黒だったが、今回のチェックで黒でなくなった場合
    if (!isStillBlack) {
      await query(
        'UPDATE cases_progress SET last_notification_sent_at = NULL WHERE case_id = $1',
        [caseItem.case_id]
      );
      console.log(`Reset notification date for resolved case: ${caseItem.client_name}`);
    }
  } */
}



/**
 * Chatworkに緊急アラート通知を送信する関数
 */
async function sendChatworkNotification(caseItem: CaseProgress, condition: AlertCondition) {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;

  if (!token || !roomId) {
    console.error('Chatwork API token or Room ID is not set in .env file.');
    return;
  }

  const message = `[toall]
【緊急黒アラート発生】
至急、以下の案件の対応をお願いします。
--------------------
依頼人氏名: ${caseItem.client_name}
事件番号: ${caseItem.case_number || '未設定'}
担当弁護士: ${caseItem.attorney_name || '未設定'}
担当事務員: ${caseItem.staff_name || '未設定'}
遅延発生項目: ${condition.trigger_event}
--------------------`;

  try {
    await axios.post(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      new URLSearchParams({ body: message }).toString(), // ★ application/x-www-form-urlencoded 形式に修正
      { headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    console.log(`Sent Chatwork notification for case: ${caseItem.client_name}`);
  } catch (error: any) {
    console.error('Failed to send Chatwork notification:', error.response?.data || error.message);
  }
}