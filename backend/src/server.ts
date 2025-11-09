import express from 'express';
import cors from 'cors';
import webpush from 'web-push';
import cron from 'node-cron';
import { query } from './db/index.js';
import { cleanAttorneyName } from './services/utils.js';
import type { CaseProgress, Attorney, AlertCondition } from './types/progress.js';
import dayjs from 'dayjs';
import { IncomingMessage, Server, ServerResponse } from 'http';

console.log("--- server.ts script starting ---");

const app = express();
// process.env.PORT は文字列なので、Number() でラップして数値型であることを保証
const PORT = Number(process.env.PORT) || 50000; 

// 許可するオリジン（アクセス元）のリスト
app.use(cors({
  origin: [
    'http://localhost:5173',        // ローカル開発用 (Vite)
    'http://localhost:50001',       // プロキシ経由 (クライアントのアクセス先)
    'http://172.16.1.135:50001',    // フロントエンドのURL
    'http://172.16.1.11:5173'
  ]
}));

app.use(express.json());

// =============================================================================
// ★★★ ユーザー管理とプッシュ通知のセットアップ ★★★
// =============================================================================
const users = [
    { id: 1, username: 'attorney1', password: 'password', role: 'attorney', attorneyId: 1 }, // 長 裕康
    { id: 2, username: 'attorney2', password: 'password', role: 'attorney', attorneyId: 2 }, // 守時 弘展
    { id: 100, username: 'staff1', password: 'password', role: 'staff' },
];

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys are not set.");
} else {
    webpush.setVapidDetails('mailto:your-email@example.com', vapidPublicKey, vapidPrivateKey);
}

let userSubscriptions = new Map<number, { subscription: webpush.PushSubscription, follows: number[] }>();
let previouslyNotifiedAlerts = new Map<number, '黒' | '赤' | '黄'>();

// =============================================================================
// ★★★ マスターデータとヘルパー関数 ★★★
// =============================================================================
const attorneysMasterList: Attorney[] = [
    { attorney_id: 1, attorney_name: '長 裕康', email: null }, { attorney_id: 2, attorney_name: '守時 弘展', email: null },
    { attorney_id: 3, attorney_name: '高橋 正基', email: null }, { attorney_id: 4, attorney_name: '横松 紀子', email: null },
    { attorney_id: 5, attorney_name: '西田 千晃', email: null }, { attorney_id: 6, attorney_name: '相澤 達哉', email: null },
    { attorney_id: 7, attorney_name: '酒井 希', email: null }, { attorney_id: 8, attorney_name: '橘田 晃', email: null },
    { attorney_id: 9, attorney_name: '保多 崇志', email: null }, { attorney_id: 10, attorney_name: '池上 浩一', email: null },
];
const alertConditionsMasterList: AlertCondition[] = [
    { condition_id: 1, trigger_event: '書類督促遅延', condition_type: '赤', threshold_days_red: 14, threshold_days_yellow: 7, target_column: 'date_document_arrival', is_active: true },
    // ★ 修正1: アラート判定キーを date_first_greeting に修正
    { condition_id: 2, trigger_event: '初回挨拶遅延', condition_type: '赤', threshold_days_red: 3, threshold_days_yellow: 1, target_column: 'date_first_greeting', is_active: true }, 
];
const RED_TO_BLACK_DAYS = 3;

