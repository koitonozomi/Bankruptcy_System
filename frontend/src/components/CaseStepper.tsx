import React from 'react';
import { Stepper, Step, StepLabel, Box, Typography } from '@mui/material'; 
import type { StepIconProps } from '@mui/material'; 
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleIcon from '@mui/icons-material/Circle';
// 適切な型定義をインポート
import type { CaseProgress } from '../types/progress' 

// ステップの定義
export const STEPS = [
  { label: '受託', key: 'date_received' }, // ClientTable.受託日
  { label: '書類収集', key: 'date_document_arrival' }, // HasanSaiseiTable.書類到着日
  { label: '一覧表作成', key: 'date_creditor_list_complete' }, // HasanSaiseiTable.債権者一覧作成完了日
  { label: '初回挨拶/聴取', key: 'date_first_greeting' }, // HasanSaiseiTable.初回挨拶日
  { label: '申立完了', key: 'date_filing' }, // HasanSaiseiTable.申立日
  { label: '開始決定', key: 'date_start_decision' }, // HasanSaiseiTable.開始決定日
  { label: '認可/免責', key: ['date_exemption_decision', 'date_approval_decision'] }, 
  { label: '確定', key: 'date_finalized' }, // 現状マッピングなしだが、そのまま残す
  { label: '終了', key: 'date_finished' }, // ClientTable.完了日
] as const;


/**
 * 値が有効な日付（完了）とみなせるか判定します。
 * (null, undefined, "", " ", "0000-00-00" などを「未実施」として扱います)
*/
export const isValidDateValue = (value: any): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  
  // 文字列に変換し、前後の空白を除去
  const valueStr = String(value).trim();
  
  // 空文字列 または "0000-00-00" だったら未実施 (false)
  if (valueStr === '' || valueStr === '0000-00-00') {
    return false;
  }
  
  // それ以外は有効な値（実施済み）とみなす
  return true;
};

// ステップの状態を判定
// ★★★ ロジックを大幅に修正 ★★★
export const getActiveStep = (item: CaseProgress): number => {
  
  // ★ 修正点: 
  // ステップを「前から」順番にチェックする。
  // どのステップまで完了したか（インデックス）を保持する
  let activeStep = 0; 

  // STEPS定義（0:受託, 1:書類収集 ... 8:終了）
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const keys = Array.isArray(step.key) ? step.key : [step.key];
    
    const isStepCompleted = keys.some(key => {
        const value = item[key as keyof CaseProgress];
        return isValidDateValue(value);
    });

    if (!isStepCompleted) {
      // ★★★ このステップ(i)が完了していなかったら ★★★
      // activeStep は「iの手前」(= activeStep の現在の値) で確定し、ループを抜ける
      break;
    }
    
    // このステップ (i) が完了していたら
    // activeStep を (i + 1) に更新し、次のステップ (i+1) をチェックしにいく
    activeStep = i + 1;
  }

  // ループが最後まで回った場合、activeStep は STEPS.length (9) になる
  // ループが途中で止まった場合（例：書類収集が未完了）、activeStep は 1 (受託まで完了) になる
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
        {STEPS.map((step, index) => { // index を追加
            // ステップが完了済みか
            const isCompleted = index < activeStep; 
            const keys = Array.isArray(step.key) ? step.key : [step.key];

            // 完了日を決定（複数のキーがある場合は、最初に見つかった日付を使用）
            let completionDate = '';
            for (const key of keys) {
                const date = item[key as keyof CaseProgress];
                
                // ★ 修正点: ここでも isValidDateValue を使う
                if (isValidDateValue(date)) {
                    // YYYY-MM-DD 形式から MM/DD に変換（例: 2025-10-21 -> 10/21）
                    // String() で安全に文字列化
                    completionDate = String(date).split('-').slice(1).join('/'); 
                    break;
                }
            }

            return (
              <Step key={step.label} completed={isCompleted}>
                <StepLabel StepIconComponent={StatusIcon}>
                  {step.label}
                {/* ★ 修正点: 不要な '_' を削除 */}
                </StepLabel>
                {/* ★ 完了日が取得できたら、ステップラベルの下に表示 */}
                {isCompleted && completionDate && (
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