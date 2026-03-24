import { openDB } from 'idb'

export type Attempt = {
  qid: number
  correct: boolean
  selected?: string
  ts: number
  mode: string
  ms?: number
}

export type BestScore = {
  mode: string
  bestScore: number
  bestStreak: number
  bestDate: number
  details?: any
}

const DB_NAME = 'cert-trainer-db'
const DB_VERSION = 1

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('attempts')) {
      const s = db.createObjectStore('attempts', { keyPath: ['ts','qid','mode'] })
      s.createIndex('by_qid', 'qid')
      s.createIndex('by_mode', 'mode')
      s.createIndex('by_ts', 'ts')
    }
    if (!db.objectStoreNames.contains('bestScores')) {
      db.createObjectStore('bestScores', { keyPath: 'mode' })
    }
  }
})

export async function addAttempt(a: Attempt) {
  const db = await dbPromise
  await db.put('attempts', a)
}

export async function getAttempts() {
  const db = await dbPromise
  return db.getAll('attempts') as Promise<Attempt[]>
}

export async function getAttemptsByQid(qid: number) {
  const db = await dbPromise
  const idx = db.transaction('attempts').store.index('by_qid')
  return idx.getAll(qid) as Promise<Attempt[]>
}

export async function getBestScore(mode: string) {
  const db = await dbPromise
  return db.get('bestScores', mode) as Promise<BestScore | undefined>
}

export async function setBestScore(s: BestScore) {
  const db = await dbPromise
  await db.put('bestScores', s)
}

export async function getAllBestScores() {
  const db = await dbPromise
  return db.getAll('bestScores') as Promise<BestScore[]>
}

export async function resetAllProgress() {
  const db = await dbPromise
  await db.clear('attempts')
  await db.clear('bestScores')
}