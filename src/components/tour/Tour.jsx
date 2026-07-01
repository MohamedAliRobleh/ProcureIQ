import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTour } from './TourProvider'
import { TOUR_STEPS } from './tourSteps'

// Measure a target element's viewport rect, or null for a centered step / a
// missing target. Recomputes on step change, resize, and scroll.
function useTargetRect(selector) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }
    function measure() {
      const el = document.querySelector(selector)
      if (!el) {
        setRect(null)
        return
      }
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [selector])
  return rect
}

function tooltipStyle(rect, placement) {
  if (!rect || placement === 'center') {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const gap = 12
  if (placement === 'right') return { top: rect.top, left: rect.left + rect.width + gap }
  if (placement === 'bottom') return { top: rect.top + rect.height + gap, left: rect.left }
  if (placement === 'top') return { top: Math.max(gap, rect.top - 180), left: rect.left }
  return { top: rect.top, left: rect.left }
}

export default function Tour() {
  const { isOpen, stepIndex, next, back, close } = useTour()
  const step = TOUR_STEPS[stepIndex]
  const rect = useTargetRect(step?.target ?? null)
  if (!isOpen || !step) return null

  const isLast = stepIndex === TOUR_STEPS.length - 1

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Spotlight: a box-shadow cutout around the target, or a plain dim for centered steps. */}
        {rect ? (
          <motion.div
            className="pointer-events-none absolute rounded-lg"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              outline: '2px solid rgba(96,165,250,0.9)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        ) : (
          <div className="absolute inset-0 bg-black/60" />
        )}

        {/* Tooltip card */}
        <motion.div
          className="absolute z-10 w-80 max-w-[90vw] rounded-2xl border border-border-accent bg-bg-card p-5 shadow-2xl"
          style={tooltipStyle(rect, step.placement)}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
        >
          <p className="text-xs font-medium text-accent-blue-light">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </p>
          <h3 className="mt-1 font-display text-base font-semibold text-text-primary">{step.title}</h3>
          <p className="mt-2 text-sm text-text-secondary">{step.body}</p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button onClick={close} className="text-xs text-text-muted hover:text-text-secondary">
              Skip
            </button>
            <div className="flex gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={back}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover"
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="rounded-lg bg-gradient-blue px-3 py-1.5 text-sm font-medium text-white hover:scale-[1.02]"
              >
                {isLast ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