function calculateAlertStatus(caseItem: Partial<CaseProgress>): '黒' | '赤' | '黄' | null {
    const today = dayjs().startOf('day');
    let highestAlert: '黒' | '赤' | '黄' | null = null;
    for (const condition of alertConditionsMasterList) {
        if (!condition.is_active) continue;
        const targetDateStr = caseItem[condition.target_column as keyof CaseProgress] as string | null;
        if (!targetDateStr) continue;
        const targetDate = dayjs(targetDateStr);
        if (!targetDate.isValid()) continue;
        let isBlackTriggered = false, isRedTriggered = false, isYellowTriggered = false;
        const diffDays = today.diff(targetDate, 'day');
        if (condition.threshold_days_red != null && diffDays >= condition.threshold_days_red + RED_TO_BLACK_DAYS) isBlackTriggered = true;
        if (condition.threshold_days_red != null && diffDays >= condition.threshold_days_red) isRedTriggered = true;
        if (condition.threshold_days_yellow != null && diffDays >= condition.threshold_days_yellow) isYellowTriggered = true;
        
        // 警告レベルの昇順で設定
        if (isYellowTriggered && (!highestAlert || highestAlert === '黄')) highestAlert = '黄';
        if (isRedTriggered) highestAlert = '赤';
        if (isBlackTriggered) highestAlert = '黒';
    }
    return highestAlert;
}
function reverseMapData(data: Partial<CaseProgress>): { hasanData: any, clientData: any } {
    const hasanData: any = {};
    const clientData: any = {};
    const mapping: { [key in keyof CaseProgress]?: ['Hasan' | 'Client', string] } = {
        management_number: ['Hasan', '事件管理番号'], client_name: ['Hasan', '氏名'],
        staff_name: ['Hasan', '担当者'], case_type: ['Hasan', '種別'],
        jurisdiction: ['Hasan', '管轄'], date_filing: ['Hasan', '申立日'],
        case_number: ['Hasan', '申立事件番号'], date_supplementary_deadline: ['Hasan', '追完期日'],
        date_start_decision: ['Hasan', '開始決定日'], date_sent: ['Hasan', '送付日'],
        letapa_number: ['Hasan', 'レタパ番号'], deadline_date: ['Hasan', '期限日'],
        date_document_arrival: ['Hasan', '書類到着日'], 
        // ★ 修正2: date_creditor_list_completion -> date_creditor_list_complete に修正
        date_creditor_list_complete: ['Hasan', '債権者一覧作成完了日'],
        // ★ 修正3: date_first_hearing -> date_first_greeting に修正
        date_first_greeting: ['Hasan', '初回挨拶日'], 
        extension_period: ['Hasan', '猶予期間'], 
        notes: ['Hasan', '備考'], reminder_documents_dates: ['Hasan', '詳細状況（聞取後）'],
        date_pre_hearing: ['Hasan', '聞き取り日'], date_exemption_decision: ['Hasan', '免責日'],
        date_approval_decision: ['Hasan', '認可日'], notes_document_sending: ['Hasan', '備考（書類未達）'],
        notes_after_filing: ['Hasan', '備考（終了）'], date_received: ['Client', '受託日'],
        date_plan_submission_deadline: ['Client', '再生計画案提出日'],
        // ★ 修正4: date_finished は ClientTable の 完了日 にマッピング
        date_finished: ['Client', '完了日'], 
    };
    for (const key in data) {
        const typedKey = key as keyof CaseProgress;
        if (typedKey === 'attorney_id' && data.attorney_id) {
            const attorney = attorneysMasterList.find(a => a.attorney_id === data.attorney_id);
            if (attorney) hasanData['弁護士'] = attorney.attorney_name;
            continue;
        }
        if (mapping[typedKey]) {
            const [table, dbColumn] = mapping[typedKey]!;
            const value = data[typedKey];
            if (table === 'Hasan') {
                hasanData[dbColumn] = typedKey === 'reminder_documents_dates' ? JSON.stringify(value) : value;
            } else {
                clientData[dbColumn] = value;
            }
        }
    }
    return { hasanData, clientData };
}

// =============================================================================
// ★★★ APIエンドポイント定義 ★★★
// =============================================================================

