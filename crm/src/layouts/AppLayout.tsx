import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [open, setOpen] = useState(false)
  return <div className="min-h-screen bg-slate-50">
    <Sidebar open={open} onClose={()=>setOpen(value=>!value)}/>
    <main className="p-4 sm:p-5 lg:p-8"><Outlet/></main>
  </div>
}
