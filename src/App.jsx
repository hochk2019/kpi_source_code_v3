import React, { useEffect, useState } from 'react'
import KPICalculator from './components/KPICalculator.jsx'
import Login from './components/Login.jsx'
import { getAuth, logout } from './auth/localAuth.js'
import './App.css'
export default function App(){
  const [auth,setAuth]=useState(null)
  useEffect(()=>{ setAuth(getAuth()) },[])
  if(!auth) return <Login onLoggedIn={setAuth} />
  return (<div className="min-h-screen bg-gray-50">
    <div className="flex justify-between items-center p-3 border-b bg-white">
      <div className="text-sm">Xin chào, <b>{auth.name}</b> ({auth.role})</div>
      <button onClick={()=>{logout();setAuth(null)}} className="text-sm underline">Đăng xuất</button>
    </div>
    <KPICalculator role={auth.role} />
  </div>)
}
