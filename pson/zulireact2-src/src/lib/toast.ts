// @ts-nocheck
/* Toast helpers (Sonner, MIT). Style/duration/undo come from the experimental settings. */
import { toast } from 'sonner'
import { getTweaks } from './tweaks'
const icon = () => getTweaks().toastStyle !== 'minimal'
export function note(msg, o: any = {}) {
  const t = getTweaks()
  const opts: any = { description: o.description, duration: +t.toastDur * 1000 }
  if (o.action) opts.action = o.action
  return o.kind === 'success' && icon() ? toast.success(msg, opts) : toast(msg, opts)
}
export { toast }
