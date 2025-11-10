import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
// ★ 修正点 1: useAlertsフックが返す新しい 'Alert' 型をインポート
import type { Alert } from '../hooks/useAlerts';
// import type { CaseProgress } from '../types/progress'; // ★ 修正: 未使用のため削除

// ★ 修正点 3: Propsの型定義を全面的に更新
interface CriticalAlertModalProps {
  alerts: Alert[];
  open: boolean;
  onDismiss: () => void;
  onMarkUnresolved: (caseId: string) => void;
  // onEditCase: (caseId: string, fieldToHighlight: keyof CaseProgress | null) => void; // ★ 削除
}

// ★ 修正点 A: 社内システムへの遷移ベースURLを定義
const INTERNAL_SYSTEM_BASE_URL = 'http://192.168.11.135/client/detail/';

// ★ 修正点 F: onEditCaseを引数から削除
const CriticalAlertModal: React.FC<CriticalAlertModalProps> = ({ alerts, open, onDismiss, onMarkUnresolved }) => {
  // ★ 修正点 B: エラー表示のための状態を追加
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const redAlerts = alerts.filter(alert => alert.type === 'red');

  // ★ 修正点 C: 社内システムへの遷移関数を定義
  // Argument of type 'string | null' is not assignable to parameter of type 'string | undefined' エラーを修正
  const handleSystemTransition = (managementNumber: string | undefined | null) => {
    // managementNumberが存在し、かつ空文字ではないことを確認
    if (managementNumber && managementNumber.trim() !== "") {
      const url = `${INTERNAL_SYSTEM_BASE_URL}?no=${managementNumber}`;
      window.open(url, '_blank'); // 新しいタブで開く
    } else {
      console.error("Management number is missing for system transition.");
      setErrorMessage('案件管理番号がないため、社内システムに遷移できません。');
      setErrorModalOpen(true);
    }
  };

  if (!open || redAlerts.length === 0) {
    return null;
  }

  return (
    <>
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
                    color="primary"
                    // ★ このボタンが、社内システムへの遷移関数を呼び出しています。
                    onClick={() => handleSystemTransition(alert.managementNumber)} 
                  >
                    社内システムに遷移
                  </Button>
                   {/* 
                  <Button variant="outlined" onClick={() => onMarkUnresolved(alert.caseId)}>
                    未対応としてマーク
                  </Button> */}
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onDismiss}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* ★ エラーメッセージ表示用の小さなモーダル */}
      <Dialog
        open={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        maxWidth="xs"
      >
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>エラー</DialogTitle>
        <DialogContent>
          <Typography sx={{ pt: 2 }}>{errorMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorModalOpen(false)}>OK</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CriticalAlertModal;