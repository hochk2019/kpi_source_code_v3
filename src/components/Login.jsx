import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { login } from '@/auth/localAuth.js';
export default function Login({ onLoggedIn }){
  const [username,setUsername]=useState(''); const [password,setPassword]=useState('');
  const [error,setError]=useState(null); const [loading,setLoading]=useState(false);
  const handle=async()=>{ setLoading(true); setError(null);
    const r=await login(username.trim(), password); setLoading(false);
    if(r.ok) onLoggedIn(r.user); else setError(r.error||'Không đăng nhập được'); };
  return (<div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <Card className="w-full max-w-md"><CardHeader><CardTitle>Đăng nhập hệ thống KPI</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><label className="text-sm">Tài khoản</label>
          <Input value={username} onChange={e=>setUsername(e.target.value)} placeholder="admin" /></div>
        <div className="space-y-2"><label className="text-sm">Mật khẩu</label>
          <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" /></div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <Button onClick={handle} disabled={loading} className="w-full">{loading?'Đang đăng nhập...':'Đăng nhập'}</Button>
        <p className="text-xs text-gray-500">Dùng thử: admin/admin123 hoặc nhanvien/123456</p>
      </CardContent></Card></div>); }
