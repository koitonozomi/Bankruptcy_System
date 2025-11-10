import express from 'express';
import cors from 'cors';
import webpush from 'web-push';
import cron from 'node-cron';
import { query } from './db/index.js';
import { cleanAttorneyName } from './services/utils.js';
import dayjs from 'dayjs';
import fetch from 'node-fetch'; // 🌟 修正: node-fetchのインポート (インストールが必要です)
// ★★★ ここから追加 ★★★
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
console.log("--- server.ts script starting ---");
const app = express();
const PORT = Number(process.env.PORT) || 50000;
// 許可するオリジン（アクセス元）のリスト
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:50001',
    'http://172.16.1.135:50001',
    'http://172.16.1.11:5173',
    'http://172.16.1.11:50001'
];
app.use(cors({
    origin: function (origin, callback) {
        // originが許可リストにある、または存在しない（例: Postman）ならOK
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.warn(`❌ Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// JSONリクエスト対応
app.use(express.json());
// =============================================================================
// ★★★ Chatwork API 設定 ★★★
// 🚨 注意: 本来トークンは環境変数で管理すべきです
const CHATWORK_API_TOKEN = "30b14194d6d1568285fc50d17dabe9ef"; // フロントエンドのトークンを使用
// 🌟 修正 2: ルームIDを奥田義一様のChatwork IDに設定 (テスト用)
const CHATWORK_ROOM_ID = "400391800";
// --- ユーザー情報のハードコード (DBの代わり) ---
const users = [
    // --- システム部・管理者ユーザー ---
    { id: 1, username: 'osa.h', password: 'osa.h_pass', role: 'admin' },
    { id: 2, username: 'moritoki.h', password: 'moritoki.h_pass', role: 'admin' },
    { id: 3, username: 'koito.n', password: 'koito.n_pass', role: 'admin' },
    { id: 4, username: 'setogawa.m', password: 'setogawa.m_pass', role: 'admin' },
    { id: 5, username: 'sys', password: 'sys_pass', role: 'admin' },
    // --- 弁護士ユーザー ---
    { id: 10, username: 'takahashi.m', password: 'takahashi.m_pass', role: 'attorney', attorneyId: 1 },
    { id: 11, username: 'yokomatsu.n', password: 'yokomatsu.n_pass', role: 'attorney', attorneyId: 2 },
    { id: 12, username: 'nishida.c', password: 'nishida.c_pass', role: 'attorney', attorneyId: 3 },
    { id: 13, username: 'aizawa.t', password: 'aizawa.t_pass', role: 'attorney', attorneyId: 4 },
    { id: 14, username: 'sakai.n', password: 'sakai.n_pass', role: 'attorney', attorneyId: 5 },
    { id: 15, username: 'kitta.a', password: 'kitta.a_pass', role: 'attorney', attorneyId: 6 },
    { id: 16, username: 'yasuda.t', password: 'yasuda.t_pass', role: 'attorney', attorneyId: 7 },
    { id: 17, username: 'ikegami.k', password: 'ikegami.k_pass', role: 'attorney', attorneyId: 8 },
    // --- スタッフユーザー ---
    { id: 100, username: 'staff1', password: 'staff1_pass', role: 'staff' },
    { id: 101, username: 'staff2', password: 'staff2_pass', role: 'staff' },
];
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys are not set.");
}
else {
    webpush.setVapidDetails('mailto:your-email@example.com', vapidPublicKey, vapidPrivateKey);
}
// ユーザーIDと購読情報、フォロー設定を紐づけて管理
let userSubscriptions = new Map();
let previouslyNotifiedAlerts = new Map();
function calculateAlertStatus(caseItem) {
    const today = dayjs().startOf('day');
    let highestAlert = { status: null, stepName: null, delayDays: null };
    for (const condition of alertConditionsMasterList) {
        if (!condition.is_active)
            continue;
        const targetDateStr = caseItem[condition.target_column];
        if (!targetDateStr)
            continue;
        const targetDate = dayjs(targetDateStr);
        if (!targetDate.isValid())
            continue;
        const diffDays = today.diff(targetDate, 'day');
        let currentStatus = null;
        if (condition.threshold_days_red != null && diffDays >= condition.threshold_days_red + RED_TO_BLACK_DAYS) {
            currentStatus = '黒';
        }
        else if (condition.threshold_days_red != null && diffDays >= condition.threshold_days_red) {
            currentStatus = '赤';
        }
        else if (condition.threshold_days_yellow != null && diffDays >= condition.threshold_days_yellow) {
            currentStatus = '黄';
        }
        const alertLevels = {
            '黄': 1,
            '赤': 2,
            '黒': 3,
            'null': 0
        };
        const previousStatusKey = highestAlert.status === null ? 'null' : highestAlert.status;
        const currentStatusKey = currentStatus === null ? 'null' : currentStatus;
        const previousLevel = alertLevels[previousStatusKey];
        if (currentStatus && alertLevels[currentStatusKey] > previousLevel) {
            highestAlert = {
                status: currentStatus,
                stepName: condition.trigger_event,
                delayDays: diffDays,
            };
        }
    }
    return highestAlert;
}
// =============================================================================
// ★★★ マスターデータとヘルパー関数 ★★★
// =============================================================================
const attorneysMasterList = [
    { attorney_id: 1, attorney_name: '長 裕康', email: null },
    { attorney_id: 2, attorney_name: '守時 弘展', email: null },
    { attorney_id: 3, attorney_name: '高橋 正基', email: null },
    { attorney_id: 4, attorney_name: '横松 紀子', email: null },
    { attorney_id: 5, attorney_name: '西田 千晃', email: null },
    { attorney_id: 6, attorney_name: '相澤 達哉', email: null },
    { attorney_id: 7, attorney_name: '酒井 希', email: null },
    { attorney_id: 8, attorney_name: '橘田 晃', email: null },
    { attorney_id: 9, attorney_name: '保多 崇志', email: null },
    { attorney_id: 10, attorney_name: '池上 浩一', email: null },
];
// =============================================================================
// アラート設定の読み込み (JSONファイルから)
// =============================================================================
// ESM環境で __dirname を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// JSONファイルのパスを定義
const alertConditionsPath = path.join(__dirname, '..', 'alert-conditions.json');
// ★ 修正: const ではなく let で宣言し、JSONから読み込む
let alertConditionsMasterList = [];
try {
    // ファイルを同期的に読み込む
    const fileContent = fs.readFileSync(alertConditionsPath, 'utf-8');
    // 読み込んだ内容をパースして配列に代入
    alertConditionsMasterList = JSON.parse(fileContent);
    console.log('✅ アラート設定を "alert-conditions.json" から読み込みました。');
}
catch (error) {
    console.error(`❌ "alert-conditions.json" の読み込みに失敗しました。ファイルが存在するか確認してください。`, error);
    // もしファイルの読み込みに失敗したら、サーバーを停止させる
    process.exit(1);
}
// ★★★ ここまで追加 ★★★
const RED_TO_BLACK_DAYS = 3;
function reverseMapData(data) {
    const hasanData = {};
    const clientData = {};
    const mapping = {
        management_number: ['Hasan', '事件管理番号'], client_name: ['Hasan', '氏名'],
        staff_name: ['Hasan', '担当者'], case_type: ['Hasan', '種別'],
        jurisdiction: ['Hasan', '管轄'], date_filing: ['Hasan', '申立日'],
        case_number: ['Hasan', '申立事件番号'], date_supplementary_deadline: ['Hasan', '追完期日'],
        date_start_decision: ['Hasan', '開始決定日'], date_sent: ['Hasan', '送付日'],
        letapa_number: ['Hasan', 'レタパ番号'], deadline_date: ['Hasan', '期限日'],
        date_document_arrival: ['Hasan', '書類到着日'], date_creditor_list_complete: ['Hasan', '債権者一覧作成完了日'],
        date_staff_assignment: ['Hasan', '担当振分日'], date_first_greeting: ['Hasan', '初回挨拶日'],
        extension_period: ['Hasan', '猶予期間'], date_finished: ['Hasan', '積立終了日'],
        notes: ['Hasan', '備考'], reminder_documents_dates: ['Hasan', '詳細状況（聞取後）'],
        date_pre_hearing: ['Hasan', '聞き取り日'], date_exemption_decision: ['Hasan', '免責日'],
        date_approval_decision: ['Hasan', '認可日'], notes_document_sending: ['Hasan', '備考（書類未達）'],
        notes_after_filing: ['Hasan', '備考（終了）'], date_received: ['Client', '受託日'],
        date_plan_submission_deadline: ['Client', '再生計画案提出日'],
    };
    for (const key in data) {
        const typedKey = key;
        if (typedKey === 'attorney_id' && data.attorney_id) {
            const attorney = attorneysMasterList.find(a => a.attorney_id === data.attorney_id);
            if (attorney)
                hasanData['弁護士'] = attorney.attorney_name;
            continue;
        }
        if (mapping[typedKey]) {
            const [table, dbColumn] = mapping[typedKey];
            const value = data[typedKey];
            if (table === 'Hasan') {
                hasanData[dbColumn] = typedKey === 'reminder_documents_dates' ? JSON.stringify(value) : value;
            }
            else {
                clientData[dbColumn] = value;
            }
        }
    }
    return { hasanData, clientData };
}
// =============================================================================
// ★★★ 新規エンドポイント: Chatwork通知送信 API ★★★
// =============================================================================
app.post('/api/chatwork/send', async (req, res) => {
    // フロントエンドからは roomId (固定値) と message が送られてくる
    const { roomId, message } = req.body;
    if (!roomId || !message) {
        console.error("❌ Chatwork送信エラー: Room ID またはメッセージが不足しています。");
        return res.status(400).json({ success: false, error: 'Room ID and message are required.' });
    }
    if (!CHATWORK_API_TOKEN) {
        console.error("❌ Chatwork送信エラー: APIトークンが設定されていません。");
        return res.status(500).json({ success: false, error: 'API token not configured on server.' });
    }
    // Chatwork API v2 のメッセージ送信エンドポイント
    const url = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
    try {
        const cwResponse = await fetch(url, {
            method: 'POST',
            headers: {
                // 認証トークン
                'X-ChatWorkToken': CHATWORK_API_TOKEN,
                // Content-Type は application/x-www-form-urlencoded
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            // メッセージを URLエンコードして body に含める
            body: new URLSearchParams({ body: message }).toString()
        });
        const data = await cwResponse.json();
        if (cwResponse.ok) {
            console.log(`✅ Chatwork送信成功: Room ${roomId}`);
            // フロントエンドに成功レスポンスを返す
            return res.status(200).json({ success: true, chatwork_data: data });
        }
        else {
            // Chatwork APIがエラーを返した場合
            console.error(`❌ Chatwork APIエラー (${cwResponse.status}):`, data);
            return res.status(cwResponse.status).json({ success: false, error: 'Chatwork API failed to send message', details: data });
        }
    }
    catch (error) {
        // ネットワークレベルのエラー
        console.error('❌ Chatwork送信エラー (Fetch Error):', error);
        return res.status(500).json({ success: false, error: 'Internal server error during Chatwork API call.' });
    }
});
// =============================================================================
// ★★★ 既存の APIエンドポイント定義 ★★★
// =============================================================================
// --- 認証関連API ---
// =========================================
// ✅ ログインAPI（確実に動作する版）
// =========================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // 入力チェック
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'ユーザー名とパスワードを入力してください。',
        });
    }
    // ユーザー照合
    const user = users.find((u) => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'ユーザー名またはパスワードが正しくありません。',
        });
    }
    // 成功時レスポンス
    return res.status(200).json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            attorneyId: user.attorneyId || null,
        },
    });
});
app.post('/api/notification-settings', (req, res) => {
    const { userId, follows } = req.body;
    const userSub = userSubscriptions.get(userId);
    if (userSub) {
        userSub.follows = follows;
        userSubscriptions.set(userId, userSub);
        console.log(`Updated notification settings for user ${userId}. Follows:`, follows);
        res.status(200).json({ message: 'Settings updated' });
    }
    else {
        res.status(404).json({ error: 'User subscription not found' });
    }
});
// --- データ取得API ---
app.get('/api/cases', async (req, res) => {
    try {
        // --- クエリパラメータ ---
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '50', 10);
        const offset = (page - 1) * limit;
        const attorneyId = req.query.attorneyId;
        const searchTerm = req.query.search;
        const attorneys = attorneysMasterList;
        const whereClauses = [];
        const queryParams = [];
        // --- 弁護士フィルタ ---
        if (attorneyId && attorneyId !== 'すべて') {
            const selectedAttorney = attorneys.find(a => String(a.attorney_id) === attorneyId);
            if (selectedAttorney) {
                const searchName = cleanAttorneyName(selectedAttorney.attorney_name).split(' ')[0];
                whereClauses.push(`t1."弁護士" LIKE $${queryParams.length + 1}`);
                queryParams.push(`%${searchName}%`);
            }
        }
        // --- 検索フィルタ（氏名 or 事件管理番号）---
        if (searchTerm && searchTerm.trim() !== '') {
            const pattern = `%${searchTerm}%`;
            const p1 = queryParams.length + 1;
            const p2 = queryParams.length + 2;
            whereClauses.push(`(t1."氏名" ILIKE $${p1} OR t1."事件管理番号" ILIKE $${p2})`);
            queryParams.push(pattern, pattern);
        }
        // --- WHERE句生成 ---
        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const safeWhere = (whereString && whereString.trim() !== '' && whereString.trim() !== 'WHERE') ? whereString : '';
        // --- 総件数カウント ---
        const countSql = `SELECT COUNT(t1.id) FROM "HasanSaiseiTable" AS t1 ${safeWhere}`;
        console.log('[DEBUG countSql]', countSql, queryParams);
        const countResult = await query(countSql, queryParams);
        const totalCount = parseInt(countResult.rows?.[0]?.count || '0', 10);
        // --- ページネーション付きクエリ ---
        const limitParamIndex = queryParams.length + 1;
        const offsetParamIndex = queryParams.length + 2;
        const finalQueryParams = [...queryParams, limit, offset];
        // 🌟 修正 5: SQLクエリの改行を調整し、safeWhere が空の場合でもエラーにならないようにする
        const sql = `SELECT t1.*, t2."受託日", t2."氏" AS "client_shi", t2."名" AS "client_mei", t2."再生計画案提出日"
  FROM "HasanSaiseiTable" AS t1
  LEFT JOIN "ClientTable" AS t2 
  ON t1."事件管理番号" = t2."事件管理番号"
  ${safeWhere ? safeWhere + ' ' : ''}
  ORDER BY t2."受託日" DESC NULLS LAST
  LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex};
  `;
        console.log('[DEBUG sql]', sql, finalQueryParams);
        const caseResult = await query(sql, finalQueryParams);
        // --- 結果マッピング ---
        const mappedCases = caseResult.rows.map(row => {
            const clientName = row.氏名?.trim() !== '' && row.氏名
                ? row.氏名
                : `${row.client_shi || ''} ${row.client_mei || ''}`.trim();
            const cleanedName = cleanAttorneyName(row.弁護士);
            const attorney = attorneysMasterList.find(a => cleanedName && a.attorney_name.startsWith(cleanedName));
            let reminderDates = [];
            if (row["詳細状況（聞取後）"]) {
                try {
                    const parsed = JSON.parse(row["詳細状況（聞取後）"]);
                    if (Array.isArray(parsed))
                        reminderDates = parsed;
                }
                catch {
                    // JSONが壊れてる場合のみログ出力
                    console.warn(`⚠️ Invalid JSON in 詳細状況（聞取後） for case ${row.id}`);
                }
            }
            const mappedCase = {
                case_id: row.id,
                management_number: row.事件管理番号,
                client_name: clientName,
                attorney_id: attorney?.attorney_id || null,
                attorney_name: attorney?.attorney_name || cleanedName,
                staff_name: row.担当者,
                case_type: row.種別,
                date_received: row.受託日,
                date_sent: row.送付日,
                letapa_number: row.レタパ番号,
                deadline_date: row.期限日,
                date_document_arrival: row.書類到着日,
                notes_document_sending: row["備考（書類未達）"],
                date_creditor_list_complete: row.債権者一覧作成完了日,
                date_staff_assignment: row.担当振分日,
                date_first_greeting: row.初回挨拶日,
                listening_documents_missing_guide: row["詳細状況（聞取後）"],
                reminder_documents_dates: reminderDates,
                extension_period: row.猶予期間,
                notes_preparation: row.備考,
                jurisdiction: row.管轄,
                date_filing: row.申立日,
                case_number: row.申立事件番号,
                date_supplementary_deadline: row.追完期日,
                date_start_decision: row.開始決定日,
                date_pre_hearing: row.聞き取り日,
                date_exemption_decision: row.免責日,
                date_approval_decision: row.認可日,
                date_plan_submission_deadline: row.再生計画案提出日,
                date_midterm_report_deadline: row.財産目録提出期限,
                date_finished: row.積立終了日,
                notes_after_filing: row["備考（終了）"],
                is_unanswered: false,
                is_trustee_case: false,
            };
            const alertDetailsForCases = calculateAlertStatus(mappedCase);
            // 🌟 修正 3: calculateAlertStatus が AlertDetail を返すため、status の値のみを代入
            return { ...mappedCase, alert_status: alertDetailsForCases.status };
        });
        const finalCases = mappedCases.filter(c => c.client_name && c.client_name.trim() !== '');
        res.json({ cases: finalCases, totalCount });
    }
    catch (err) {
        console.error('❌ Error fetching cases:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.get('/api/alerts', async (req, res) => {
    try {
        // 🌟 修正 6: SQLクエリの改行を削除し、コンパクトに整形 (エラー 42601 対策)
        const sql = `SELECT t1.*, t2."氏" AS "client_shi", t2."名" AS "client_mei" FROM "HasanSaiseiTable" AS t1 LEFT JOIN "ClientTable" AS t2 ON t1."事件管理番号" = t2."事件管理番号"`;
        const caseResult = await query(sql);
        const allMappedCases = caseResult.rows.map(row => {
            const clientName = (row.氏名 && row.氏名.trim() !== '') ? row.氏名 : `${row.client_shi || ''} ${row.client_mei || ''}`.trim();
            const cleanedName = cleanAttorneyName(row.弁護士);
            const attorney = attorneysMasterList.find(a => cleanedName && a.attorney_name.startsWith(cleanedName));
            const mappedCase = {
                case_id: row.id,
                client_name: clientName,
                attorney_id: attorney ? attorney.attorney_id : null,
                attorney_name: attorney ? attorney.attorney_name : cleanedName,
                management_number: row.事件管理番号,
                is_unanswered: false, // (これはダミーでOK)
                // ▼ アラート判定に必要な日付カラムをすべて追加 ▼
                date_document_arrival: row.書類到着日,
                date_staff_assignment: row.担当振分日,
                date_first_greeting: row.初回挨拶日,
                // "事情聴き取り・不足書類案内" や "書類督促日" がDBにあるなら、それもマッピングする
                // (例) listening_documents_missing_guide: row["詳細状況（聞取後）"],
                // (例) reminder_documents_dates: row.書類督促日, // ※カラム名が不明なため仮
                date_supplementary_deadline: row.追完期日,
                // "財産目録・報告書の提出期限" もDBにあるならマッピング
                // // (例) date_asset_report_deadline: row.財産目録・報告書の提出期限, // ※仮
                date_plan_submission_deadline: row.再生計画案締切日, // ClientTable由来だがJOINしているので使えるはず
                date_approval_decision: row.認可日,
                // "確定日" もDBにあるならマッピング
                // // (例) date_finalized: row.確定日, // ※仮
                date_midterm_report_deadline: row.財産目録提出期限,
            };
            // ★★★ 修正ここまで ★★★
            // 🌟 修正 4: calculateAlertStatus を呼び出し、詳細を取得
            const alertDetails = calculateAlertStatus(mappedCase);
            // アラートがある場合のみ、詳細情報を含めてオブジェクトを返す
            if (alertDetails.status) {
                // alert_status には status の値のみを代入し、型の不整合を解消
                return {
                    ...mappedCase,
                    alert_status: alertDetails.status, // string | null の値のみ代入
                    // フロントエンドに渡すための新しいプロパティを一時的に追加
                    delay_step_name: alertDetails.stepName,
                    delay_days: alertDetails.delayDays,
                };
            }
            return null;
        }).filter(c => c && c.client_name); // nullをフィルタリングし、型をキャスト
        // フィルタリングされたアラート案件のみをレスポンスとして返す
        res.json(allMappedCases);
    }
    catch (err) {
        console.error('❌ Error fetching alerts:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.get('/api/attorneys', (req, res) => {
    const formalAttorneys = attorneysMasterList.filter(attorney => !attorney.attorney_name.endsWith('先生'));
    res.json(formalAttorneys);
});
// =========================================
// ★★★ ここから追加 ★★★
// ✅ アラート設定 取得API (新規追加)
// =========================================
app.get('/api/alert-conditions', (req, res) => {
    try {
        // 起動時にJSONから読み込んでメモリに保持している設定を返す
        res.status(200).json(alertConditionsMasterList);
    }
    catch (err) {
        console.error('Error fetching alert conditions:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// ★★★ ここまで追加 ★★★
// =========================================
// ✅ アラート設定 保存API (ファイル書き込み対応版)
// =========================================
app.post('/api/alert-conditions', (req, res) => {
    try {
        const newConditions = req.body;
        // 1. フロントエンドから送られてきたデータが配列かチェック
        if (!Array.isArray(newConditions)) {
            console.error('❌ 保存失敗: リクエストボディが配列ではありません。');
            return res.status(400).json({ error: '無効なリクエストです。配列が必要です。' });
        }
        // 2. メモリ上の配列の中身を入れ替える (実行中のアラート判定に即時反映)
        alertConditionsMasterList.length = 0;
        alertConditionsMasterList.push(...newConditions);
        console.log('✅ アラート設定がメモリ上で更新されました。');
        // ★★★ ここから修正・追加 ★★★
        // 3. JSONファイルに書き込む (永続化)
        try {
            // JSON.stringify の第3引数 `2` は、読みやすいようにインデントを付けるためのものです
            const jsonData = JSON.stringify(newConditions, null, 2);
            fs.writeFileSync(alertConditionsPath, jsonData, 'utf-8');
            console.log(`✅ アラート設定を "alert-conditions.json" に保存しました。`);
            // 4. フロントエンドに「成功」を返す
            res.status(200).json({ success: true, message: '設定を保存しました。' });
        }
        catch (fileError) {
            console.error(`❌ "alert-conditions.json" への書き込みに失敗しました。`, fileError);
            // ファイル保存に失敗したら、クライアントにサーバーエラーを返す
            res.status(500).json({ error: 'ファイルへの設定保存に失敗しました。' });
        }
        // ★★★ ここまで修正・追加 ★★★
    }
    catch (err) {
        console.error('❌ アラート設定の保存中にエラーが発生しました:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
});
// --- データ書き込みAPI ---
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
    }
    catch (err) {
        console.error(`Error updating case ${id}:`, err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/api/cases', (req, res) => res.status(501).json({ error: 'Not Implemented' }));
// --- プッシュ通知購読API ---
app.post('/api/subscribe', (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) {
        return res.status(400).json({ error: 'userId and subscription are required' });
    }
    userSubscriptions.set(userId, { subscription, follows: [] });
    console.log(`Subscription added for user ${userId}. Total subscriptions: ${userSubscriptions.size}`);
    res.status(201).json({ message: 'Subscription successful' });
});
// =============================================================================
// ★★★ 定期実行ジョブ (ターゲット通知) ★★★
// =============================================================================
async function checkForAlertsAndNotify() {
    console.log("Running scheduled job: checking for new alerts...");
    if (userSubscriptions.size === 0) {
        console.log("No push subscribers. Skipping notification check.");
        return;
    }
    try {
        // ★ 修正: 不正な空白文字を削除し、インデントを正規化
        const sql = `SELECT t1.*, 
     t2."氏" AS "client_shi", 
     t2."名" AS "client_mei" 
    FROM "HasanSaiseiTable" AS t1 
    LEFT JOIN "ClientTable" AS t2 ON t1."事件管理番号" = t2."事件管理番号"`;
        const result = await query(sql);
        const newOrEscalatedAlerts = [];
        const currentAlerts = new Map();
        for (const row of result.rows) {
            const clientName = (row.氏名 && row.氏名.trim() !== '') ? row.氏名 : `${row.client_shi || ''} ${row.client_mei || ''}`.trim();
            if (!clientName)
                continue;
            const cleanedName = cleanAttorneyName(row.弁護士);
            const attorney = attorneysMasterList.find(a => cleanedName && a.attorney_name.startsWith(cleanedName));
            const mappedCase = {
                case_id: row.id,
                client_name: clientName,
                attorney_id: attorney ? attorney.attorney_id : null,
                attorney_name: attorney ? attorney.attorney_name : cleanedName,
                date_first_greeting: row.初回挨拶日,
                date_document_arrival: row.書類到着日,
                date_midterm_report_deadline: row.財産目録提出期限,
            };
            const alertDetails = calculateAlertStatus(mappedCase);
            const alertStatus = alertDetails.status; // 🌟 修正: AlertDetailからstatusを取得
            if (alertStatus) {
                currentAlerts.set(row.id, alertStatus);
                const previousStatus = previouslyNotifiedAlerts.get(row.id);
                const alertLevels = { '黄': 1, '赤': 2, '黒': 3 };
                const previousLevel = previousStatus ? alertLevels[previousStatus] : 0;
                // currentStatusがnullではないことを保証してアクセス
                const currentLevel = alertLevels[alertStatus];
                if (currentLevel > previousLevel) {
                    newOrEscalatedAlerts.push({ ...mappedCase, alert_status: alertStatus });
                }
            }
        }
        if (newOrEscalatedAlerts.length > 0) {
            for (const [userId, userSub] of userSubscriptions.entries()) {
                const user = users.find(u => u.id === userId);
                if (!user)
                    continue;
                const userSpecificAlerts = newOrEscalatedAlerts.filter(alert => {
                    if (user.role === 'staff' || user.role === 'admin')
                        return true;
                    if (user.role === 'attorney') {
                        // ★ 修正: alert.attorney_id が null でないことを確認
                        return alert.attorney_id === user.attorneyId || (alert.attorney_id != null && userSub.follows.includes(alert.attorney_id));
                    }
                    return false;
                });
                if (userSpecificAlerts.length > 0) {
                    for (const alert of userSpecificAlerts) {
                        const payload = JSON.stringify({
                            title: '新しいアラート通知',
                            body: `${alert.client_name} の案件で ${alert.alert_status} アラートが発生しました。`,
                        });
                        try {
                            await webpush.sendNotification(userSub.subscription, payload);
                            console.log(`✅ 通知送信: ${user.username} に ${alert.client_name} (${alert.alert_status})`);
                        }
                        catch (err) {
                            console.error(`❌ 通知送信エラー: ${user.username}`, err);
                        }
                    }
                }
            }
        }
        previouslyNotifiedAlerts = currentAlerts;
    }
    catch (error) {
        console.error("Error during scheduled alert check:", error);
    }
}
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    console.log(`Network access available at http://172.16.1.135:${PORT}`);
    cron.schedule('0 9 * * *', checkForAlertsAndNotify, {
        timezone: 'Asia/Tokyo',
    });
    console.log('プッシュ通知のスケジュールされたジョブは毎日午前9時に実行されています。');
});
//# sourceMappingURL=server.js.map