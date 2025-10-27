import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
// ★ 修正点 1: useAlertsフックが返す新しい 'Alert' 型をインポート
import type { Alert } from '../hooks/useAlerts';
// ★ 修正点 2: データベースの型定義 'CaseProgress' をインポート
import type { CaseProgress } from '../types/progress';

// ★ 修正点 3: Propsの型定義を全面的に更新
interface CriticalAlertModalProps {
  alerts: Alert[];
  open: boolean;
  onDismiss: () => void;
  onMarkUnresolved: (caseId: string) => void;
  // App.tsxのhandleEditCase関数と型を完全に一致させる
  onEditCase: (caseId: string, fieldToHighlight: keyof CaseProgress | null) => void;
}

const CriticalAlertModal: React.FC<CriticalAlertModalProps> = ({ alerts, open, onDismiss, onMarkUnresolved, onEditCase }) => {
  // このフィルタリングロジックは変更なしでOK
  const redAlerts = alerts.filter(alert => alert.type === 'red');

  if (!open || redAlerts.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onDismiss} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', bgcolor: '#d32f2f', color: 'white' }}>
        <WarningIcon sx={{ mr: 1 }} />
        重大な遅延アラート ({redAlerts.length}件)
      </DialogTitle>
      <DialogContent dividers>
        <Typography gutterBottom>
          以下の案件で重大な遅延や期限超過が発生しています。すぐに確認し、対応してください。
        </Typography>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {/* ★ 修正点 4: 新しい 'alert' オブジェクトの構造に合わせて表示内容を更新 */}
          {redAlerts.map((alert) => (
            <Box component="li" key={alert.caseId} sx={{ mb: 2 }}>
              <Typography variant="h6" component="div">
                {alert.clientName} 様
                <Chip label={alert.attorneyName || '担当未設定'} size="small" sx={{ ml: 1 }} />
              </Typography>
              <Typography color="error" gutterBottom>{alert.message}</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  variant="contained" 
                  // このモーダルからは特定の項目をハイライトしないので 'null' を渡す
                  onClick={() => onEditCase(alert.caseId, null)}
                >
                  編集して対応
                </Button>
                <Button variant="outlined" onClick={() => onMarkUnresolved(alert.caseId)}>
                  未対応としてマーク
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CriticalAlertModal;