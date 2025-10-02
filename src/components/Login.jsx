import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { login } from '@/auth/localAuth.js';

export default function Login({ onLoggedIn, onCancel, variant = 'page' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    setError(null);
    const response = await login(username.trim(), password);
    setLoading(false);
    if (response.ok) {
      onLoggedIn?.(response.user);
    } else {
      setError(response.error || 'Không đăng nhập được');
    }
  };

  const form = (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Đăng nhập hệ thống KPI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm">Tài khoản</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Mật khẩu</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button onClick={handle} disabled={loading} className="w-full">
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onCancel?.()}
            disabled={loading}
          >
            Hủy
          </Button>
        )}
        <p className="text-xs text-gray-500">Liên hệ quản trị viên để được cấp tài khoản.</p>
      </CardContent>
    </Card>
  );

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md">{form}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      {form}
    </div>
  );
}
