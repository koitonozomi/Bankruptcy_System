import React from 'react';
import { Stepper, Step, StepLabel, Box } from '@mui/material'; 
import type { StepIconProps } from '@mui/material'; 
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleIcon from '@mui/icons-material/Circle';
import type { CaseProgress, Attorney } from '../types/progress'

// ステップの定義
const STEPS = [
  { label: '書類収集', key: '書類到着日' }, 
  { label: '一覧表作成', key: '債権者一覧表作成完了日' },
  { label: '初回挨拶/聴取', key: '初回挨拶日' },
  { label: '申立完了', key: '申立日' },
  { label: '開始決定', key: '開始決定日' },
  { label: '認可/免責', key: ['認可日', '免責決定日'] }, // どちらかがあればOK
  { label: '確定', key: '確定日' },
  // ★ 修正点: '終了' -> '終了日' にキーを修正
  { label: '終了', key: '終了日' },
] as const;

// ステップの状態を判定
const getActiveStep = (item: CaseProgress): number => {
  // ★ 修正点: item.終了 -> item.終了日
  if (item.終了日) return STEPS.length; 

  let activeStep = -1;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const step = STEPS[i];
    const keys = Array.isArray(step.key) ? step.key : [step.key];
    
    // key配列のいずれかがitemに存在すれば、そのステップをアクティブと見なす
    const isStepCompleted = keys.some(key => item[key as keyof CaseProgress]);

    if (isStepCompleted) {
      activeStep = i + 1;
      break;
    }
  }
  return activeStep;
};

// カスタムアイコン
const StatusIcon = (props: StepIconProps) => {
  const { active, completed } = props;
  if (completed) return <CheckCircleIcon color="success" />;
  if (active) return <CircleIcon color="primary" />;
  return <CircleIcon color="disabled" />;
};

const CaseStepper: React.FC<{ item: CaseProgress }> = ({ item }) => {
  const activeStep = getActiveStep(item);
  
  return (
    <Box sx={{ width: '100%', py: 2, px: 1 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {STEPS.map((step) => (
          <Step key={step.label}>
            <StepLabel StepIconComponent={StatusIcon}>
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};

export default CaseStepper;
