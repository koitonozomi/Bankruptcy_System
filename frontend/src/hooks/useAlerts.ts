import { useState, useEffect, useCallback } from 'react';
import type { CaseProgress, Attorney } from '../types/progress';

// =============================================================================
// ★★★ プッシュ通知関連の追加 ★★★
// =============================================================================

// VAPIDキーはバックエンドで生成したものに置き換えてください。
// これはクライアントサイドで安全に公開できる公開鍵です。
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

    // 生成された購読情報をバックエンドに送信してDBに保存してもらう
    await fetch('http://172.16.1.135:50001/api/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
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
// 既存のフックロジック
// =============================================================================

export interface Alert {
  caseId: string;
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

  const fetchData = useCallback(async (page: number = 1, limit: number = 50, attorneyId: string = 'すべて') => {
    setIsLoading(true);
    setError(null);
    try {
      const casesUrl = `http://localhost:5000/api/cases?page=${page}&limit=${limit}&attorneyId=${attorneyId}`;
      
      const [casesResponse, attorneysResponse, alertsResponse] = await Promise.all([
        fetch(casesUrl),
        fetch('http://localhost:50001/api/attorneys'),
        fetch('http://localhost:50000/api/alerts'),
      ]);

      if (!casesResponse.ok || !attorneysResponse.ok || !alertsResponse.ok) {
        throw new Error('サーバーからのデータ取得に失敗しました。');
      }
      
      const casesData = await casesResponse.json();
      const attorneysData: Attorney[] = await attorneysResponse.json();
      const rawAlertsData: CaseProgress[] = await alertsResponse.json();
      
      setAllCases(casesData.cases);
      setTotalCount(casesData.totalCount);
      setAttorneys(attorneysData);
      
      const newAlerts = rawAlertsData.map(c => {
        let alertType: 'black' | 'red' | 'yellow' = 'yellow';
        if (c.alert_status === '黒') alertType = 'black';
        else if (c.alert_status === '赤') alertType = 'red';
        return {
          caseId: String(c.case_id),
          type: alertType,
          message: `${c.client_name}様の案件で遅延が発生しています。`,
          unresolved: c.is_unanswered,
          clientName: c.client_name,
          attorneyName: c.attorney_name,
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
    fetchData(); // 初回データ読み込み
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


  return { allCases, totalCount, alerts, attorneys, isLoading, error, fetchData };
};