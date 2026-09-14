'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function MobileContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLanding = pathname === '/'

  return (
    <div
      className={cn(
        'iphone-shell mx-auto bg-background text-foreground relative flex h-full min-h-0 flex-col overflow-hidden scrollbar-hide',
        !isLanding && 'sm:max-w-[430px] sm:border-x sm:border-border sm:shadow-2xl'
      )}
    >
      {children}
    </div>
  )
}
