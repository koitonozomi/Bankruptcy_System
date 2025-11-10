/**
 * このファイルは、バックエンドのデータベーススキーマに対応する型を定義します。
 * frontendとbackendの両方でこのファイルを同期してください。
 */

// =============================================================================
// テーブルに対応する型定義
// =============================================================================

/**
 * 担当弁護士の型
 * `attorneys` テーブルに対応
 */
export interface Attorney {
  attorney_id: number;
  attorney_name: string;
  email: string | null;
}

/**
 * アラート条件の型
 * `alert_conditions` テーブルに対応
 */
export interface AlertCondition {
  condition_id: number;
  trigger_event: string;
  target_column: string;
  threshold_days_red: number;
  threshold_days_yellow?: number | null; 
  condition_type: '赤' | '黄';
  is_active: boolean;
  related_field?: string;               
}

/**
 * 案件進捗データのメインの型
 * PostgreSQL の `cases_progress` テーブルに対応
 */
export interface CaseProgress {
  // ---------------------------------------------------------------------------
  // I. 基本情報
  // ---------------------------------------------------------------------------
  case_id: number;
  management_number: string | null;
  client_name: string;
  attorney_id: number | null;
  attorney_name?: string; // APIでのJOINによって付与される
  staff_name: string | null;
  delay_step_name?: string;
  delay_days?: number;      // 遅延している日数 (例: 3)
  case_type?: string;
  
  // ---------------------------------------------------------------------------
  // II. 日付関連
  // ---------------------------------------------------------------------------
  date_received: string | null;
  date_sent: string | null;
  deadline_date: string | null;
  date_document_arrival: string | null;
  date_creditor_list_complete: string | null;
  date_staff_assignment: string | null;
  date_first_greeting: string | null;
  date_filing: string | null;
  date_supplementary_deadline: string | null;
  date_pre_hearing: string | null;
  date_start_decision: string | null;
  date_exemption_hearing: string | null;
  date_exemption_decision: string | null;
  date_trustee_interview: string | null;
  date_creditor_meeting: string | null;
  date_commissioner_interview: string | null;
  date_test_start: string | null;
  date_midterm_report_deadline: string | null;
  date_plan_submission_deadline: string | null;
  date_approval_decision: string | null;
  date_final_confirmation: string | null;
  date_payment_confirm: string | null;
  date_payment_schedule_sent: string | null;
  date_test_refund_request: string | null;
  date_finished: string | null;

  // ---------------------------------------------------------------------------
  // III. テキスト・その他
  // ---------------------------------------------------------------------------
  letapa_number: string | null;
  listening_documents_missing_guide: string | null;
  missing_documents_notes: string | null;
  reminder_documents_dates: string[] | null; // JSONBは文字列配列として扱う
  extension_period: string | null;
  jurisdiction: string | null;
  case_number: string | null;
  notes: string | null;
  notes_document_sending: string | null;
  notes_preparation: string | null;
  notes_after_filing: string | null;
  
  // ---------------------------------------------------------------------------
  // IV. 管理フラグ
  // ---------------------------------------------------------------------------
  is_unanswered: boolean;
  is_trustee_case: boolean;
  alert_status: '赤' | '黄' | '黒' | null;
  last_notification_sent_at: string | null;
}

