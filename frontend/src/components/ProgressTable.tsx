import React, { useState, useMemo } from 'react'; 
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TableSortLabel, Link, Box, Tabs, Tab, TextField, InputAdornment,
  IconButton, Collapse, Typography,
  Button, Menu, Checkbox, ListItemText, MenuItem, // 必要なMUIコンポーネントをすべてインポート
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import type { Alert } from '../hooks/useAlerts';

// CaseStepperコンポーネントとSTEPS定数をインポート
import CaseStepper, { STEPS, getActiveStep, isValidDateValue } from './CaseStepper';
import type { CaseProgress } from '../types/progress';

// --- 型定義 ---
type Order = 'asc' | 'desc';
type AlertFilterType = 'すべて' | '黒' | '赤' | '黄' | 'アラートなし';
type TableColumnId = keyof CaseProgress | 'details'; 

// 🌟 追加 1: 通知対象となるユーザーの型（仮）
interface NotificationRecipient {
  id: number; // Chatwork ID, ユーザーIDなど
  name: string; // 弁護士名、事務員名など
}

interface ProgressTableProps {
  cases: CaseProgress[];
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
  onDataReload: () => void;
  highlightedCaseMgmtNum: string | null; 
  // 🌟 Chatwork送信ハンドラと、通知対象ユーザーリスト
  allRecipients: NotificationRecipient[];
  onSendChatworkNotification: (
    caseManagementNumber: string | null,
    clientName: string,
    recipients: NotificationRecipient[]
  ) => void;

  // ★★★ ここから追加 ★★★
  alerts: Alert[]; // すべてのアラートデータ
  totalCaseCount: number; // 全案件の総数 (useAlerts の totalCount)
  // ★★★ ここまで追加 ★★★
}


// --- ヘルパー関数 (変更なし) ---
function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  const bValue = b[orderBy] || '';
  const aValue = a[orderBy] || '';
  if (bValue < aValue) return -1;
  if (bValue > aValue) return 1;
  return 0;
}

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (a: { [key in Key]?: any }, b: { [key in Key]?: any }) => number {
  return order === 'desc'
  ? (a, b) => descendingComparator(a, b, orderBy)
  : (a, b) => -descendingComparator(a, b, orderBy);
}

// ----------------------------------------------------------------------
// 案件の個別行コンポーネント (詳細展開ロジックを含む)
// ----------------------------------------------------------------------
// 🌟 修正 2: RowPropsに通知関連のPropsを追加 (ProgressTablePropsから型を継承)
interface RowProps {
  row: CaseProgress;
  columns: { id: TableColumnId; label: string; minWidth?: number }[];
  rowStyle: React.CSSProperties;
  className: string;
  rowRef: React.RefObject<HTMLTableRowElement | null> | null; 
  allRecipients: ProgressTableProps['allRecipients'];
  onSendChatworkNotification: ProgressTableProps['onSendChatworkNotification'];
}


