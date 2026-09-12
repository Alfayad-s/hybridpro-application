import Image from 'next/image'
import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

type BrandLogoProps = {
  size?: number
  className?: string
  priority?: boolean
}

export function BrandLogo({ size = 64, className, priority }: BrandLogoProps) {
  return (
    <Image
      src={BRAND.logo}
      alt={BRAND.name}
      width={size}
      height={size}
      priority={priority}
      className={cn('rounded-[18px]', className)}
    />
  )
}
