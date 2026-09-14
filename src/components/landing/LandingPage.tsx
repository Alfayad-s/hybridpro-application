'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Outfit, DM_Sans } from 'next/font/google'
import { AnimatePresence, motion } from 'framer-motion'
import { NoiseBackground } from '@/components/ui/noise-background'
import PillNav from '@/components/landing/PillNav'
import StrokeText from '@/components/landing/StrokeText'
import ParticleText from '@/components/ParticleText'
import { cn } from '@/lib/utils'

const display = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-landing-display',
})

const body = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-landing-body',
})

const HERO_IMAGES = [
  { src: '/landing/1.jpg', alt: 'Athlete curling a dumbbell' },
  { src: '/landing/2.jpg', alt: 'Athlete training with dumbbells in the gym' },
  { src: '/landing/3.jpg', alt: 'Athlete mid workout' },
  { src: '/landing/4.jpg', alt: 'Athlete standing in a power rack' },
] as const

const SLIDE_MS = 4500

function displayFont() {
  return { fontFamily: 'var(--font-landing-display), sans-serif' } as const
}

function HeroSlideshow() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % HERO_IMAGES.length)
    }, SLIDE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="relative h-full min-h-[42dvh] w-full overflow-hidden rounded-[24px] md:min-h-0 md:rounded-[28px]">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={HERO_IMAGES[index].src}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image
            src={HERO_IMAGES[index].src}
            alt={HERO_IMAGES[index].alt}
            fill
            priority={index === 0}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-center"
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0">
        {HERO_IMAGES.map((img, i) => (
          <button
            key={img.src}
            type="button"
            aria-label={`Show image ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
              i === index ? 'w-6 bg-primary' : 'w-1.5 bg-white/45 hover:bg-white/70'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} relative flex min-h-dvh flex-col overflow-x-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground md:p-4`}
      style={{ fontFamily: 'var(--font-landing-body), system-ui, sans-serif' }}
    >
      <PillNav
        logo="/company-logo.png"
        logoAlt="Hybrid Pro"
        items={[
          { label: 'Home', href: '/' },
          { label: 'Sign in', href: '/login' },
        ]}
        activeHref="/"
        ease="power2.easeOut"
        baseColor="#8BB820"
        pillColor="#0B0B0F"
        pillTextColor="#F4F4F5"
        hoveredPillTextColor="#0B0B0F"
        initialLoadAnimation
      />

      <div
        className="relative z-10 w-full shrink-0"
        style={{
          marginTop: 'max(3.5rem, calc(env(safe-area-inset-top) + 2.5rem))',
          fontFamily: 'var(--font-landing-display), sans-serif',
        }}
      >
        <div className="h-[6.25rem] w-full sm:h-[7.25rem] md:h-[8.5rem]">
          <ParticleText
            text="HYBRID PRO"
            color="#F8FAFC"
            highlightColor="#8BB820"
            particleSize={2.8}
            density={3}
            scatter={160}
            gatherDuration={1600}
            stagger={360}
            idleDrift={0.7}
            pointerRepel={40}
            repelRadius={110}
            trigger="mount"
            fontSize="clamp(2.6rem, 16vw, 5.5rem)"
            fontWeight={800}
            fontFamily="inherit"
            glow
            className="h-full"
          />
        </div>
      </div>

      {/* Split hero under floating pill nav */}
      <section className="relative grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 md:w-1/2"
          style={{
            background:
              'radial-gradient(90% 60% at 0% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 55%), linear-gradient(180deg, var(--background) 0%, var(--background) 100%)',
          }}
        />

        {/* Left — content */}
        <div className="order-2 flex flex-col justify-center px-5 pb-10 pt-5 md:order-1 md:px-10 md:pb-12 md:pt-10 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-xl md:mx-0">
            <h1 className="sr-only">Hybrid Pro — Train with clarity</h1>
            <StrokeText
              text="Train with clarity."
              strokeColor="#8BB820"
              fillColor="#F8FAFC"
              strokeWidth={1.6}
              drawDuration={1.5}
              fillDelay={0.15}
              stagger={0.04}
              ease="power2.out"
              trigger="mount"
              fillMode="wipe"
              fontSize={96}
              fontWeight={800}
              letterSpacing={-3}
              className="max-w-full"
              style={{ maxWidth: '100%' }}
            />
            <p
              className="mt-5 max-w-[28ch] text-xl font-medium leading-snug tracking-tight text-foreground/90 md:mt-7 md:max-w-[32ch] md:text-2xl lg:text-[1.75rem]"
              style={displayFont()}
            >
              Know what you lifted, what you ate, and what still needs rest — then decide what comes
              next.
            </p>
            <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-muted-foreground md:mt-5 md:text-base">
              Hybrid Pro keeps workouts, meals, recovery, and coaching in one place so consistency
              feels obvious, not overwhelming.
            </p>

            <div className="mt-8 md:mt-10">
              <NoiseBackground
                containerClassName="w-fit rounded-full p-1.5 mx-0"
                gradientColors={[
                  'rgb(139, 184, 32)',
                  'rgb(160, 208, 40)',
                  'rgb(94, 234, 212)',
                ]}
                noiseIntensity={0.18}
              >
                <Link
                  href="/login"
                  className="inline-flex h-12 w-full min-w-[200px] cursor-pointer items-center justify-center rounded-full bg-linear-to-r from-neutral-100 via-neutral-100 to-white px-7 text-[15px] font-bold text-black shadow-[0px_2px_0px_0px_var(--color-neutral-50)_inset,0px_0.5px_1px_0px_var(--color-neutral-400)] transition-all duration-100 active:scale-98 dark:from-black dark:via-black dark:to-neutral-900 dark:text-white dark:shadow-[0px_1px_0px_0px_var(--color-neutral-950)_inset,0px_1px_0px_0px_var(--color-neutral-800)] md:h-[52px] md:min-w-[240px] md:px-9"
                >
                  Start training →
                </Link>
              </NoiseBackground>
            </div>
          </div>
        </div>

        {/* Right — rounded image panel */}
        <div className="relative order-1 min-h-[34dvh] md:order-2 md:min-h-0 md:h-auto">
          <HeroSlideshow />
        </div>
      </section>
    </div>
  )
}
