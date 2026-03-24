import type { Dataset } from './types'

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch('/data/questions.json', { cache: 'no-cache' })
  if (!res.ok) throw new Error('Falha ao carregar questions.json')
  return res.json()
}