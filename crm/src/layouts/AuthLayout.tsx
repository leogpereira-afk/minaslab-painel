import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f2f7f7] px-5 py-8 sm:px-6">
      <div aria-hidden="true" className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#08a99e]/[0.06] blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[#063f46]/[0.06] blur-3xl" />
      <div className="relative w-full max-w-[520px]">{children}</div>
    </main>
  )
}
