'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, Scale, Moon, Download, Smartphone } from 'lucide-react'
import { useProfileStore } from '@/stores/profileStore'
import { useThemeStore } from '@/stores/themeStore'
import { useInstallPrompt } from '@/components/pwa/InstallPrompt'
import { ActivePlanCard } from '@/components/profile/ActivePlanCard'
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '@/lib/notifications'

export default function SettingsPage() {
  const router = useRouter()
  const { weightUnit, setWeightUnit } = useProfileStore()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt()
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default')
  const [notifBusy, setNotifBusy] = useState(false)
  useEffect(() => {
    setNotifPermission(getNotificationPermission())
  }, [])

  const handleEnableNotifications = async () => {
    setNotifBusy(true)
    const result = await requestNotificationPermission()
    setNotifPermission(result)
    setNotifBusy(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Settings</h1>
      </div>

      <div className="space-y-4">
        <ActivePlanCard />

        {/* Weight Unit */}
        <div className="bg-card border border-border rounded-[24px] p-5 flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              Weight Unit
            </span>
            <p className="text-[10px] text-muted-foreground">Prefer metric or imperial logs</p>
          </div>
          <div className="flex bg-secondary p-1 rounded-xl border border-border">
            <button
              onClick={() => setWeightUnit('kg')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                weightUnit === 'kg' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              kg
            </button>
            <button
              onClick={() => setWeightUnit('lbs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                weightUnit === 'lbs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              lbs
            </button>
          </div>
        </div>

        {/* Dark Theme */}
        <div className="bg-card border border-border rounded-[24px] p-5 flex justify-between items-center">
          <div className="space-y-0.5">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Moon className="w-4 h-4 text-muted-foreground" />
              Dark Mode
            </span>
            <p className="text-[10px] text-muted-foreground">Toggle default interface theme</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
              isDark ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-card transition-transform ${
                isDark ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Rest notifications */}
        <div className="bg-card border border-border rounded-[24px] p-5 flex justify-between items-center gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Rest Notifications
            </span>
            <p className="text-[10px] text-muted-foreground">
              {notifPermission === 'granted'
                ? 'Alerts when rest timer finishes'
                : notifPermission === 'denied'
                  ? 'Blocked — enable in browser settings'
                  : notifPermission === 'unsupported'
                    ? 'Not supported on this device'
                    : 'Get alerted when rest is over'}
            </p>
          </div>
          {notifPermission === 'granted' ? (
            <span className="text-[10px] font-bold text-primary shrink-0">On</span>
          ) : notifPermission !== 'unsupported' && notifPermission !== 'denied' ? (
            <button
              type="button"
              disabled={notifBusy}
              onClick={handleEnableNotifications}
              className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold cursor-pointer active:scale-95 disabled:opacity-60 shrink-0"
            >
              Enable
            </button>
          ) : null}
        </div>

        {/* Install app */}
        <div className="bg-card border border-border rounded-[24px] p-5 flex justify-between items-center gap-3">
          <div className="space-y-0.5 min-w-0">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              Install App
            </span>
            <p className="text-[10px] text-muted-foreground">
              {isStandalone
                ? 'Running as installed app'
                : canInstall
                  ? 'Add Hybrid Pro to your home screen'
                  : 'Use browser menu → Add to Home Screen'}
            </p>
          </div>
          {canInstall && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
          )}
          {isStandalone && (
            <span className="text-[10px] font-bold text-primary shrink-0">Installed</span>
          )}
        </div>
      </div>
    </div>
  )
}
