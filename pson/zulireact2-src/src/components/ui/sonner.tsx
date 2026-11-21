// @ts-nocheck
/* shadcn-style Sonner toaster (no next-themes: follows the html.dark class). Bottom-right, fixed. */
import { useEffect, useState } from 'react'
import { Toaster as Sonner } from 'sonner'
import { CircleCheck, Info, TriangleAlert, OctagonX, LoaderCircle } from 'lucide-react'
import { useTweaks } from '@/lib/tweaks'
export function Toaster() {
  const [tw] = useTweaks()
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  useEffect(() => { const o = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark'))); o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); return () => o.disconnect() }, [])
  return <Sonner theme={dark ? 'dark' : 'light'} position="bottom-right" richColors={tw.toastStyle === 'rich'} duration={+tw.toastDur * 1000} closeButton={false} className="toaster group"
    icons={{ success: <CircleCheck className="size-4" />, info: <Info className="size-4" />, warning: <TriangleAlert className="size-4" />, error: <OctagonX className="size-4" />, loading: <LoaderCircle className="size-4 animate-spin" /> }}
    style={{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)', '--border-radius': 'var(--radius)' }}
    toastOptions={{ classNames: { toast: 'font-sans text-sm', description: 'text-muted-foreground' } }} />
}
