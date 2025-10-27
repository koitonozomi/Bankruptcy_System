import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Table, TableHead, TableBody, TableCell, TableRow, TextField, Switch,
  CircularProgress, Typography, TableContainer
} from '@mui/material';
import type { AlertCondition } from '../types/progress';

interface AlertSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({ open, onClose }) => {
  const [conditions, setConditions] = useState<AlertCondition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const fetchConditions = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch('http://localhost:3001/api/alert-conditions');
          if (!response.ok) {
            throw new Error('設定の読み込みに失敗しました');
          }
          const data: AlertCondition[] = await response.json();
          setConditions(data);
        } catch (e: any) {
          setError(e.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchConditions();
    }
  }, [open]);

  // ★ 修正点 1: 'red' | 'yellow' を受け取れるように関数を修正
  const handleDayChange = (conditionId: number, days: string, type: 'red' | 'yellow') => {
    const newConditions = conditions.map(c => {
      if (c.condition_id === conditionId) {
        const newValues = { ...c };
        const dayValue = parseInt(days);
        if (type === 'red') {
          newValues.threshold_days_red = isNaN(dayValue) ? 0 : dayValue;
        } else {
          // 黄色は空欄を許容するため、NaNの場合はnullをセット
          newValues.threshold_days_yellow = isNaN(dayValue) ? null : dayValue;
        }
        return newValues;
      }
      return c;
    });
    setConditions(newConditions);
  };

  const handleToggleActive = (conditionId: number) => {
    const newConditions = conditions.map(c =>
      c.condition_id === conditionId ? { ...c, is_active: !c.is_active } : c
    );
    setConditions(newConditions);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/alert-conditions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions),
      });
      if (!response.ok) {
        throw new Error('設定の保存に失敗しました');
      }
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>アラート設定</DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>監視イベント</TableCell>
                  <TableCell align="center">警告 (黄) の日数</TableCell>
                  <TableCell align="center">重大 (赤) の日数</TableCell>
                  <TableCell align="center">有効/無効</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {conditions.map((condition) => (
                  <TableRow key={condition.condition_id}>
                    <TableCell>{condition.trigger_event}</TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        value={condition.threshold_days_yellow ?? ''}
                        onChange={(e) => handleDayChange(condition.condition_id, e.target.value, 'yellow')}
                        sx={{ width: '80px' }}
                        label="日数"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        value={condition.threshold_days_red}
                        onChange={(e) => handleDayChange(condition.condition_id, e.target.value, 'red')}
                        sx={{ width: '80px' }}
                        label="日数"
                        required
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={condition.is_active}
                        onChange={() => handleToggleActive(condition.condition_id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        {error && <Typography color="error" sx={{ mr: 2 }}>{error}</Typography>}
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={handleSave} variant="contained" disabled={isSaving}>
          {isSaving ? <CircularProgress size={24} /> : '設定を保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlertSettingsModal;