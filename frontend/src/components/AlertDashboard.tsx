import React, { useMemo } from 'react';
import { useAlerts } from '../hooks/useAlerts';
import { Paper, Typography, Box, Chip, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import type { Alert } from '../hooks/useAlerts';

// ★ 修正点 1: onAlertClick をPropsに追加
interface AlertDashboardProps {
  selectedLawyerId: string;
  onLawyerChange: (event: SelectChangeEvent<string>) => void;
  onAlertClick: (managementNumber: string | null) => void;
}

const AlertDashboard: React.FC<AlertDashboardProps> = ({ selectedLawyerId, onLawyerChange, onAlertClick }) => {
  const { alerts, attorneys } = useAlerts();

  
  const filteredAlerts = useMemo(() => {
    if (selectedLawyerId === 'すべて') {
      return alerts;
    }
    if (selectedLawyerId === '担当者なし') {
      return alerts.filter(alert => !alert.attorneyName);
    }
    // IDから弁護士名を探し、その名前でアラートをフィルタリング
    const selectedAttorney = attorneys.find(a => String(a.attorney_id) === selectedLawyerId);
    if (!selectedAttorney) return [];
    
    return alerts.filter(alert => alert.attorneyName === selectedAttorney.attorney_name);
  }, [alerts, selectedLawyerId, attorneys]);

  const getAlertStyles = (alertType: Alert['type']) => {
    switch (alertType) {
      case 'black':
        return { bgcolor: '#0f0f0fff', color: 'white' };
      case 'red':
        return { bgcolor: '#c62828', color: 'white' };
      case 'yellow':
      default:
        return { bgcolor: '#ffb74d', color: 'black' };
    }
  };

  console.log('🔍 alerts:', alerts);
console.log('🔍 attorneys:', attorneys);
console.log('🔍 selectedLawyerId:', selectedLawyerId);
console.log('🔍 filteredAlerts:', filteredAlerts);

  
  // アラートがない場合は何も表示しない
  if (alerts.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        zIndex: 1000,
        top: '64px', left: 0, width: '320px', bottom: 0,
        flexDirection: 'column', alignItems: 'flex-start', p: 2, gap: 2,
        bgcolor: '#37474f', color: 'white', borderTop: 'none',
// 🌟 修正: 画面サイズに関わらず常に表示する (開発用)
        display: 'flex', 
        '@media (max-width: 900px)': {
          display: 'none', // モバイルでの表示制御を調整
// (またはモバイル表示をテストしたい場合は display: 'block' など)
        top: 'auto', left: 0, right: 0, bottom: 0,
        width: '100%', maxHeight: '40vh',
        borderTop: '1px solid rgba(255,255,255,0.2)', p: 1,
       }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
        <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          アラート ({filteredAlerts.length}件)
        </Typography>
      </Box>

      <FormControl fullWidth size="small" sx={{ 
        bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1,
        '& .MuiInputBase-root': { color: 'white' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
        '& .MuiSvgIcon-root': { color: 'white' },
      }}>
        <InputLabel id="lawyer-filter-label-dashboard" sx={{color: 'rgba(255,255,255,0.7)'}}>担当者で絞り込み</InputLabel>
        <Select
          labelId="lawyer-filter-label-dashboard"
          value={selectedLawyerId}
          label="担当者で絞り込み"
          onChange={onLawyerChange}
        >
          <MenuItem value="すべて">すべて</MenuItem>
          <MenuItem value="担当者なし">担当者なし</MenuItem>
          {attorneys.map(lawyer => (
            <MenuItem key={lawyer.attorney_id} value={String(lawyer.attorney_id)}>{lawyer.attorney_name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: 'column', overflowY: 'auto' }}>
        {filteredAlerts.map((alert) => {
            const styles = getAlertStyles(alert.type);
            const 担当者 = alert.attorneyName || '担当者なし';
            
            return (
                <Chip
                    key={alert.caseId}
                    // ★ 修正点 3: onClickイベントハンドラを追加
                    onClick={() => onAlertClick(alert.managementNumber)}
                    label={
                        <Box sx={{ textAlign: 'left', width: '100%' }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                                {alert.type === 'black' ? '【緊急】' : alert.type === 'red' ? '【重大】' : '【警告】'} 
                                {alert.clientName} 様
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'normal' }}>
                                {alert.message} / 担当: {担当者}
                            </Typography>
                        </Box>
                    }
                    sx={{
                        height: 'auto', p: 1, ...styles,
                        justifyContent: 'flex-start',
                        '& .MuiChip-label': { display: 'block', whiteSpace: 'normal', p: 0 },
                        width: '100%',
                        cursor: 'pointer', // ★ 修正点 4: クリック可能であることを示す
                    }}
                />
            );
        })}
      </Box>
    </Paper>
  );
};

export default AlertDashboard;