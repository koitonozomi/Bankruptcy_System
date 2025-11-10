import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Container, Typography, AppBar, Toolbar, 
  ThemeProvider, createTheme, IconButton, CircularProgress, Box,
  FormControl, InputLabel, Select, MenuItem, Pagination
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material'; 
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'; 
// 🌟 修正: インポートパスを 'src/' から始まる絶対パス（プロジェクトルートからのパス）に変更
import { useAuth } from '../src/contexts/AuthContext'; 
import { useAlerts } from '../src/hooks/useAlerts';
import { LoginPage } from '../src/components/LoginPage'; 
import AdminPage from '../src/components/AdminPage'; 
import ProgressTable from '../src/components/ProgressTable';
import AlertDashboard from '../src/components/AlertDashboard';
import CriticalAlertModal from '../src/components/CriticalAlertModal';
import AlertSettingsModal from '../src/components/AlertSettingsModal';
import type { CaseProgress, Attorney } from '../src/types/progress'; // 🌟 修正

// 🌟 追加 1: 通知対象となるユーザーの型
interface NotificationRecipient {
  id: number; // Chatwork ID (CWID)、ユーザーIDなど
  name: string; // 弁護士名、事務員名など
}

// 🌟 修正: サーバー側のAPIエンドポイントURLを定義
const API_BASE_URL = 'http://localhost:50000';

// 🌟 修正: サーバー側でハードコードされているルームIDと合わせる
const CHATWORK_ROOM_ID = "400391800"; // 🚨 奥田さんのChatworkルームID

const theme = createTheme({
  palette: {
    primary: {
      main: '#0c2d3dff',
    },
  },
});

// 🚨 暫定処置: 事務員/システム部員をハードコードで定義
// IDは仮に提供されたルームIDを使用します。実際はChatwork ID(CWID)を使用してください。
const HARDCODED_STAFF_RECIPIENTS: NotificationRecipient[] = [
    { id: 400464039, name: '脊戸川 真哉' }, // 🚨 ルームIDを仮のCWIDとして利用
    { id: 400391800, name: '奥田 義一' },  // 🚨 ルームIDを仮のCWIDとして利用
    { id: 9999, name: 'システム部' },
];


