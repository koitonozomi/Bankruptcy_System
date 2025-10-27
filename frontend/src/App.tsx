import React, { useState, useCallback, useEffect } from 'react';
import { 
  Container, Typography, AppBar, Toolbar, Button, 
  ThemeProvider, createTheme, IconButton, CircularProgress, Box,
  FormControl, InputLabel, Select, MenuItem, Pagination
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import ProgressTable from './components/ProgressTable';
import AlertDashboard from './components/AlertDashboard';
import CriticalAlertModal from './components/CriticalAlertModal';
import CaseDetailForm from './components/CaseDetailForm';
import AlertSettingsModal from './components/AlertSettingsModal';
import type { CaseProgress } from './types/progress';
import { useAlerts } from './hooks/useAlerts';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0c2d3dff',
    },
  },
});

const App: React.FC = () => {
  const { allCases, totalCount, alerts, attorneys, fetchData, isLoading } = useAlerts();

  // --- State管理 ---
  const [modalDismissed, setModalDismissed] = useState(false);
  const [isDetailFormOpen, setIsDetailFormOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [highlightField, setHighlightField] = useState<keyof CaseProgress | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('すべて');
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;
  const [pageCount, setPageCount] = useState(0);
  
  useEffect(() => {
    setPageCount(Math.ceil(totalCount / rowsPerPage));
  }, [totalCount, rowsPerPage]);


  // --- イベントハンドラ ---
  const handleSaveCase = async (dataToSave: Partial<CaseProgress>) => {
    const isNew = !dataToSave.case_id;
    const method = isNew ? 'POST' : 'PATCH';
    const url = isNew 
      ? `http://localhost:3001/api/cases` 
      : `http://localhost:3001/api/cases/${dataToSave.case_id}`;
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataToSave),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '保存に失敗しました');
    }
    fetchData(page, rowsPerPage, selectedLawyerId);
  };

  const handleRefresh = async () => {
    setPage(1);
    setSelectedLawyerId('すべて');
    await fetchData(1, rowsPerPage, 'すべて');
    setModalDismissed(false);
  };
  
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    fetchData(value, rowsPerPage, selectedLawyerId);
  };
  
  const handleLawyerChange = (event: SelectChangeEvent<string>) => {
    const newLawyerId = event.target.value;
    setSelectedLawyerId(newLawyerId);
    setPage(1);
    fetchData(1, rowsPerPage, newLawyerId);
  };

  const handleDismissCriticalAlert = () => { setModalDismissed(true); };
  
  const handleMarkUnresolved = useCallback(async (caseId: string) => {
    console.log(`Marking case ${caseId} as unresolved is not fully implemented yet.`);
    setModalDismissed(true);
  }, []);

  const handleEditCase = useCallback((caseId: string, fieldToHighlight: keyof CaseProgress | null) => {
    setSelectedCaseId(caseId);
    setHighlightField(fieldToHighlight);
    setIsDetailFormOpen(true);
    setModalDismissed(true);
  }, []);

  const handleOpenNewCaseForm = () => {
    setSelectedCaseId(null);
    setHighlightField(null);
    setIsDetailFormOpen(true);
  };

  const handleCloseDetailForm = () => {
    setIsDetailFormOpen(false);
    setSelectedCaseId(null);
    setHighlightField(null);
  };

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
          <Button color="inherit" onClick={handleOpenNewCaseForm}>
            + 新規案件登録
          </Button>
          <IconButton color="inherit" onClick={handleRefresh} title="最新の情報に更新">
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
              onEdit={(caseId) => handleEditCase(caseId, null)} 
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

      <AlertDashboard 
        selectedLawyerId={selectedLawyerId}
        onLawyerChange={handleLawyerChange}
      /> 

      <CriticalAlertModal
        alerts={redAlerts}
        open={showCriticalModal}
        onDismiss={handleDismissCriticalAlert}
        onMarkUnresolved={handleMarkUnresolved}
        onEditCase={handleEditCase}
      />

      {isDetailFormOpen && (() => {
        const selectedCaseData = selectedCaseId 
          ? allCases.find(c => String(c.case_id) === selectedCaseId) || null 
          : null;
        return (
          <CaseDetailForm
            open={isDetailFormOpen}
            onClose={handleCloseDetailForm}
            caseData={selectedCaseData}
            highlightField={highlightField}
            onSave={handleSaveCase}
            lawyerList={attorneys}
          />
        );
      })()}

      <AlertSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </ThemeProvider>
  );
};

export default App;

