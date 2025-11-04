import React, { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Box, TableSortLabel, Tabs, Tab, Link
} from '@mui/material';
import type { CaseProgress } from '../types/progress';

// --- 型定義 (変更なし) ---
type Order = 'asc' | 'desc';
type CaseType = 'すべて' | 'ストレート破産' | '破産（管財人あり）' | '再生';

// ★ 修正点 1: onEdit プロパティを削除
interface ProgressTableProps {
  cases: CaseProgress[];
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

// --- メインコンポーネント ---
// ★ 修正点 2: onEdit を引数から削除
const ProgressTable: React.FC<ProgressTableProps> = ({ cases }) => {
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof CaseProgress>('management_number');
  const [activeTab, setActiveTab] = useState<CaseType>('すべて');

  const handleRequestSort = (property: keyof CaseProgress) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const filteredData = useMemo(() => {
    if (activeTab === 'すべて') return cases;
    return cases.filter(item => item.case_type === activeTab);
  }, [cases, activeTab]);

  const sortedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    return [...filteredData].sort(getComparator(order, orderBy));
  }, [filteredData, order, orderBy]);
  
  const columns: { id: keyof CaseProgress; label: string; minWidth?: number }[] = [
    { id: 'management_number', label: '管理番号', minWidth: 100 },
    { id: 'client_name', label: '依頼者氏名', minWidth: 150 },
    { id: 'attorney_name', label: '担当弁護士' },
    { id: 'staff_name', label: '担当事務員' },
    { id: 'date_received', label: '受任日' },
    { id: 'case_type', label: '事件の種類' },
    { id: 'date_filing', label: '申立日' },
    { id: 'date_finished', label: '終了日' },
  ];

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="すべて" value="すべて" />
          <Tab label="A. ストレート破産" value="ストレート破産" />
          <Tab label="B. 破産 (管財人あり)" value="破産（管財人あり）" />
          <Tab label="C. 再生" value="再生" />
        </Tabs>
      </Box>
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id as string} style={{ minWidth: column.minWidth }}>
                  <TableSortLabel
                    active={orderBy === column.id}
                    direction={orderBy === column.id ? order : 'asc'}
                    onClick={() => handleRequestSort(column.id)}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              {/* ★ 修正点 3: 「操作」列のヘッダーを削除 */}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.map((row) => {
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

              return (
                <TableRow 
                  key={row.case_id}
                  hover
                  style={rowStyle} 
                  className={className} 
                >
                  {columns.map((column) => (
                    <TableCell key={column.id as string} style={rowStyle}> 
                      {column.id === 'client_name' ? (
                        <Link 
                          href={`http://192.168.11.135/client/detail/?no=${row.management_number}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          sx={{ color: 'inherit' }}
                        >
                          {row.client_name}
                        </Link>
                      ) : (
                        row[column.id] as string | number | null
                      )}
                    </TableCell>
                  ))}
                  {/* ★ 修正点 4: 「編集」ボタンのセルを削除 */}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ProgressTable;

