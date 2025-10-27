import React, { useState, useEffect, useCallback } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, TextField, Button, Box, 
  Typography, Snackbar, CircularProgress, Chip, MenuItem, 
  FormControl, InputLabel, Select, Switch, FormControlLabel
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import type { AlertProps } from '@mui/material'; 
import type { CaseProgress, Attorney } from '../types/progress';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface CaseDetailFormProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseProgress | null;
  highlightField: keyof CaseProgress | null;
  onSave: (dataToSave: Partial<CaseProgress>) => Promise<void>;
  lawyerList: Attorney[];
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const dateToString = (date: string | null | undefined): string => {
  return date ? date.substring(0, 10) : '';
};

const CaseDetailForm: React.FC<CaseDetailFormProps> = ({ open, onClose, caseData, highlightField, onSave, lawyerList }) => {
  
  const [formData, setFormData] = useState<Partial<CaseProgress>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' } | null>(null);
  const [dueDates, setDueDates] = useState<string[]>([]);
  const [newDueDate, setNewDueDate] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (caseData) {
        setFormData(caseData);
        setDueDates(caseData.reminder_documents_dates || []);
      } else {
        setFormData({ case_type: 'ストレート破産', is_trustee_case: false });
        setDueDates([]);
      }
    }
  }, [open, caseData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, type, value } = e.target;
    const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSelectChange = (e: SelectChangeEvent<any>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as string | number }));
  };

  const handleAddDueDate = useCallback(() => {
    if (newDueDate) {
      setDueDates(prev => [...prev, newDueDate].sort());
      setNewDueDate('');
    }
  }, [newDueDate]);
  
  const handleDeleteDueDate = useCallback((dateToRemove: string) => {
    setDueDates(prev => prev.filter(date => date !== dateToRemove));
  }, []);

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const dataToSave: Partial<CaseProgress> = { ...formData, reminder_documents_dates: dueDates };
    if (dataToSave.is_unanswered) dataToSave.is_unanswered = false;
    try {
      await onSave(dataToSave);
      setSnackbar({ open: true, message: "保存しました。", severity: 'success' });
      onClose();
    } catch (error: any) {
      setSnackbar({ open: true, message: `保存エラー: ${error.message}`, severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [formData, dueDates, onSave, onClose]);

  const highlightSx = {
    border: '2px solid #d32f2f', borderRadius: '4px',
    animation: 'blinker 1.5s ease-in-out infinite',
    boxShadow: '0 0 10px rgba(211, 47, 47, 0.7)',
  };
  
  return (
    <>
      <style>{`@keyframes blinker { 50% { border-color: #ffcdd2; box-shadow: 0 0 15px rgba(211, 47, 47, 0.4); } }`}</style>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>{caseData ? `案件編集: ${caseData.client_name}` : "新規案件登録"}</DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleSave} sx={{ pt: 2 }}>
            
            <Typography variant="h6" gutterBottom>基本情報</Typography>
            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                    <TextField label="管理番号" name="management_number" value={formData.management_number || ''} onChange={handleChange} required disabled={!!caseData} />
                    <TextField label="依頼者氏名" name="client_name" value={formData.client_name || ''} onChange={handleChange} sx={{ flexGrow: 1 }} required />
                    <FormControl sx={{ minWidth: 220 }}>
                        <InputLabel>事件の種類</InputLabel>
                        <Select name="case_type" value={formData.case_type || ''} label="事件の種類" onChange={handleSelectChange}>
                            <MenuItem value="ストレート破産">A. ストレート破産</MenuItem>
                            <MenuItem value="破産（管財人あり）">B. 破産（管財人あり）</MenuItem>
                            <MenuItem value="再生">C. 再生</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>担当弁護士</InputLabel>
                        <Select name="attorney_id" value={formData.attorney_id || ''} label="担当弁護士" onChange={handleSelectChange}>
                            <MenuItem value=""><em>未選択</em></MenuItem>
                            {lawyerList.map(lawyer => <MenuItem key={lawyer.attorney_id} value={lawyer.attorney_id}>{lawyer.attorney_name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField label="担当事務員" name="staff_name" value={formData.staff_name || ''} onChange={handleChange} />
                    <TextField label="受任日" type="date" name="date_received" value={dateToString(formData.date_received)} onChange={handleChange} InputLabelProps={{ shrink: true }} />
                </Box>
            </Box>

            <Typography variant="h6" gutterBottom>申立準備</Typography>
            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="事情聴き取り・不足書類案内" name="listening_documents_missing_guide" value={formData.listening_documents_missing_guide || ''} onChange={handleChange} fullWidth />
                <TextField label="不足書類欄" name="missing_documents_notes" value={formData.missing_documents_notes || ''} onChange={handleChange} fullWidth multiline rows={2} />
                <Box sx={{ width: '100%', mt: 1, p: 1, border: '1px solid #ddd', borderRadius: 1, background: highlightField === 'reminder_documents_dates' ? '#fff0f0' : 'transparent' }}>
                    <Typography variant="subtitle2">書類督促日 履歴</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <TextField type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} size="small" InputLabelProps={{ shrink: true }} sx={highlightField === 'reminder_documents_dates' ? highlightSx : {}}/>
                        <Button onClick={handleAddDueDate} variant="outlined" size="small" startIcon={<AddIcon />}>追加</Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {dueDates.map((dateStr) => (
                            <Chip key={dateStr} label={dateStr} onDelete={() => handleDeleteDueDate(dateStr)} deleteIcon={<DeleteIcon />} />
                        ))}
                    </Box>
                </Box>
            </Box>
            
            <Typography variant="h6" gutterBottom>申立後</Typography>
            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, mb: 2 }}>
              <FormControlLabel 
                control={
                  <Switch 
                    checked={formData.is_trustee_case || false} 
                    onChange={handleChange} 
                    name="is_trustee_case" 
                  />
                } 
                label="管財＆再生委員案件に移行"
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                <TextField label="開始前審尋" type="date" name="date_pre_hearing" value={dateToString(formData.date_pre_hearing)} onChange={handleChange} InputLabelProps={{ shrink: true }} />
                <TextField label="免責審尋日" type="date" name="date_exemption_hearing" value={dateToString(formData.date_exemption_hearing)} onChange={handleChange} InputLabelProps={{ shrink: true }} />
                <TextField label="履行テスト開始日" type="date" name="date_test_start" value={dateToString(formData.date_test_start)} onChange={handleChange} InputLabelProps={{ shrink: true }} />
                <TextField label="中間報告期限" type="date" name="date_midterm_report_deadline" value={dateToString(formData.date_midterm_report_deadline)} onChange={handleChange} InputLabelProps={{ shrink: true }} />
                <TextField label="認可決定日" type="date" name="date_approval_decision" value={dateToString(formData.date_approval_decision)} onChange={handleChange} InputLabelProps={{ shrink: true }} />
                <TextField label="履行テストの返金依頼日" type="date" name="date_test_refund_request" value={dateToString(formData.date_test_refund_request)} onChange={handleChange} InputLabelProps={{ shrink: true }} />
              </Box>
            </Box>

            <Typography variant="h6" gutterBottom>共通</Typography>
            <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1, mb: 2 }}>
              <TextField fullWidth multiline rows={3} label="備考" name="notes" value={formData.notes || ''} onChange={handleChange} />
            </Box>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button onClick={onClose}>キャンセル</Button>
              <Button type="submit" variant="contained" disabled={isSaving}>
                {isSaving ? <CircularProgress size={24} /> : '進捗を保存'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar open={snackbar?.open} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
        <Alert onClose={() => setSnackbar(null)} severity={snackbar?.severity || 'info'}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default CaseDetailForm;