const CaseTableRow: React.FC<RowProps> = ({ 
  row, columns, rowStyle, className, rowRef,
  allRecipients, onSendChatworkNotification // 🌟 Propsの分割代入を修正
}) => {
  // 案件詳細の展開/折りたたみ状態を管理
  const [open, setOpen] = useState(false);

  // Chatwork通知用ステート
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<NotificationRecipient[]>([]);


// ★ 修正: CaseStepper と同じロジックで現在の進捗を計算
　const activeStep = getActiveStep(row);
// ★ 修正: 全てのステップが完了しているか
　const isAllStepsComplete = activeStep === STEPS.length;

const redirectUrl = `http://192.168.11.135/client/detail/?no=${row.management_number}`;

  // Chatwork通知ハンドラ
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    // 担当弁護士/事務員が受信者リストにいる場合、初期選択する (IDまたは名前で比較)
    const initialSelection = allRecipients.filter(r => 
        r.name === row.attorney_name || r.name === row.staff_name
    );
    setSelectedRecipients(initialSelection);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRecipientToggle = (recipient: NotificationRecipient) => {
    setSelectedRecipients(prev => 
      prev.some(r => r.id === recipient.id)
        ? prev.filter(r => r.id !== recipient.id)
        : [...prev, recipient]
    );
  };

  const handleSend = () => {
    if (selectedRecipients.length > 0) {
      onSendChatworkNotification(row.management_number, row.client_name, selectedRecipients);
    }
    handleMenuClose();
  };


　return (
<React.Fragment>
  {/* 1. メインの案件行 */}
<TableRow
hover
 style={rowStyle}
 className={className}
 ref={rowRef}
>
{/* 詳細ボタン用のセル */}
 <TableCell width="200px" style={rowStyle}> 
  <IconButton
  aria-label="expand row"
  size="small"
   onClick={() => setOpen(!open)} // 詳細表示の切り替え
    sx={row.alert_status === '黒' ? { color: 'white' } : {}}
 >
  {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
  </IconButton>
          
          {/* 🌟 修正 3: 通知ボタンの追加 */}
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleMenuOpen}
            sx={{ 
                ml: 1, 
                backgroundColor: row.alert_status === '黒' ? 'white' : 'transparent',
                color: row.alert_status === '黒' ? 'black' : 'inherit',
                borderColor: row.alert_status === '黒' ? 'white' : 'rgba(255, 255, 255, 0.23)',
                '&:hover': {
                  backgroundColor: row.alert_status === '黒' ? '#f0f0f0' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: row.alert_status === '黒' ? '#f0f0f0' : 'rgba(255, 255, 255, 0.3)',
                }
            }}
          >
            通知
          </Button>
          
          {/* 🌟 修正 4: 通知対象選択メニュー */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            PaperProps={{ style: { maxHeight: 250, width: '25ch' } }}
          >
            <Typography variant="subtitle2" sx={{ p: 1 }}>通知先選択 ({row.client_name})</Typography>
            <Box sx={{ borderBottom: '1px solid #eee', mb: 1 }} />
            {/* 🌟 修正 5: allRecipientsが存在しない場合に備えて空配列を設定 */}
            {(allRecipients || []).map((recipient) => ( 
              <MenuItem 
                key={recipient.id} 
                onClick={() => handleRecipientToggle(recipient)}
                sx={{ py: 0.5 }}
              >
                <Checkbox 
                  checked={selectedRecipients.some(r => r.id === recipient.id)} 
                  size="small"
                />
                <ListItemText primary={recipient.name} sx={{ ml: -1 }} />
              </MenuItem>
            ))}
            <Box sx={{ p: 1 }}>
              <Button 
                fullWidth 
                variant="contained" 
                color="primary" 
                onClick={handleSend}
                disabled={selectedRecipients.length === 0}
              >
                Chatwork送信 ({selectedRecipients.length})
              </Button>
            </Box>
          </Menu>
          </TableCell>

{/* データ表示セル */}
{columns.filter(c => c.id !== 'details').map((column) => (
  <TableCell key={column.id as string} style={rowStyle}>{(() => { // IIFE (即時実行関数) を使って複雑な分岐を処理
  const cellValue = row[column.id as keyof CaseProgress] as string | number | null;

　　if (column.id === 'client_name') {
  return (
  <Link 
  href={redirectUrl} 
  target="_blank" 
  rel="noopener noreferrer"
  sx={{ color: row.alert_status === '黒' ? 'white' : 'inherit', fontWeight: 'bold' }}
  >
    {row.client_name}
    </Link>
    );
   }
   if (column.id === 'date_finished') {
    if (isAllStepsComplete && isValidDateValue(cellValue)) {
       return cellValue;
      }
      return null; 
    }
    return cellValue;
    })()}
    </TableCell>))}
      </TableRow>

      {/* 2. 詳細情報（進捗状況）を表示する行 */}
      <TableRow>
        {/* colSpanは全カラム数 (9) + 詳細ボタン用のセル (1) = 10 */}
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={columns.length + 1}> 
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, border: '1px solid #ddd', borderRadius: 1, p: 2, backgroundColor: '#f9f9f9' }}>
              <Typography variant="subtitle1" component="div" gutterBottom>
                案件進捗: {row.client_name} ({row.management_number})
              </Typography>
              {/* 進捗コンポーネントを配置 */}
              <CaseStepper item={row} />
              
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  ※ 案件の詳細な操作や編集は、依頼者氏名をクリックして社内システムに遷移して行ってください。
                </Typography>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};


