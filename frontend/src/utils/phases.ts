/** Phase accessor layer — single source for all phase-by-type lookups.
 *  NEVER use .find() or next() by seq/name directly.
 *  Use these functions so multi-phase projects are always handled correctly. */
import type { ProjectPhase } from '../types'
import { PHASE_SEQ as SEQ_MAP } from './phaseConfig'

export function phasesOfSeq(phases: ProjectPhase[], seq: number): ProjectPhase[] {
  return phases.filter((ph) => ph.seq === seq)
}

export function phasesOfName(phases: ProjectPhase[], name: string): ProjectPhase[] {
  const seq = SEQ_MAP[name]
  return seq ? phases.filter((ph) => ph.seq === seq) : []
}

export function anyPhaseOfSeq(phases: ProjectPhase[], seq: number, pred: (ph: ProjectPhase) => boolean): boolean {
  return phases.some((ph) => ph.seq === seq && pred(ph))
}

export function anyPhaseOfName(phases: ProjectPhase[], name: string, pred: (ph: ProjectPhase) => boolean): boolean {
  const seq = SEQ_MAP[name]
  return seq ? phases.some((ph) => ph.seq === seq && pred(ph)) : false
}

export function allPhasesOfSeq(phases: ProjectPhase[], seq: number, pred: (ph: ProjectPhase) => boolean): boolean {
  const ofType = phases.filter((ph) => ph.seq === seq)
  return ofType.length > 0 && ofType.every(pred)
}
