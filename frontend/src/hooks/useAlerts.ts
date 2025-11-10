import { useState, useEffect, useCallback } from 'react';
// ★ 修正: types.ts からインポートするようにパスを変更 (ディレクトリ構造を想定)
import type { CaseProgress, Attorney } from '../types/progress.ts'; 

// ★★★ 修正 1: AuthContext.tsx と同様に、APIベースURLを定義 ★★★
const API_BASE_URL = 'http://localhost:50000';

// =============================================================================
// ★★★ プッシュ通知関連の追加 ★★★
// =============================================================================

// VAPIDキーはバックエンドで生成したものに置き換えてください。
// これはクライアントサイドで安全に公開できる公開鍵です。
// ★ 注意: 本番環境では必ずバックエンドで生成したものに置き換えてください。
const VAPID_PUBLIC_KEY = 'BJr3eVI_YqNBYBBhQRw_1DhJ9JajtLlzqKN74DtjDtUcYuFrQ16GV5fh7iExC3T_TRXkt_XsTYvxpV_kKcJnu0w'; // TODO: バックエンドで生成した公開鍵に置き換える

/**
* VAPID公開鍵をプッシュサービスが要求する形式に変換するヘルパー関数
*/
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
* プッシュ通知の購読を開始し、購読情報をバックエンドに送信する関数
*/
async function subscribeToPushNotifications() {
    try {
// Service Workerが準備完了になるのを待つ
　　const registration = await navigator.serviceWorker.ready;
// プッシュ通知の購読情報を取得
　　const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // ユーザーに通知が見えることが必須
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    
    console.log('Push notification subscribed:', subscription);

// ★★★ 修正 2: API_BASE_URL を使用 ★★★
    await fetch(`${API_BASE_URL}/api/subscribe`, { 
      method: 'POST',
      body: JSON.stringify({ userId: 1, subscription }), 
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Subscription info sent to backend.');

  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
  }
}


// ★★★★★ 修正点 1: テスト通知を表示する関数を追加 ★★★★★
/**
 * Service Workerに依頼して、テスト用のプッシュ通知を即座に表示する
 */
async function showTestNotification() {
  if ('serviceWorker' in navigator) {
    try {
      // 準備が完了しているService Workerを取得
      const registration = await navigator.serviceWorker.ready;
      // 通知のタイトルと内容を定義
      const options = {
        body: 'これはテスト通知です。バックエンドからの通信なしで表示されています。',
        icon: '/icon.png', // publicフォルダにあるアイコン
      };
      // 通知の表示を依頼
      registration.showNotification('テスト通知', options);
      console.log('Test notification shown.');
    } catch (error) {
      console.error('Error showing test notification:', error);
    }
  }
}


// =============================================================================
// 既存のフックロジックと型の修正
// =============================================================================

// Alert型はuseAlerts固有の型として維持。managementNumberはnullを許容するように修正。
export interface Alert {
  caseId: string;
  managementNumber: string | null; 
  type: 'black' | 'red' | 'yellow';
  message: string;
  unresolved: boolean;
  clientName: string; 
  attorneyName: string | undefined;
}

export const useAlerts = () => {
  const [allCases, setAllCases] = useState<CaseProgress[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ★ 修正 3: fetchDataの引数にsearchTermを追加し、API呼び出しURLに含める
  const fetchData = useCallback(async (
        page: number = 1, 
        limit: number = 50, 
        attorneyId: string = 'すべて',
        searchTerm: string = '' 
    ) => {
    setIsLoading(true);
    setError(null);
    try {
      // ★★★ 修正 3: すべての fetch URL に API_BASE_URL を追加 ★★★
      const casesUrl = `${API_BASE_URL}/api/cases?page=${page}&limit=${limit}&attorneyId=${attorneyId}&search=${encodeURIComponent(searchTerm)}`;
      const attorneysUrl = `${API_BASE_URL}/api/attorneys`;
      const alertsUrl = `${API_BASE_URL}/api/alerts`;

      const [casesResponse, attorneysResponse, alertsResponse] = await Promise.all([
        fetch(casesUrl),
        fetch(attorneysUrl),
        fetch(alertsUrl),
      ]);

      // ★ 修正: 複数のレスポンスを個別にチェック
      if (!casesResponse.ok || !attorneysResponse.ok || !alertsResponse.ok) {
        // どのAPIが失敗したかログを出す
        if (!casesResponse.ok) console.error('Failed to fetch cases', casesResponse);
        if (!attorneysResponse.ok) console.error('Failed to fetch attorneys', attorneysResponse);
        if (!alertsResponse.ok) console.error('Failed to fetch alerts', alertsResponse);
        throw new Error('サーバーからのデータ取得に失敗しました。');
      }
      
      // CaseProgress/Attorney型は外部からインポートされた型を使用
      const casesData: { cases: CaseProgress[], totalCount: number } = await casesResponse.json();
      const attorneysData: Attorney[] = await attorneysResponse.json();
      
      // ★ 修正: rawAlertsData はサーバーからのレスポンスの型を想定
      const rawAlertsData: (CaseProgress & { delay_step_name: string, delay_days: number })[] = await alertsResponse.json();
      
      setAllCases(casesData.cases);
      setTotalCount(casesData.totalCount);
      setAttorneys(attorneysData);
      
      const newAlerts = rawAlertsData.map(c => {

        let alertType: 'black' | 'red' | 'yellow' = 'yellow';
        if (c.alert_status === '黒') alertType = 'black';
        else if (c.alert_status === '赤') alertType = 'red';

      const managementNumber = (c.management_number && String(c.management_number).trim() !== '') 
      ? String(c.management_number).trim() 
      : null;

      // ==========================================
      // ★★★ アラートメッセージ生成ロジック修正 ★★★
      // ==========================================
        
        // 1. APIからの遅延情報を取得
        const stepName = c.delay_step_name; // (例: "追完期日前アラート")
        const delayDays = c.delay_days;   // (例: -5 や 3)

        // 2. デフォルトメッセージ
        let message = `${c.client_name}様の案件でアラートが発生しています。`;

        if (stepName && delayDays != null) { // delayDays が 0 の場合も考慮
          
          if (delayDays < 0) {
            // 期限前アラート (delayDays は -5 など)
            const remainingDays = Math.abs(delayDays);
            message = `【${stepName}】まで残り ${remainingDays}日 です。`;
          
          } else if (delayDays >= 0) {
            // 遅延アラート (delayDays は 3 など)
            // (「0日 の遅延」＝「本日遅延発生」と表示)
            message = `【${stepName}】で ${delayDays}日 の遅延が発生しています。`;
          }

        } 
        // ==========================================
        // ★★★ 修正ここまで ★★★
        // ==========================================

        return {
          caseId: String(c.case_id),
          managementNumber: managementNumber, 
          type: alertType,
          message: message, // ★ "message" 変数を渡す
          unresolved: c.is_unanswered,
          attorneyName: c.attorney_name,
          clientName: c.client_name, 
        };
      });
      setAlerts(newAlerts);

    } catch (e: any) {
      setError(e.message);
      console.error("データの取得に失敗しました:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(); // 初回データ読み込み (引数なし = デフォルト値を使用)
  }, [fetchData]);

    // ★ プッシュ通知購読用のuseEffect
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      subscribeToPushNotifications();
    } else {
      console.warn('Push messaging is not supported');
    }
  }, []); // 初回の一度だけ実行

    // ★★★★★ 修正点 2: テスト用のキーボードイベントリスナーを追加 ★★★★★
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 'T'キーが押されたらテスト通知を表示
      if (event.key === 't' || event.key === 'T') {
        console.log('"T" key pressed, showing test notification...');
        showTestNotification();
      }
    };

    // イベントリスナーを登録
    window.addEventListener('keydown', handleKeyDown);

    // コンポーネントがアンマウントされるときにリスナーを解除（メモリリーク防止）
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // 初回の一度だけ実行

  
  // ★★★ 修正点: App.tsxで必要なため、markCaseUnresolved を定義 ★★★
  const markCaseUnresolved = async (caseId: string, _status: string) => {
    console.log(`APIを呼び出して案件ID: ${caseId}を更新する必要があります`);
    // 将来的にはここで PATCH /api/cases/:id/unresolved などを呼び出す
    // (現在は書き込み機能がないため、コンソールログのみ)
  };


  return { allCases, totalCount, alerts, attorneys, isLoading, error, fetchData, markCaseUnresolved };
};