import React, { useState } from 'react';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button.tsx';
import { login } from '@/auth/localAuth.js';
import { t } from '@/lib/i18n.js';
import type { AuthAccountView } from '@/types';

interface LoginProps {
  onLoggedIn?: (user: AuthAccountView) => void;
  onCancel?: () => void;
  variant?: 'page' | 'modal';
}

export default function Login({ onLoggedIn, onCancel, variant = 'page' }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    setError(null);
    const response = await login(username.trim(), password);
    setLoading(false);
    if (response.ok) {
      onLoggedIn?.(response.user);
    } else {
      setError(response.error || t('login.error'));
    }
  };

  const form = (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('login.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-ds-text-primary">{t('login.username')}</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-ds-text-primary">{t('login.password')}</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
          />
        </div>
        {error && <div className="text-sm text-ds-destructive">{error}</div>}
        <Button
          onClick={handle}
          disabled={loading}
          className="w-full"
          data-tooltip="Gửi thông tin đăng nhập quản trị"
        >
          {loading ? t('login.submitting') : t('login.submit')}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onCancel?.()}
            disabled={loading}
            data-tooltip="Đóng hộp thoại và quay lại màn hình trước"
          >
            {t('login.cancel')}
          </Button>
        )}
        <p className="text-xs text-ds-text-muted">{t('login.contactAdmin')}</p>
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
    <div className="min-h-screen bg-ds-surface-base p-4 flex items-center justify-center">
      {form}
    </div>
  );
}
