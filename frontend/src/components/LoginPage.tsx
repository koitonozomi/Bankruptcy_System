import React, { useState } from 'react';
// ★ 修正: インポートパスに拡張子 (.tsx) を追加
import { useAuth } from '../contexts/AuthContext.tsx';
import { Box, TextField, Button, Typography, Paper, Alert } from '@mui/material';

export const LoginPage: React.FC = () => {
  // ★ 修正: テストデータをデフォルト値として設定
  const [username, setUsername] = useState('attorney1');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      // AuthContextのlogin関数を呼び出す
      await login(username, password);
      // ログイン成功（App.tsx側で自動的に画面が切り替わる）
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f0f2f5',
      }}
    >
      <Paper
        elevation={6}
        sx={{
          padding: 4,
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
        }}
      >
        <Typography variant="h5" gutterBottom>
          アラートシステム ログイン
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="ユーザーID"
            variant="outlined"
            margin="normal"
            fullWidth
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="パスワード"
            type="password"
            variant="outlined"
            margin="normal"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
         　 fullWidth
            disabled={isLoading}
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};