// ----------------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------------
const ProgressTable: React.FC<ProgressTableProps> = ({ 
  cases, searchTerm, onSearchChange, onDataReload, highlightedCaseMgmtNum,
  // 🌟 Propsを分割代入
  allRecipients, onSendChatworkNotification
}) => {
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy] = useState<keyof CaseProgress>('management_number');
  const [activeTab, setActiveTab] = useState<AlertFilterType>('すべて');
  // ★ 修正: highlightedCaseMgmtNum を参照するための ref を作成
  const highlightedRowRef = React.useRef<HTMLTableRowElement>(null);

  const handleRequestSort = (property: keyof CaseProgress) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const sortedDataOnly = useMemo(() => {
    if (!cases || cases.length === 0) return [];
    return [...cases].sort(getComparator(order, orderBy));
  }, [cases, order, orderBy]);

  const dataToDisplay = useMemo(() => {
    if (activeTab === 'すべて') return sortedDataOnly;

    return sortedDataOnly.filter(item => {
      const status = item.alert_status;
      
      if (activeTab === 'アラートなし') {
        return !status || status.trim() === ''; 
      }
      return status === activeTab;
    });
  }, [sortedDataOnly, activeTab]);
  
  // カラム定義: 修正後の型TableColumnId[]を使用
  const columns: { id: TableColumnId; label: string; minWidth?: number }[] = useMemo(() => [
    { id: 'details', label: 'アクション', minWidth: 200 }, // 通知ボタンと詳細ボタンのスペースを確保
    { id: 'management_number', label: '管理番号', minWidth: 100 },
    { id: 'client_name', label: '依頼者氏名', minWidth: 150 },
    { id: 'attorney_name', label: '担当弁護士' },
    { id: 'staff_name', label: '担当事務員' },
    { id: 'date_received', label: '受任日' },
    { id: 'case_type', label: '事件の種類' },
    { id: 'date_filing', label: '申立日' },
    { id: 'date_finished', label: '終了日' },
  ], []);

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {/* 検索バーとタブUI */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="依頼者名または管理番号で検索"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: '100%', sm: 300 } }}
        />
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue: AlertFilterType) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="alert status tabs"
          >
            <Tab label="すべて" value="すべて" />
            <Tab 
              label={`緊急 (黒) (${sortedDataOnly.filter(c => c.alert_status === '黒').length})`} 
              value="黒" 
              sx={{ color: 'black', bgcolor: '#ffffffff', mr: 1 }}
            />
            <Tab 
              label={`重大 (赤) (${sortedDataOnly.filter(c => c.alert_status === '赤').length})`} 
              value="赤" 
              sx={{ color: '#d32f2f', mr: 1 }}
            />
            <Tab 
              label={`警告 (黄) (${sortedDataOnly.filter(c => c.alert_status === '黄').length})`} 
              value="黄" 
              sx={{ color: '#ffb300', mr: 1 }}
            />
            <Tab 
              label={`アラートなし (${sortedDataOnly.filter(c => !c.alert_status || c.alert_status.trim() === '').length})`} 
              value="アラートなし" 
            />
          </Tabs>
        </Box>
      </Box>

      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                column.id === 'details' ? (
                  <TableCell key={column.id as string} style={{ minWidth: column.minWidth }}>{column.label}</TableCell>
                ) : (
                  <TableCell key={column.id as string} style={{ minWidth: column.minWidth }}>
                    <TableSortLabel
                      active={orderBy === column.id as keyof CaseProgress} 
                      direction={orderBy === column.id as keyof CaseProgress ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id as keyof CaseProgress)}
                    >
                      {column.label}
                    </TableSortLabel>
                  </TableCell>
                )
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {dataToDisplay.map((row) => {
              let rowStyle: React.CSSProperties = {};
              let className = '';

              if (row.is_unanswered || row.alert_status === '赤') {
  rowStyle = { backgroundColor: '#d31515ff', color: 'white' };
                  className = 'alert-blink-red';
              } else if (row.alert_status === '黒') {
                  rowStyle = { backgroundColor: '#212121', color: 'white' };
                  className = 'alert-black'; 
              } else if (row.alert_status === '黄') {
                  rowStyle = { backgroundColor: '#f1d42dff' };
              }

                const isHighlighted = row.management_number === highlightedCaseMgmtNum;
                if (isHighlighted) {
                  className = 'highlight-row-animation';
                }

              return (
                <CaseTableRow 
                  key={row.case_id} 
                  row={row} 
                  columns={columns} 
                  rowStyle={rowStyle} 
                  className={className} 
                  rowRef={isHighlighted ? highlightedRowRef : null}
                  // 🌟 Propsを渡す (allRecipients, onSendChatworkNotification)
                  allRecipients={allRecipients}
                  onSendChatworkNotification={onSendChatworkNotification}
                />
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ProgressTable;