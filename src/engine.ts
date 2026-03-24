import type { Dataset, Question, OptionKey, Domain } from './types'

export type SessionConfig = {
  mode: 'practice'|'exam'|'weakspots'|'flash'
  domainIds?: string[]
  count?: number
  examCount?: number
  domainWeights?: Record<string, number>
  weakspotQids?: number[]
}

export type SessionState = {
  questions: Question[]
  index: number
  score: number
  streak: number
  maxStreak: number
  correctCount: number
  startedAt: number
  finishedAt?: number
}

export function basePoints(q: Question): number {
  // MVP: use difficulty (1-5) if present, otherwise 3
  const d = Math.min(5, Math.max(1, q.difficulty ?? 3))
  return [0,10,20,35,55,80][d]
}

export function streakMultiplier(streak: number): number {
  // MVP: grows slowly and caps
  const capped = Math.min(streak, 10)
  return 1 + capped * 0.1 // up to 2.0x
}

export function pointsFor(q: Question, streak: number): number {
  return Math.round(basePoints(q) * streakMultiplier(streak))
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i=a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1))
    ;[a[i],a[j]]=[a[j],a[i]]
  }
  return a
}

export function buildSession(dataset: Dataset, cfg: SessionConfig): SessionState {
  const all = dataset.questions
  let pool: Question[] = all

  if (cfg.mode === 'practice' && cfg.domainIds && cfg.domainIds.length) {
    pool = all.filter(q => cfg.domainIds!.includes(q.domainId))
  }

  if (cfg.mode === 'weakspots' && cfg.weakspotQids && cfg.weakspotQids.length) {
    const set = new Set(cfg.weakspotQids)
    pool = all.filter(q => set.has(q.id))
  }

  if (cfg.mode === 'exam') {
    const n = cfg.examCount ?? dataset.meta.examQuestions
    // Weighted sampling by domain weights (best effort).
    // If weights missing, uniform by domain.
    const domains = dataset.domains
    const weightsById: Record<string, number> = {}
    for (const d of domains) {
      const w = d.weight ?? 1
      weightsById[d.id] = w
    }
    // Compute quota per domain
    const totalW = Object.values(weightsById).reduce((a,b)=>a+b,0)
    const quota: Record<string, number> = {}
    let allocated = 0
    for (const d of domains) {
      const q = Math.floor((weightsById[d.id] / totalW) * n)
      quota[d.id] = q
      allocated += q
    }
    // distribute remaining
    let rem = n - allocated
    const domIds = domains.map(d=>d.id)
    let k=0
    while (rem>0 && domIds.length) {
      quota[domIds[k % domIds.length]] += 1
      rem -= 1
      k += 1
    }
    const selected: Question[] = []
    for (const d of domains) {
      const candidates = shuffle(all.filter(q=>q.domainId===d.id))
      selected.push(...candidates.slice(0, quota[d.id]))
    }
    pool = shuffle(selected).slice(0, n)
  }

  // flash: all questions no repetition (optionally limited)
  const desired = cfg.count ?? (cfg.mode === 'flash' ? pool.length : 20)
  const chosen = shuffle(pool).slice(0, Math.min(desired, pool.length))

  return {
    questions: chosen,
    index: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    correctCount: 0,
    startedAt: Date.now()
  }
}

export function currentQuestion(state: SessionState): Question | null {
  return state.index < state.questions.length ? state.questions[state.index] : null
}

export function answer(state: SessionState, selected: OptionKey): { correct: boolean; earned: number } {
  const q = currentQuestion(state)
  if (!q) return { correct: false, earned: 0 }
  const ok = selected === q.correct
  if (ok) {
    state.streak += 1
    state.correctCount += 1
  } else {
    state.streak = 0
  }
  state.maxStreak = Math.max(state.maxStreak, state.streak)
  const earned = ok ? pointsFor(q, state.streak) : 0
  state.score += earned
  return { correct: ok, earned }
}

export function next(state: SessionState) {
  state.index += 1
  if (state.index >= state.questions.length) {
    state.finishedAt = Date.now()
  }
}