import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { applyTweaks, getTweaks } from '@/lib/tweaks'
import App from './App'

applyTweaks(getTweaks())
createRoot(document.getElementById('root')!).render(<StrictMode><TooltipProvider delayDuration={300}><App /></TooltipProvider></StrictMode>)
