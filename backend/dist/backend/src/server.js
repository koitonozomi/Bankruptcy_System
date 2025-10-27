import express from 'express';
import cors from 'cors';
import cron from 'node-cron'; // 定期実行ライブラリ
import { query } from './db/index.js'; // indexファイルまで明記し、.jsを付ける
import { checkAllCaseAlerts } from './services/alertService.js'; // .jsを付ける
const app = express();
const PORT = process.env.PORT || 50000;
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
// [GET] /api/cases - 全案件データを弁護士名と結合して取得
app.get('/api/cases', async (req, res) => {
    try {
        // attorneysテーブルとLEFT JOINして弁護士名を取得
        const sql = `
      SELECT 
        cp.*, 
        a.attorney_name 
      FROM 
        cases_progress cp
      LEFT JOIN 
        attorneys a ON cp.attorney_id = a.attorney_id
      ORDER BY 
        cp.date_received DESC;
    `;
        const result = await query(sql);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Error fetching cases:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    // --- 常時監視のスケジューリング ---
    // サーバー起動時にまず1回実行
    checkAllCaseAlerts();
    // その後、例えば「5分ごと」にアラートチェックを自動実行
    cron.schedule('*/5 * * * *', () => {
        checkAllCaseAlerts();
    });
    console.log('Scheduled alert check every 5 minutes.');
});
//# sourceMappingURL=server.js.map