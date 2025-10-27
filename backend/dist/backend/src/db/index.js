import { Pool } from 'pg';
// 'import * as' 形式に変更
import * as dotenv from 'dotenv';
dotenv.config(); // .env ファイルから環境変数を読み込む
// コネクションプールを作成
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    // 本番環境ではSSL接続を推奨
    // ssl: {
    //   rejectUnauthorized: false
    // }
});
// プールから接続を取得してクエリを実行する共通関数
export const query = (text, params) => {
    return pool.query(text, params);
};
console.log('PostgreSQL connection pool created.');
//# sourceMappingURL=index.js.map