const App: React.FC = () => {
  const { user, logout } = useAuth(); 
  const { allCases, totalCount, alerts, attorneys, fetchData, isLoading } = useAlerts();

// --- State管理 ---
const [isViewingAdminPage, setIsViewingAdminPage] = useState(false);
const [modalDismissed, setModalDismissed] = useState(false);
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [selectedLawyerId, setSelectedLawyerId] = useState<string>('すべて');
const [page, setPage] = useState(1);
const [searchTerm, setSearchTerm] = useState(''); 
const rowsPerPage = 50;
const [pageCount, setPageCount] = useState(0);
const [highlightedCaseMgmtNum, setHighlightedCaseMgmtNum] = useState<string | null>(null);

useEffect(() => {
  setPageCount(Math.ceil(totalCount / rowsPerPage));
}, [totalCount, rowsPerPage]);

 useEffect(() => {
  console.log(`[DEBUG App] allCases が更新されました。総件数: ${allCases.length}`);
}, [allCases]);

// ★ デバッグ
useEffect(() => {
  console.log('[App.tsx] user state changed (raw):', user);
// ★★★ 修正点: user の中身を詳細に確認するため、JSON.stringify を追加 ★★★
  console.log('[App.tsx] user state changed (JSON):', JSON.stringify(user, null, 2));
 }, [user]);


// 🌟 追加 3: Chatwork通知対象者リストを生成
const allRecipients: NotificationRecipient[] = useMemo(() => {
    // 弁護士リストを基に通知対象者を生成
    const attorneyRecipients = attorneys.map(a => ({ 
        // 弁護士IDをChatwork IDとして仮定
        id: a.attorney_id, 
        name: a.attorney_name 
    }));
    
    // 弁護士とハードコードしたスタッフリストを統合
    return [...attorneyRecipients, ...HARDCODED_STAFF_RECIPIENTS];
}, [attorneys]);


// 🌟 ★★★ ここから修正 ★★★
// 🌟 追加 4: Chatwork送信ロジックをシミュレーションから実際のAPI呼び出しに変更
const handleSendChatworkNotification = useCallback(async ( // async を追加
    caseManagementNumber: string | null,
    clientName: string,
    recipients: NotificationRecipient[]
) => {
    const recipientNames = recipients.map(r => r.name).join(', ');
    const recipientIds = recipients.map(r => r.id);

    // [To:○○] を生成 (IDがChatwork IDとして機能することを前提)
    const toTags = recipientIds.map(id => `[To:${id}]`).join('');
    
    const messageBody = 
`${toTags}
【テストです！！！】破産再生タスクアラートです。
案件名: ${clientName} 様
管理番号: ${caseManagementNumber || 'N/A'}
--
ご確認をお願いします。`;

console.log("--- CHATWORK 通知データ生成 ---");
console.log("対象者:", recipientNames);
console.log("メッセージ:", messageBody);

// サーバーの /api/chatwork/send エンドポイントを呼び出す
　　try {
  const response = await fetch(`${API_BASE_URL}/api/chatwork/send`, {
    method: 'POST',
     headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomId: CHATWORK_ROOM_ID, // サーバーが期待する roomId (固定値)
      message: messageBody,     // サーバーが期待する message
      }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Chatwork送信成功:', result);
      alert('Chatwork通知を送信しました。');
    } else {
      
      console.error('Chatwork送信失敗:', result);
      alert(`Chatwork通知の送信に失敗しました: ${result.error || 'サーバーエラー'}`);
     }
    } catch (error) {
      console.error('Chatwork API呼び出しエラー:', error);
      
      alert('Chatwork通知APIの呼び出しに失敗しました。');
    }
}, []); 

// 依存配列は空 (API_BASE_URL, CHATWORK_ROOM_ID は定数のため)



// --- イベントハンドラ ---
 const handleRefresh = useCallback(async () => {
  console.log(`[DEBUG App] 強制リフレッシュ (handleRefresh) が呼び出されました。`);
await fetchData(page, rowsPerPage, selectedLawyerId, searchTerm);
console.log(`[DEBUG App] fetchData 実行完了。allCasesが更新されるのを待ちます。`);
}, [page, rowsPerPage, selectedLawyerId, searchTerm, fetchData]);

  const handleFullRefresh = async () => {
    setPage(1);
   setSelectedLawyerId('すべて');
   setSearchTerm('');
   setHighlightedCaseMgmtNum(null);
   await fetchData(1, rowsPerPage, 'すべて', '');
   setModalDismissed(false);
   };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    setHighlightedCaseMgmtNum(null);
    fetchData(value, rowsPerPage, selectedLawyerId, searchTerm); 
  };
  
  const handleLawyerChange = (event: SelectChangeEvent<string>) => {
    const newLawyerId = event.target.value;
    setSelectedLawyerId(newLawyerId);
    setPage(1);
    setHighlightedCaseMgmtNum(null);
    fetchData(1, rowsPerPage, newLawyerId, searchTerm);
  };
  
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    setPage(1);
    setHighlightedCaseMgmtNum(null);
    fetchData(1, rowsPerPage, selectedLawyerId, newSearchTerm);
 };
 
 const handleAlertClick = (managementNumber: string | null) => {
    if (managementNumber) {
      setSearchTerm(managementNumber);
      setPage(1);
      fetchData(1, rowsPerPage, selectedLawyerId, managementNumber);
      setHighlightedCaseMgmtNum(managementNumber);
    }
  };
  
  const handleDismissCriticalAlert = () => { setModalDismissed(true); };

const handleMarkUnresolved = useCallback(async (caseId: string) => {
  console.log(`Marking case ${caseId} as unresolved is not fully implemented yet.`);
  setModalDismissed(true);
}, []);

const redAlerts = alerts.filter(a => a.type === 'red');
const showCriticalModal = redAlerts.length > 0 && !modalDismissed;