app.post('/api/login', (req, res) => { /* ... */ });
app.post('/api/notification-settings', (req, res) => { /* ... */ });
app.get('/api/cases', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string || '1');
        const limit = parseInt(req.query.limit as string || '50');
        const offset = (page - 1) * limit;
        const attorneyId = req.query.attorneyId as string;
        
        // ★ 修正点 1: 検索キーワードの取得を追加
        const searchTerm = req.query.search as string; 
        
        // ★ デバッグログの追加
        console.log(`[DEBUG /api/cases] Received search term: "${searchTerm}"`);
        
        const attorneys = attorneysMasterList;
        const whereClauses: string[] = [];
        let queryParams: (string | number)[] = []; // let に変更

        // 1. 担当弁護士によるフィルタリング
        if (attorneyId && attorneyId !== 'すべて') {
            const selectedAttorney = attorneys.find(a => String(a.attorney_id) === attorneyId);
            if (selectedAttorney) {
                const searchName = cleanAttorneyName(selectedAttorney.attorney_name).split(' ')[0];
                whereClauses.push(`t1."弁護士" LIKE $${queryParams.length + 1}`);
                queryParams.push(`%${searchName}%`);
            }
        }

        // 2. 検索キーワードによるフィルタリング (氏名 or 管理番号)
        if (searchTerm) {
            const searchPattern = `%${searchTerm}%`;
            const currentParamIndex = queryParams.length + 1;
            // WHERE句を追加
            whereClauses.push(`(t1."氏名" ILIKE $${currentParamIndex} OR t1."事件管理番号" ILIKE $${currentParamIndex + 1})`);
            // パラメータを追加 (2つのプレースホルダに同じ値をバインド)
            queryParams.push(searchPattern, searchPattern); 
        }
        
        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        // 全件数カウント
        const countSql = `SELECT COUNT(t1.id) FROM "HasanSaiseiTable" AS t1 ${whereString}`;
        const countResult = await query(countSql, queryParams);
        const totalCount = parseInt(countResult.rows[0].count, 10);
        
        // ページング用のクエリパラメータを結合
        // LIMIT ($N+1) と OFFSET ($N+2) のインデックスを決定
        const limitParamIndex = queryParams.length + 1;
        const offsetParamIndex = queryParams.length + 2;
        const finalQueryParams = [...queryParams, limit, offset]; // ★ 修正: limitとoffsetを配列の最後に追加

        const sql = `
            SELECT t1.*, t2."受託日", t2."氏" AS "client_shi", t2."名" AS "client_mei", t2."再生計画案提出日",
                t2."完了日" AS "client_kanryoubi" -- ★ 修正4: ClientTableから完了日を取得
            FROM "HasanSaiseiTable" AS t1
            LEFT JOIN "ClientTable" AS t2 ON t1."事件管理番号" = t2."事件管理番号"
            ${whereString}
            ORDER BY t2."受託日" DESC NULLS LAST
            LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex};
        `;
        const caseResult = await query(sql, finalQueryParams);
        
        const mappedCases = caseResult.rows.map(row => {
            const clientName = (row.氏名 && row.氏名.trim() !== '') ? row.氏名 : `${row.client_shi || ''} ${row.client_mei || ''}`.trim();
            const cleanedName = cleanAttorneyName(row.弁護士);
            const attorney = attorneys.find(a => cleanedName && a.attorney_name.startsWith(cleanedName));
            let reminderDates: string[] = [];
            try {
                if(row["詳細状況（聞取後）"]) reminderDates = JSON.parse(row["詳細状況（聞取後）"]);
            } catch (e) {
                console.warn(`Could not parse reminder_documents_dates for case ${row.id}`);
            }
            const mappedCase: Partial<CaseProgress> = {
                case_id: row.id, management_number: row.事件管理番号, client_name: clientName,
                attorney_id: attorney ? attorney.attorney_id : null, attorney_name: attorney ? attorney.attorney_name : cleanedName,
                staff_name: row.担当者, case_type: row.種別, date_received: row.受託日,
                date_sent: row.送付日, letapa_number: row.レタパ番号, deadline_date: row.期限日,
                date_document_arrival: row.書類到着日, notes_document_sending: row["備考（書類未達）"],
                // ★ 修正5: CaseProgress 型に合わせる (債権者一覧作成完了日)
                date_creditor_list_complete: row.債権者一覧作成完了日, 
                date_staff_assignment: row.担当振分日,
                // ★ 修正6: CaseProgress 型に合わせる (初回挨拶日)
                date_first_greeting: row.初回挨拶日, 
                listening_documents_missing_guide: row["詳細状況（聞取後）"],
                missing_documents_notes: undefined, reminder_documents_dates: reminderDates,
                extension_period: row.猶予期間, notes_preparation: row.備考, jurisdiction: row.管轄,
                date_filing: row.申立日, case_number: row.申立事件番号,
                date_supplementary_deadline: row.追完期日, date_start_decision: row.開始決定日,
                date_pre_hearing: row.聞き取り日, date_exemption_decision: row.免責日,
                date_approval_decision: row.認可日, date_plan_submission_deadline: row.再生計画案提出日,
                // ★ 修正7: 最終的な終了日として ClientTable.完了日 を使用
                date_finished: row.client_kanryoubi, 
                notes_after_filing: row["備考（終了）"],
                is_unanswered: false, is_trustee_case: false,
            };
            return { ...mappedCase, alert_status: calculateAlertStatus(mappedCase) };
        });
        const finalCases = mappedCases.filter(c => c.client_name && c.client_name.trim() !== '');
        res.json({ cases: finalCases, totalCount: totalCount });
    } catch (err) {
        console.error('Error fetching cases:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/alerts', async (req, res) => {
    try {
        const sql = `
            SELECT t1."id", t1."事件管理番号", t1."氏名" AS "hasan_shimei", t1."弁護士" AS "attorney_raw", 
                   t1."初回挨拶日", t1."書類到着日", t2."氏" AS "client_shi", t2."名" AS "client_mei" 
            FROM "HasanSaiseiTable" AS t1 
            LEFT JOIN "ClientTable" AS t2 ON t1."事件管理番号" = t2."事件管理番号"
        `;
        const caseResult = await query(sql);
        const allMappedCases = caseResult.rows.map(row => {
            const clientName = (row.hasan_shimei && row.hasan_shimei.trim() !== '') ? row.hasan_shimei : `${row.client_shi || ''} ${row.client_mei || ''}`.trim();
            const cleanedName = cleanAttorneyName(row.attorney_raw);
            const attorney = attorneysMasterList.find(a => cleanedName && a.attorney_name.startsWith(cleanedName));
            const mappedCase: Partial<CaseProgress> = {
                case_id: row.id, management_number: row.事件管理番号, client_name: clientName, attorney_name: attorney ? attorney.attorney_name : cleanedName,
                // ★ 修正8: alertsエンドポイントでも進捗判定に必要なキー名に合わせる
                date_first_greeting: row.初回挨拶日, 
                date_document_arrival: row.書類到着日,
                is_unanswered: false,
            };
            // ★ 修正: デバッグログの場所を移動し、管理番号を含むように修正
            // ここでのデバッグは不要なため削除
            return { ...mappedCase, alert_status: calculateAlertStatus(mappedCase) };
        });
        res.json(allMappedCases);
    } catch (err) {
        console.error('Error fetching alerts:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/attorneys', (req, res) => {
  const formalAttorneys = attorneysMasterList.filter(attorney => !attorney.attorney_name.endsWith('先生'));
  res.json(formalAttorneys);
});
// ★★★ 修正点: POST /api/cases の本格実装 ★★★
app.post('/api/cases', async (req, res) => {
    const newCaseData = req.body;
    const { hasanData, clientData } = reverseMapData(newCaseData);

    try {
        // 1. HasanSaiseiTableに新しい行を挿入
        const hasanFields = Object.keys(hasanData);
        const hasanValues = Object.values(hasanData);
        const hasanPlaceholders = hasanFields.map((_, i) => `$${i + 1}`).join(', ');
        
        const hasanSql = `
            INSERT INTO "HasanSaiseiTable" (${hasanFields.map(f => `"${f}"`).join(', ')})
            VALUES (${hasanPlaceholders})
            RETURNING id, "事件管理番号";
        `;
        const hasanResult = await query(hasanSql, hasanValues);
        const newCaseId = hasanResult.rows[0].id;
        const managementNumber = hasanResult.rows[0].事件管理番号;

        // 2. ClientTableにも新しい行を挿入 (事件管理番号をキーにする)
        clientData['事件管理番号'] = managementNumber; // JOINキーを追加
        const clientFields = Object.keys(clientData);
        const clientValues = Object.values(clientData);
        const clientPlaceholders = clientFields.map((_, i) => `$${i + 1}`).join(', ');

        const clientSql = `
            INSERT INTO "ClientTable" (${clientFields.map(f => `"${f}"`).join(', ')})
            VALUES (${clientPlaceholders});
        `;
        await query(clientSql, clientValues);

        console.log(`New case created with ID: ${newCaseId}`);
        res.status(201).json({ message: 'Case created successfully', newCaseId });

    } catch (err) {
        console.error('Error creating new case:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.patch('/api/cases/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const { hasanData, clientData } = reverseMapData(updates);
    try {
        if (Object.keys(hasanData).length > 0) {
            const setClauses = Object.keys(hasanData).map((field, i) => `"${field}" = $${i + 1}`).join(', ');
            const values = Object.values(hasanData);
            const sql = `UPDATE "HasanSaiseiTable" SET ${setClauses} WHERE id = $${values.length + 1}`;
            await query(sql, [...values, id]);
        }
        if (Object.keys(clientData).length > 0) {
            const mgmtNumResult = await query(`SELECT "事件管理番号" FROM "HasanSaiseiTable" WHERE id = $1`, [id]);
            const managementNumber = mgmtNumResult.rows[0]?.事件管理番号;
            if (managementNumber) {
                const setClauses = Object.keys(clientData).map((field, i) => `"${field}" = $${i + 1}`).join(', ');
                const values = Object.values(clientData);
                const sql = `UPDATE "ClientTable" SET ${setClauses} WHERE "事件管理番号" = $${values.length + 1}`;
                await query(sql, [...values, managementNumber]);
            }
        }
        res.status(200).json({ message: 'Update successful' });
    } catch (err) {
        console.error(`Error updating case ${id}:`, err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/api/subscribe', (req, res) => {
    const { userId, subscription } = req.body;
    userSubscriptions.set(userId, { subscription, follows: [] });
    console.log(`Subscription added for user ${userId}. Total subscriptions: ${userSubscriptions.size}`);
    res.status(201).json({ message: 'Subscription successful' });
});

// =============================================================================
// ★★★ 定期実行ジョブ (アラートチェック & プッシュ通知) ★★★
// =============================================================================
async function checkForAlertsAndNotify() {
    console.log("Running scheduled job: checking for new alerts...");
    if (userSubscriptions.size === 0) {
        console.log("No push subscribers. Skipping notification check.");
        return;
    }
    try {
        const sql = `
            SELECT t1.*, t2."氏" AS "client_shi", t2."名" AS "client_mei" 
            FROM "HasanSaiseiTable" AS t1 
            LEFT JOIN "ClientTable" AS t2 ON t1."事件管理番号" = t2."事件管理番号"
        `;
        const result = await query(sql);
        const newOrEscalatedAlerts: CaseProgress[] = [];
        const currentAlerts = new Map<number, '黒' | '赤' | '黄'>();
        for (const row of result.rows) {
            const clientName = (row.氏名 && row.氏名.trim() !== '') ? row.氏名 : `${row.client_shi || ''} ${row.client_mei || ''}`.trim();
            if (!clientName) continue;
            const cleanedName = cleanAttorneyName(row.弁護士);
            const attorney = attorneysMasterList.find(a => cleanedName && a.attorney_name.startsWith(cleanedName));
            const mappedCase: Partial<CaseProgress> = {
                case_id: row.id,
                client_name: clientName,
                attorney_id: attorney ? attorney.attorney_id : null,
                attorney_name: attorney ? attorney.attorney_name : cleanedName,
                // ★ 修正8: alertsエンドポイントでも進捗判定に必要なキー名に合わせる
                date_first_greeting: row.初回挨拶日, 
                date_document_arrival: row.書類到着日,
            };
            const alertStatus = calculateAlertStatus(mappedCase);
            if (alertStatus) {
                currentAlerts.set(row.id, alertStatus);
                const previousStatus = previouslyNotifiedAlerts.get(row.id);
                const alertLevels = { '黄': 1, '赤': 2, '黒': 3 };
                const previousLevel = previousStatus ? alertLevels[previousStatus] : 0;
                const currentLevel = alertLevels[alertStatus];
                if (currentLevel > previousLevel) {
                    newOrEscalatedAlerts.push({ ...mappedCase, alert_status: alertStatus } as CaseProgress);
                }
            }
        }
        if (newOrEscalatedAlerts.length > 0) {
            for (const [userId, userSub] of userSubscriptions.entries()) {
                const user = users.find(u => u.id === userId);
                if (!user) continue;
                const userSpecificAlerts = newOrEscalatedAlerts.filter(alert => {
                    if (user.role === 'staff') return true;
                    if (user.role === 'attorney') {
                        return alert.attorney_id === user.attorneyId || userSub.follows.includes(alert.attorney_id!);
                    }
                    return false;
                });
                if (userSpecificAlerts.length > 0) {
                    const counts = {
                        '黒': userSpecificAlerts.filter(c => c.alert_status === '黒').length,
                        '赤': userSpecificAlerts.filter(c => c.alert_status === '赤').length,
                        '黄': userSpecificAlerts.filter(c => c.alert_status === '黄').length,
                    };
                    const titleParts = [];
                    if (counts.黒 > 0) titleParts.push(`緊急(黒):${counts.黒}件`);
                    if (counts.赤 > 0) titleParts.push(`重大(赤):${counts.赤}件`);
                    if (counts.黄 > 0) titleParts.push(`警告(黄):${counts.黄}件`);
                    const title = `【アラート通知】${titleParts.join(', ')} が発生`;
                    let summaryBody = '担当者別の内訳:\n';
                    const alertsByAttorney: { [key: string]: number } = {};
                    for (const caseItem of userSpecificAlerts) {
                        const attorneyName = caseItem.attorney_name || '担当者なし';
                        alertsByAttorney[attorneyName] = (alertsByAttorney[attorneyName] || 0) + 1;
                    }
                    for (const attorneyName in alertsByAttorney) {
                        summaryBody += `- ${attorneyName}: ${alertsByAttorney[attorneyName]}件\n`;
                    }
                    const payload = JSON.stringify({ title, body: summaryBody });
                    webpush.sendNotification(userSub.subscription, payload).catch((error: any) => {
                        console.error(`Error sending notification to user ${userId}:`, error);
                    });
                }
            }
        }
        previouslyNotifiedAlerts = currentAlerts;
    } catch (error) {
        console.error("Error during scheduled alert check:", error);
    }
}
  
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    console.log(`Network access available at http://172.16.1.135:${PORT}`);
    cron.schedule('0 9 * * *', checkForAlertsAndNotify, {
    timezone: 'Asia/Tokyo',});
    console.log('プッシュ通知のスケジュールされたジョブは毎日午前9時に実行されています。');
});