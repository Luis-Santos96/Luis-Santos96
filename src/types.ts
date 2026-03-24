export type OptionKey = 'A'|'B'|'C'|'D'|'E'|'F'

export type Domain = {
  number: number
  name: string
  id: string
  weight?: number
}

export type Question = {
  id: number
  domainId: string
  domainName: string
  text: string
  options: Record<OptionKey, string>
  correct: OptionKey
  explanation?: string | null
  difficulty?: number
}

export type Dataset = {
  meta: {
    title: string
    questionCount: number
    examQuestions: number
    examMinutes: number
    domainWeights: Record<string, number>
  }
  domains: Domain[]
  questions: Question[]
}

export type Mode = 'home'|'practice'|'exam'|'weakspots'|'flash'|'leaderboard'