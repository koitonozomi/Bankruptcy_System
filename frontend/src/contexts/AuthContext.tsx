import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// APIのベースURL (Viteがes2015ターゲットでも動作するようにハードコード)
const API_BASE_URL = 'http://localhost:50000';

// ユーザー情報の型定義
interface User {
  id: number;
  username: string; // 'username' が必ず存在することを確認
  role: 'attorney' | 'staff' | 'admin'; 
  attorneyId?: number;
}

// Contextの型定義
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

// Contextの作成（型エラーを避けるためnullで初期化）
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * アプリ全体で認証情報（ユーザー、ログイン、ログアウト機能）を提供します。
 */
const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return null;
    
    try {
      const parsedUser = JSON.parse(storedUser) as User;
// ★ デバッグ: 起動時にlocalStorageから読み込んだユーザー情報を確認
console.log('[AuthContext] Loaded user from localStorage:', parsedUser);
      
      // ユーザー名とロールがlocalStorageに正しく保存されているか確認
      if (parsedUser && parsedUser.username && parsedUser.role) {
        return parsedUser;
      }
    } catch (e) {
      console.error('[AuthContext] Failed to parse user from localStorage', e);
    }
    // パース失敗時やデータが不完全な場合は、ストレージをクリア
    localStorage.removeItem('user');
    return null;
  });

  /**
   * ログインを実行し、サーバーからユーザー情報を取得して保存します。
   */
  // ★ 修正: 引数に string 型を明示的に指定
  const login = async (username: string, password: string) => {
    console.log('[AuthContext] Attempting login...');
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json(); // data は { success: true, user: {...} } 形式

    if (response.ok) {
      // ★ デバッグ: サーバーから返されたユーザー情報を確認
      console.log('[AuthContext] Login successful. Server data:', data);
      
      // ★★★ 修正点 2: data.user から正しくプロパティを読み込む ★★★
      // サーバーからのデータがUser型に準拠しているか確認
      const userData: User = {
        id: data.user.id,
        username: data.user.username, // サーバーからの username を明示的にセット
        role: data.user.role,
        attorneyId: data.user.attorneyId,
      };

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      console.log('[AuthContext] User set in state and localStorage:', userData);
} else {
      console.error('[AuthContext] Login failed:', data.error);
      throw new Error(data.error || 'ログインに失敗しました');
    }
  };

  /**
   * ログアウトを実行し、ユーザー情報をクリアします。
   */
  const logout = () => {
    console.log('[AuthContext] Logging out.');
    setUser(null);
    localStorage.removeItem('user');
  };

  // Contextに渡す値
  const value = { user, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 認証Context（user, login, logout）を使用するためのカスタムフック。
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  // context = { user, login, logout }
  return context;
};

// ★★★ 修正点 3: AuthProvider をデフォルトエクスポートに追加 ★★★
export { AuthProvider };
export default AuthProvider;