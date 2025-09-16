export async function login(username, password) {
  const res = await fetch('/users.json'); const data = await res.json();
  const u = data.users.find(u=>u.username===username && u.password===password);
  if (u) { const auth={username:u.username, role:u.role, name:u.name, ts:Date.now()};
    localStorage.setItem('kpi_auth', JSON.stringify(auth)); return {ok:true, user:auth}; }
  return {ok:false, error:'Sai tài khoản hoặc mật khẩu'};
}
export function logout(){ localStorage.removeItem('kpi_auth'); }
export function getAuth(){ try{ return JSON.parse(localStorage.getItem('kpi_auth')||'null'); }catch{return null;} }
