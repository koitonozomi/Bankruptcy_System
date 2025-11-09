import React, { useState, useCallback, useEffect } from 'react';
import { 
  Container, Typography, AppBar, Toolbar, 
  ThemeProvider, createTheme, IconButton, CircularProgress, Box,
  FormControl, InputLabel, Select, MenuItem, Pagination
} from '@mui/material';
// ★ 修正1: SelectChangeEvent を type-only import にする
import type { SelectChangeEvent } from '@mui/material'; 
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import ProgressTable from './components/ProgressTable';
import AlertDashboard from './components/AlertDashboard';
import CriticalAlertModal from './components/CriticalAlertModal';
import AlertSettingsModal from './components/AlertSettingsModal';
import type { CaseProgress } from './types/progress';
// ★ 修正2: Attorney は型として使用されているため type-only import にする
import type { Attorney } from './types/progress';
import { useAlerts } from './hooks/useAlerts';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0c2d3dff',
    },
  },
});

const App: React.FC = () => {
  // fetchData は useAlerts から提供されるデータ取得関数
  const { allCases, totalCount, alerts, attorneys, fetchData, isLoading } = useAlerts();

  // --- State管理 ---
  const [modalDismissed, setModalDismissed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('すべて');
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(''); 
  
  const rowsPerPage = 50;
  const [pageCount, setPageCount] = useState(0);

  // クリックされた案件の管理番号を保持するState
  const [highlightedCaseMgmtNum, setHighlightedCaseMgmtNum] = useState<string | null>(null);
  
  useEffect(() => {
    setPageCount(Math.ceil(totalCount / rowsPerPage));
  }, [totalCount, rowsPerPage]);

// デバッグ1: allCasesが更新されたタイミングを監視
  useEffect(() => {
    console.log(`[DEBUG App] allCases が更新されました。総件数: ${allCases.length}`);
  }, [allCases]);


  // --- イベントハンドラ ---

  // 進捗テーブルのリロードに使用する関数
  const handleRefresh = useCallback(async () => {
    console.log(`[DEBUG App] 強制リフレッシュ (handleRefresh) が呼び出されました。`);

    await fetchData(page, rowsPerPage, selectedLawyerId, searchTerm);
    console.log(`[DEBUG App] fetchData 実行完了。allCasesが更新されるのを待ちます。`);
  }, [page, rowsPerPage, selectedLawyerId, searchTerm, fetchData]);


  // AppBarのリフレッシュボタン用 (全リセット)
  const handleFullRefresh = async () => {
    setPage(1);
    setSelectedLawyerId('すべて');
    setSearchTerm(''); // 検索キーワードをリセット
    setHighlightedCaseMgmtNum(null); // ハイライトをリセット
    await fetchData(1, rowsPerPage, 'すべて', ''); // 全リセットでデータを取得
    setModalDismissed(false); // クリティカルアラートを再表示
  };
  
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    setHighlightedCaseMgmtNum(null); // ページング時はハイライトを解除
    fetchData(value, rowsPerPage, selectedLawyerId, searchTerm); 
  };
  
  const handleLawyerChange = (event: SelectChangeEvent<string>) => {
    const newLawyerId = event.target.value;
    setSelectedLawyerId(newLawyerId);
    setPage(1);
    setHighlightedCaseMgmtNum(null); // フィルタ変更時はハイライトを解除
    fetchData(1, rowsPerPage, newLawyerId, searchTerm);
  };

  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    setPage(1); // 検索時はページをリセット
    setHighlightedCaseMgmtNum(null); // 検索入力時はハイライトを解除
    fetchData(1, rowsPerPage, selectedLawyerId, newSearchTerm);
  };

  // AlertDashboard から呼ばれるクリックハンドラ
  const handleAlertClick = (managementNumber: string | null) => {
    if (managementNumber) {
      // 検索キーワードを管理番号に設定し、検索を実行
      setSearchTerm(managementNumber);
      setPage(1);
      fetchData(1, rowsPerPage, selectedLawyerId, managementNumber);
      
      // ハイライトを有効化 (ProgressTableがスクロールするために使用)
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

  return (
    <ThemeProvider theme={theme}>
      <style>{`
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
        /* 新しいCSSルール: 背景が黒のアラート行のボタンの文字色を白にする */
        .MuiTableRow-root.alert-black .MuiButton-root {
          color: white;
        }
      `}</style>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            破産・再生 進捗管理ダッシュボード
          </Typography>
          <IconButton color="inherit" onClick={handleFullRefresh} title="最新の情報に更新">
            {isLoading ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
          </IconButton>
          <IconButton color="inherit" onClick={() => setIsSettingsOpen(true)} title="アラート設定">
            <SettingsIcon />
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