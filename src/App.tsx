import React, { useEffect, useMemo, useState } from 'react'
import type { Dataset, Mode, Question, OptionKey } from './types'
import { loadDataset } from './data'
import { buildSession, currentQuestion, answer as doAnswer, next as doNext, type SessionState } from './engine'
import { addAttempt, getAllBestScores, getAttempts, getBestScore, setBestScore, resetAllProgress } from './storage'

type View = { mode: Mode }

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="btn" {...props} />
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [view, setView] = useState<View>({ mode: 'home' })
  const [session, setSession] = useState<SessionState | null>(null)
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState<number>(20)
  const [showExplanation, setShowExplanation] = useState<boolean>(true)
  const [feedback, setFeedback] = useState<{selected?: OptionKey, correct?: boolean, earned?: number} | null>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [weakspotIds, setWeakspotIds] = useState<number[]>([])

  useEffect(() => {
    loadDataset().then(setDataset).catch(err => {
      console.error(err)
      alert('Erro a carregar dataset. Vê a consola.')
    })
  }, [])

  useEffect(() => {
    if (view.mode === 'leaderboard') {
      getAllBestScores().then(setLeaderboard)
    }
  }, [view.mode])

  useEffect(() => {
    // compute weak spots (top 40 by wrong rate, min 2 attempts)
    async function computeWeak() {
      if (!dataset) return
      const attempts = await getAttempts()
      const byQ: Record<number, {t:number,w:number}> = {}
      for (const a of attempts) {
        const e = byQ[a.qid] ?? {t:0,w:0}
        e.t += 1
        if (!a.correct) e.w += 1
        byQ[a.qid] = e
      }
      const scored = Object.entries(byQ)
        .filter(([,v]) => v.t >= 2)
        .map(([qid,v]) => ({ qid: Number(qid), rate: v.w / v.t, t: v.t }))
        .sort((a,b) => b.rate - a.rate)
        .slice(0, 40)
        .map(x => x.qid)
      setWeakspotIds(scored)
    }
    computeWeak()
  }, [dataset, view.mode])

  const title = dataset?.meta.title ?? 'Gamified Cert Trainer'

  function startPractice() {
    if (!dataset) return
    const cfg = { mode: 'practice' as const, domainIds: selectedDomains.length? selectedDomains : dataset.domains.map(d=>d.id), count: questionCount }
    const s = buildSession(dataset, cfg)
    setSession(s)
    setFeedback(null)
    setView({ mode: 'practice' })
  }

  function startExam() {
    if (!dataset) return
    const cfg = { mode: 'exam' as const, examCount: dataset.meta.examQuestions }
    const s = buildSession(dataset, cfg)
    setSession(s)
    setFeedback(null)
    setView({ mode: 'exam' })
  }

  function startFlash() {
    if (!dataset) return
    const cfg = { mode: 'flash' as const, count: dataset.questions.length }
    const s = buildSession(dataset, cfg)
    setSession(s)
    setFeedback(null)
    setView({ mode: 'flash' })
  }

  function startWeakSpots() {
    if (!dataset) return
    const cfg = { mode: 'weakspots' as const, weakspotQids: weakspotIds, count: Math.min(30, weakspotIds.length || 30) }
    const s = buildSession(dataset, cfg)
    setSession(s)
    setFeedback(null)
    setView({ mode: 'weakspots' })
  }

  async function onAnswer(selected: OptionKey) {
    if (!session) return
    const q = currentQuestion(session)
    if (!q) return
    const t0 = Date.now()
    const res = doAnswer(session, selected)
    const t1 = Date.now()
    setSession({ ...session })
    setFeedback({ selected, correct: res.correct, earned: res.earned })
    await addAttempt({ qid: q.id, correct: res.correct, selected, ts: Date.now(), mode: view.mode, ms: t1 - t0 })
  }

  async function onNext() {
    if (!session) return
    doNext(session)
    setSession({ ...session })
    setFeedback(null)
    // if finished, update best score
    if (session.finishedAt) {
      const mode = view.mode
      const prev = await getBestScore(mode)
      const better = !prev || session.score > prev.bestScore
      if (better) {
        await setBestScore({ mode, bestScore: session.score, bestStreak: session.maxStreak, bestDate: Date.now(), details: { correct: session.correctCount, total: session.questions.length } })
      }
    }
  }

  async function onReset() {
    if (confirm('Isto apaga todo o progresso local (tentativas e leaderboard). Continuar?')) {
      await resetAllProgress()
      setLeaderboard([])
      setWeakspotIds([])
      alert('Progresso apagado.')
    }
  }

  if (!dataset) {
    return (
      <div className="container">
        <h1>{title}</h1>
        <p>A carregar perguntas…</p>
      </div>
    )
  }

  const q = session ? currentQuestion(session) : null
  const finished = session?.finishedAt

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>{title}</h1>
          <p className="muted">Offline-first • streaks • leaderboard • modos de estudo</p>
        </div>
        <div className="headerActions">
          <Button onClick={() => setView({ mode: 'home' })}>Home</Button>
          <Button onClick={() => setView({ mode: 'leaderboard' })}>Leaderboard</Button>
        </div>
      </header>

      {view.mode === 'home' && (
        <>
          <Card>
            <h2>Modos</h2>
            <div className="grid">
              <div className="tile">
                <h3>Practice</h3>
                <p>Escolhe domínios (1, vários ou todos) e pratica.</p>
                <Button onClick={() => setView({ mode: 'practice' })}>Configurar</Button>
              </div>
              <div className="tile">
                <h3>Exam</h3>
                <p>Simulação de exame: {dataset.meta.examQuestions} perguntas.</p>
                <Button onClick={startExam}>Começar</Button>
              </div>
              <div className="tile">
                <h3>Weak Spots</h3>
                <p>Rever perguntas em que falhas mais.</p>
                <Button onClick={startWeakSpots} disabled={weakspotIds.length === 0}>Começar</Button>
                {weakspotIds.length === 0 && <p className="muted">(Precisas de algumas tentativas primeiro)</p>}
              </div>
              <div className="tile">
                <h3>Flash</h3>
                <p>Rápido: todas as perguntas sem repetição (random).</p>
                <Button onClick={startFlash}>Começar</Button>
              </div>
            </div>
          </Card>

          <Card>
            <h2>Notas</h2>
            <ul>
              <li>As perguntas vêm de <code>public/data/questions.json</code> (gerado do teu Markdown).</li>
              <li>O progresso fica guardado no teu dispositivo (IndexedDB).</li>
              <li>Para instalar no telemóvel como app: faz build e publica em HTTPS (ex: GitHub Pages / Netlify) e depois “Add to Home Screen”.</li>
            </ul>
            <div className="row">
              <Button className="danger" onClick={onReset}>Reset progresso</Button>
            </div>
          </Card>
        </>
      )}

      {view.mode === 'practice' && !session && (
        <Card>
          <h2>Practice – Configuração</h2>
          <p>Seleciona domínios para estudar (1, vários ou todos).</p>
          <div className="row">
            <Button onClick={() => setSelectedDomains(dataset.domains.map(d=>d.id))}>Selecionar todos</Button>
            <Button onClick={() => setSelectedDomains([])}>Limpar</Button>
          </div>
          <div className="domainList">
            {dataset.domains.map(d => (
              <label key={d.id} className="domainItem">
                <input
                  type="checkbox"
                  checked={selectedDomains.includes(d.id)}
                  onChange={(e) => {
                    setSelectedDomains(prev => e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id))
                  }}
                />
                <span><strong>{d.name}</strong>{d.weight ? ` • ~${d.weight}%` : ''}</span>
              </label>
            ))}
          </div>
          <div className="row">
            <label className="field">
              Nº de perguntas
              <input type="number" min={5} max={200} value={questionCount} onChange={e=>setQuestionCount(Number(e.target.value))} />
            </label>
            <label className="field">
              Mostrar explicação
              <select value={String(showExplanation)} onChange={e=>setShowExplanation(e.target.value==='true')}>
                <option value="true">Sim</option>
                <option value="false">Não (apenas no fim)</option>
              </select>
            </label>
          </div>
          <Button onClick={startPractice}>Começar Practice</Button>
        </Card>
      )}

      {(['practice','exam','weakspots','flash'] as const).includes(view.mode as any) && session && (
        <Card>
          <div className="topbar">
            <div>
              <strong>Modo:</strong> {view.mode.toUpperCase()} • <strong>Pergunta:</strong> {session.index+1}/{session.questions.length}
            </div>
            <div>
              <strong>Score:</strong> {session.score} • <strong>Streak:</strong> {session.streak} • <strong>Max:</strong> {session.maxStreak}
            </div>
          </div>

          {!finished && q && (
            <>
              <h2>Q{q.id}. {q.text}</h2>
              <div className="options">
                {(Object.keys(q.options) as OptionKey[]).sort().map(k => (
                  <button
                    key={k}
                    className={
                      feedback?.selected
                        ? (k === q.correct ? 'opt correct' : (k === feedback.selected ? 'opt wrong' : 'opt'))
                        : 'opt'
                    }
                    disabled={!!feedback?.selected}
                    onClick={() => onAnswer(k)}
                  >
                    <span className="optKey">{k}</span>
                    <span>{q.options[k]}</span>
                  </button>
                ))}
              </div>

              {feedback?.selected && (
                <div className={feedback.correct ? 'feedback ok' : 'feedback bad'}>
                  {feedback.correct ? '✅ Certo!' : `❌ Errado. Correto: ${q.correct}`}
                  {feedback.correct && <span className="pill">+{feedback.earned} pts</span>}
                </div>
              )}

              {(showExplanation && feedback?.selected) && (
                <div className="explanation">
                  <h3>Explicação</h3>
                  <p>{q.explanation ?? 'Sem explicação no dataset.'}</p>
                </div>
              )}

              <div className="row">
                <Button onClick={onNext} disabled={!feedback?.selected}>Próxima</Button>
              </div>
            </>
          )}

          {finished && (
            <>
              <h2>Fim 🎉</h2>
              <p><strong>Score:</strong> {session.score} • <strong>Acertos:</strong> {session.correctCount}/{session.questions.length} • <strong>Max streak:</strong> {session.maxStreak}</p>
              {!showExplanation && (
                <>
                  <h3>Rever respostas (explicações)</h3>
                  <p className="muted">Neste MVP, as explicações são mostradas durante a sessão quando a opção está ativa. Podes ativar para o próximo treino.</p>
                </>
              )}
              <div className="row">
                <Button onClick={() => { setSession(null); setView({ mode: 'home' }) }}>Voltar ao Home</Button>
                <Button onClick={() => { setSession(null); setView({ mode: 'leaderboard' }) }}>Ver Leaderboard</Button>
              </div>
            </>
          )}
        </Card>
      )}

      {view.mode === 'leaderboard' && (
        <Card>
          <h2>Leaderboard (pessoal – guardado localmente)</h2>
          {leaderboard.length === 0 ? (
            <p className="muted">Ainda não há scores guardados. Faz um modo e termina a sessão para gravar o melhor score.</p>
          ) : (
            <div className="table">
              <div className="trow thead">
                <div>Modo</div><div>Melhor score</div><div>Melhor streak</div><div>Detalhes</div>
              </div>
              {leaderboard.sort((a,b)=>b.bestScore-a.bestScore).map(r => (
                <div key={r.mode} className="trow">
                  <div>{String(r.mode).toUpperCase()}</div>
                  <div>{r.bestScore}</div>
                  <div>{r.bestStreak}</div>
                  <div className="muted">{r.details ? `${r.details.correct}/${r.details.total}` : '-'}</div>
                </div>
              ))}
            </div>
          )}
          <div className="row">
            <Button onClick={() => setView({ mode: 'home' })}>Voltar</Button>
          </div>
        </Card>
      )}

      <footer className="footer">
        <small className="muted">MVP gerado automaticamente • PWA com cache • Dados locais</small>
      </footer>
    </div>
  )
}