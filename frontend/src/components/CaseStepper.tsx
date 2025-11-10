import React from 'react';
import { Stepper, Step, StepLabel, Box, Typography } from '@mui/material'; 
import type { StepIconProps } from '@mui/material'; 
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleIcon from '@mui/icons-material/Circle';
// 適切な型定義をインポート
import type { CaseProgress } from '../types/progress' 

// =============================================================================
// ★★★ ステップの定義 (変更なし) ★★★
// =============================================================================
export const STEPS = [
  { label: '受託', key: 'date_received' },
  { label: '書類到着', key: 'date_document_arrival' },
  { label: '一覧作成', key: 'date_creditor_list_complete' },
  { label: '初回挨拶', key: 'date_first_greeting' },
  { label: '申立日', key: 'date_filing' }, 
  { label: '追完期日', key: 'date_supplementary_deadline' },
  { label: '財産目録・報告書提出', key: 'date_midterm_report_deadline' }, 
  { label: '再生計画案締切日', key: 'date_plan_submission_deadline' },
  { label: '認可確定', key: 'date_approval_decision' }, 
] as const;
// =============================================================================


/**
* 値が有効な日付（完了）とみなせるか判定します。(変更なし)
*/
export const isValidDateValue = (value: any): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  
  const valueStr = String(value).trim();
  if (valueStr === '' || valueStr === '0000-00-00') {
    return false;
  }
  return true;
};

// =============================================================================
// ★★★ ステップの状態を判定 (ロジック修正) ★★★
// =============================================================================
export const getActiveStep = (item: CaseProgress): number => {

// ★ 修正: 「最初の未完了」ではなく、「最後の完了」ステップを探す
  let lastCompletedIndex = -1; // まだ何も完了していない場合の初期値

// STEPS定義をループ
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const keys = Array.isArray(step.key) ? step.key : [step.key];
    
    const isStepCompleted = keys.some(key => {
      const value = item[key as keyof CaseProgress];
      return isValidDateValue(value);
    });
    
    if (isStepCompleted) {
// ★ このステップ(i)が完了していたら、
//    「最後の完了ステップ」のインデックスを(i)に更新する
    lastCompletedIndex = i;
  } 
// ★ 途中で break しない (最後までチェックする)
}

// ★ 最後の完了ステップ (例: 申立日/index 4) の「次」 (index 5) を
//    現在地 (activeStep) とする
  const activeStep = lastCompletedIndex + 1;
  
  // (例: 申立日(4)まで完了 -> 5 を返す)
  // (例: すべて未完了 -> -1 + 1 = 0 を返す)
  // (例: すべて完了 -> 8 + 1 = 9 を返す)
  return activeStep;
};
// =============================================================================


// カスタムアイコン (変更なし)
const StatusIcon = (props: StepIconProps) => {
  const { active, completed } = props;
  if (completed) return <CheckCircleIcon color="success" />;
  if (active) return <CircleIcon color="primary" />;
  return <CircleIcon color="disabled" />;
};

// =============================================================================
// ★★★ CaseStepper コンポーネント (ロジックは変更なし) ★★★
// =============================================================================
const CaseStepper: React.FC<{ item: CaseProgress }> = ({ item }) => {
// getActiveStep が「現在地」(青丸)のインデックスを返す (ロジック変更済)
const activeStepIndex = getActiveStep(item);

return (
<Box sx={{ width: '100%', py: 2, px: 1 }}>
  <Stepper activeStep={-1} alternativeLabel>
     {STEPS.map((step, index) => {
      const keys = Array.isArray(step.key) ? step.key : [step.key];

            // 完了（緑チェック）判定 (日付が入っていればOK)
            const isIndependentlyCompleted = keys.some(key => {
                const value = item[key as keyof CaseProgress];
                return isValidDateValue(value);
            });

            // 現在地（青丸）判定
            // (getActiveStep が返したインデックスと一致し、かつ、
            //  そのステップ自体が未完了であること)
            const isActive = (index === activeStepIndex) && !isIndependentlyCompleted;

            // 完了日を決定
            let completionDate = '';
            for (const key of keys) {
                const date = item[key as keyof CaseProgress];
                if (isValidDateValue(date)) {
                    completionDate = String(date).split('-').slice(1).join('/'); 
                    break;
                }
            }

            return (
              <Step key={step.label} completed={isIndependentlyCompleted}>
                <StepLabel 
                  StepIconComponent={(props) => (
                    <StatusIcon 
                      {...props} 
                      active={isActive} 
                      completed={isIndependentlyCompleted} 
 />
                  )}
                >
  {step.label}
                </StepLabel>
                
                {isIndependentlyCompleted && completionDate && (
                    <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ textAlign: 'center', mt: 0.5, display: 'block', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                    >
                        {completionDate}
                    </Typography>
                )}
              </Step>
);
        })}
      </Stepper>
    </Box>
  );
};

export default CaseStepper;