if (!user) {
  return <LoginPage />;
}


if (isViewingAdminPage) {
  return <AdminPage onClose={() => setIsViewingAdminPage(false)} />;
}

// ★ 弁護士または管理者（'staff'）が案件ダッシュボードを表示
  return (
  <ThemeProvider theme={theme}>
    <style>{`
        .highlight-row-animation {
          animation: highlight-row 3s ease-out;
        }
        @keyframes highlight-row {
          0% { background-color: #0c2d3dff; color: white; }
          70% { background-color: #0c2d3dff; color: white; }
          100% { background-color: inherit; color: inherit; }
        }
        .alert-blink-unanswered, .alert-blink-red {
          animation: blinker-red 2s ease-in-out infinite;
        }
        @keyframes blinker-red {
          0%, 100% {
            background-color: inherit;
            color: inherit;
            font-weight: normal;
          }
          50% {
            background-color: #c62828;
            color: white;
            font-weight: bold;
          }
        }
        .MuiTableRow-root.alert-black .MuiButton-root {
          color: white;
        }
      `}</style>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            破産・再生 進捗管理ダッシュボード
          </Typography>

<Typography sx={{ mr: 2 }}>
  {user.username || '...'} さん {((user.role as string) === 'staff' || (user.role as string) === 'admin') && ' (管理者)'}
  </Typography>
  
  <IconButton color="inherit" onClick={handleFullRefresh} title="最新の情報に更新">
    {isLoading ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
    </IconButton>
    <IconButton color="inherit" onClick={() => setIsSettingsOpen(true)} title="アラート設定">
      <SettingsIcon />
      </IconButton>
      
      {((user.role as string) === 'staff' || (user.role as string) === 'admin') && (
        <IconButton color="inherit" onClick={() => setIsViewingAdminPage(true)} title="管理者ページへ">
          <AdminPanelSettingsIcon />
          </IconButton>
        )}

          {/* ★ 認証: ログアウトボタン */}
          <IconButton color="inherit" onClick={logout} title="ログアウト">
            <LogoutIcon />
       </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex' }}>
        <AlertDashboard 
          selectedLawyerId={selectedLawyerId}
          onLawyerChange={handleLawyerChange}
          onAlertClick={handleAlertClick} 
        />
        <Box component="main" sx={{ flexGrow: 1, p: 3, ml: { md: '320px' }, pb: { xs: '80px', md: 3 } }}>
          <Container maxWidth={false} sx={{ mt: 4, mb: 10 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" sx={{ mb: 0 }}>
                全案件進捗一覧
              </Typography>
              <FormControl sx={{ minWidth: 240 }} size="small">
                <InputLabel>担当弁護士で絞り込み</InputLabel>
                <Select
                  value={selectedLawyerId}
                  label="担当弁護士で絞り込み"
                  onChange={handleLawyerChange}
                >
                  <MenuItem value="すべて">
                    <em>すべて</em>
                  </MenuItem>
                  {attorneys.map((attorney) => (
                    <MenuItem key={attorney.attorney_id} value={String(attorney.attorney_id)}>
                      {attorney.attorney_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <ProgressTable 
              cases={allCases} 
              searchTerm={searchTerm} 
              onSearchChange={handleSearchChange} 
              onDataReload={handleRefresh} 
              highlightedCaseMgmtNum={highlightedCaseMgmtNum}
              // 🌟 修正: Chatwork通知用のPropsを追加 (型エラー解消)
              allRecipients={allRecipients}
              onSendChatworkNotification={handleSendChatworkNotification}
alerts={alerts}
              totalCaseCount={totalCount}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
              />
           </Box>
         </Container>
        </Box>
      </Box>

      <CriticalAlertModal
        alerts={redAlerts}
        open={showCriticalModal}
        onDismiss={handleDismissCriticalAlert}
        onMarkUnresolved={handleMarkUnresolved}
      />

      <AlertSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </ThemeProvider>
  );
};

export default App;