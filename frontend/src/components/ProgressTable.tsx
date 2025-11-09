import React, { useState, useMemo } from 'react'; 
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TableSortLabel, Link, Box, Tabs, Tab, TextField, InputAdornment,
  IconButton, Collapse, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

// CaseStepperコンポーネントとSTEPS定数をインポート
// ※ 注意: CaseStepper.tsx側で export const STEPS = ... と定義されている必要があります。
// ★ 修正: getActiveStep と isValidDateValue をインポート
import CaseStepper, { STEPS, getActiveStep, isValidDateValue } from './CaseStepper';
import type { CaseProgress } from '../types/progress';

// --- 型定義 ---
type Order = 'asc' | 'desc';
type AlertFilterType = 'すべて' | '黒' | '赤' | '黄' | 'アラートなし';
type TableColumnId = keyof CaseProgress | 'details'; 

interface ProgressTableProps {
  cases: CaseProgress[];
  searchTerm: string;
  onSearchChange: (searchTerm: string) => void;
  onDataReload: () => void;
  // ★ 修正: highlightedCaseMgmtNum を必須プロパティとして追加
  highlightedCaseMgmtNum: string | null; 
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
interface RowProps {
  row: CaseProgress;
  columns: { id: TableColumnId; label: string; minWidth?: number }[];
  rowStyle: React.CSSProperties;
  className: string;
  rowRef: React.RefObject<HTMLTableRowElement | null> | null; // ←ここ修正！
}

// ★ 修正: onReload と isHighlighted を props の分割代入から削除
const CaseTableRow: React.FC<RowProps> = ({ row, columns, rowStyle, className, rowRef }) => {
  // 案件詳細の展開/折りたたみ状態を管理
  const [open, setOpen] = useState(false);
  
  // ★ 修正: CaseStepper と同じロジックで現在の進捗を計算
  const activeStep = getActiveStep(row);
  // ★ 修正: 全てのステップが完了しているか
  const isAllStepsComplete = activeStep === STEPS.length;
  
  const redirectUrl = `http://192.168.11.135/client/detail/?no=${row.management_number}`;

  return (
    <React.Fragment>
      {/* 1. メインの案件行 */}
      <TableRow
        hover
        style={rowStyle}
        className={className}
        // ★ 修正: ref を row に渡す
        ref={rowRef}
      >
        {/* 詳細ボタン用のセル */}
        <TableCell width="3%" style={rowStyle}>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)} // 詳細表示の切り替え
            sx={row.alert_status === '黒' ? { color: 'white' } : {}}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>

        {/* データ表示セル */}
        {columns.filter(c => c.id !== 'details').map((column) => (
          <TableCell key={column.id as string} style={rowStyle}>
            {(() => { // IIFE (即時実行関数) を使って複雑な分岐を処理
              const cellValue = row[column.id as keyof CaseProgress] as string | number | null;

              if (column.id === 'client_name') {
                // 依頼者氏名をクリックで社内システムに遷移（既存機能）
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

              // ★ 修正: 終了日の表示ロジック
              if (column.id === 'date_finished') {
                // 全ステップが完了しており、かつ日付データが有効な場合のみ表示
                if (isAllStepsComplete && isValidDateValue(cellValue)) {
                  return cellValue;
                }
                // それ以外（進捗が途中、またはデータが 0000-00-00 など）の場合は null (空欄)
                return null; 
              }

              // その他のカラムはそのまま表示
              return cellValue;
            })()}
          </TableCell>
        ))}
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
          _     </Box>
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
const ProgressTable: React.FC<ProgressTableProps> = ({ cases, searchTerm, onSearchChange, onDataReload, highlightedCaseMgmtNum }) => {
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy] = useState<keyof CaseProgress>('management_number');
  const [activeTab, setActiveTab] = useState<AlertFilterType>('すべて');
  // ★ 修正: highlightedCaseMgmtNum を参照するための ref を作成
  const highlightedRowRef = React.useRef<HTMLTableRowElement>(null);

  const handleRequestSort = (property: keyof CaseProgress) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    // setOrderBy(property); // ソートキー変更ロジックは残す
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
    { id: 'details', label: '', minWidth: 30 }, // 詳細ボタン用
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
              sx={{ color: 'white', bgcolor: '#212121', mr: 1 }}
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
                // ★ 修正: 不要な '_' を削除
                ) : (
                  <TableCell key={column.id as string} style={{ minWidth: column.minWidth }}>
                    <TableSortLabel
                      // column.id が CaseProgress のキーであることを保証
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
              // ★ 修正: 不要な '_' を削除
              let rowStyle: React.CSSProperties = {};
              let className = '';

              if (row.is_unanswered || row.alert_status === '赤') {
                  className = 'alert-blink-red';
              } else if (row.alert_status === '黒') {
                  rowStyle = { backgroundColor: '#212121', color: 'white' };
                  className = 'alert-black'; 
              } else if (row.alert_status === '黄') {
                  rowStyle = { backgroundColor: '#fff8e1' };
              }

                // ★ 修正: ハイライト対象の行か判定
                const isHighlighted = row.management_number === highlightedCaseMgmtNum;
                if (isHighlighted) {
                  className = 'highlight-row-animation';
                }

              return (
                // ★ 修正: 不要な 'T' を削除
                <CaseTableRow 
                  key={row.case_id} 
                  row={row} 
                  columns={columns} 
                  rowStyle={rowStyle} 
                  className={className} 
                  // ★ 修正: onReload prop の受け渡しを削除
                  // onReload={onDataReload} 
                  // ★ 修正: isHighlighted prop の受け渡しを削除
                  //   isHighlighted={isHighlighted}
                    rowRef={isHighlighted ? highlightedRowRef : null}
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