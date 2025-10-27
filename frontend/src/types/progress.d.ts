/**
 * このファイルは、バックエンドのデータベーススキーマに対応する型を定義します。
 * フロントエンドの 'ProgressItem' とは異なり、DBのカラム名 (snake_case) とデータ型 (string | nullなど) に準拠します。
 */
/**
 * 案件進捗データのメインの型
 * PostgreSQL の `cases_progress` テーブルに対応
 */
export interface CaseProgress {
    /** 案件を一意に識別する自動採番ID */
    case_id: number;
    /** 管理番号 */
    management_number: string;
    /** 依頼者氏名 */
    client_name: string;
    /** 担当弁護士ID (attorneysテーブルの外部キー) */
    attorney_id: number;
    /** 担当弁護士名 (APIでJOINして付与) */
    attorney_name?: string;
    /** 担当事務員 */
    staff_name: string | null;
    /** 事件の種類 (破産, 再生など) */
    case_type: 'ストレート破産' | '破産（管財人あり）' | '再生' | null;
    /** 受任日 */
    date_received: string | null;
}
export interface CaseProgress {
    /** 担当振分日 */
    date_assignment: string | null;
    /** 初回挨拶日 */
    date_first_greeting: string | null;
    /** 事情聴取・不足書類案内日 */
    date_hearing_and_guide: string | null;
    /** 不足書類に関するメモ */
    missing_documents_notes: string | null;
    /** 書類督促日の履歴 (YYYY-MM-DD形式の日付文字列の配列) */
    reminder_documents_dates: string[] | null;
    /** 申立ての猶予期間 */
    extension_period: string | null;
}
export interface CaseProgress {
    /** 管轄裁判所 */
    jurisdiction: string | null;
    /** 申立日 */
    date_filing: string | null;
    /** 事件番号 */
    case_number: string | null;
    /** 追完期日 */
    date_supplementary_deadline: string | null;
    /** 開始決定日 (破産・再生共通) */
    date_start_decision: string | null;
}
export interface CaseProgress {
    /** 免責審尋日 */
    date_discharge_hearing: string | null;
    /** 免責決定日 */
    date_discharge_decision: string | null;
    /** 管財人面談日 */
    date_trustee_meeting: string | null;
    /** 債権者集会日 (複数回を想定しJSONB) */
    creditor_meeting_dates: string[] | null;
    /** 再生委員面談日 */
    date_commissioner_meeting: string | null;
    /** 履行テスト開始日 */
    date_performance_test_start: string | null;
    /** 中間報告期限 */
    date_interim_report_deadline: string | null;
    /** 再生計画案締切日 */
    date_plan_submission_deadline: string | null;
    /** 認可決定日 */
    date_approval_decision: string | null;
}
export interface CaseProgress {
    /** 認可決定の確定日 */
    date_final_confirmation: string | null;
    /** 各債権者への振込先を確認した日 */
    date_creditor_bank_info_confirmed: string | null;
    /** 債権者へ支払予定表を送付した日 */
    date_payment_schedule_sent: string | null;
    /** 履行テストで積み立てた金銭の返金を依頼した日 */
    date_performance_test_refund_requested: string | null;
}
export interface CaseProgress {
    /** 手続き終了日 */
    date_closed: string | null;
    /** 備考欄 */
    notes: string | null;
    /** 未対応フラグ (緊急対応が必要な案件) */
    is_unanswered: boolean;
    /** 管財・再生委員案件への移行フラグ */
    is_trustee_case: boolean;
    /** 現在のアラート状態 */
    alert_status: '赤' | '黄' | '緑' | '黒' | null;
}
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
    condition_type: '黄' | '赤';
    threshold_days: number;
    target_column: string;
    is_active: boolean;
}
//# sourceMappingURL=progress.d.ts.map