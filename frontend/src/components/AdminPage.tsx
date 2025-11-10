// AdminPage.tsx
import React from 'react';

interface AdminPageProps {
  onClose: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onClose }) => {
  return (
    <div>
      <h2>管理者ページ ※今後順次アップデート予定です</h2>
      <button onClick={onClose}>戻る</button>
      {/* 他の内容 */}
    </div>
  );
};

export default AdminPage;
