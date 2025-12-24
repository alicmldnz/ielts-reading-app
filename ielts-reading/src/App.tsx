import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChoiceOption, PassageSection, Question, ReadingTest } from './types'
import readingTest310 from './data/readingTest310'
import './App.css'

type AnswerState = Record<string, string[]>
type ReviewState = Record<string, boolean>
type Mode = 'author' | 'exam' | 'results'

interface QuestionResult {
  questionId: string
  isCorrect: boolean
  userAnswer: string[]
  correctAnswer: string[]
}

interface SavedTestResult {
  id: string
  testTitle: string
  testSubtitle?: string
  completedAt: string
  score: number
  totalQuestions: number
  results: QuestionResult[]
  test: ReadingTest
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const STORAGE_KEY = 'ielts-saved-test-results'

const saveTestResult = (result: SavedTestResult): void => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    const results: SavedTestResult[] = existing ? JSON.parse(existing) : []
    results.unshift(result) // Add to beginning
    // Keep only last 50 results
    const limited = results.slice(0, 50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited))
  } catch (error) {
    console.error('Failed to save test result:', error)
  }
}

const getSavedTestResults = (): SavedTestResult[] => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    return existing ? JSON.parse(existing) : []
  } catch (error) {
    console.error('Failed to load saved test results:', error)
    return []
  }
}

const deleteSavedTestResult = (id: string): void => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    const results: SavedTestResult[] = existing ? JSON.parse(existing) : []
    const filtered = results.filter((r) => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to delete test result:', error)
  }
}

const defaultOptions = (): ChoiceOption[] => [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' }
]

const createBlankSection = (idx: number): PassageSection => ({
  id: `section-${idx + 1}`,
  title: `Part ${idx + 1}`,
  instructions: '',
  passage: [''],
  questions: []
})

const createQuestion = (number: number, type: Question['type']): Question =>
  normalizeQuestionByType(
    {
      id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      number,
      prompt: '',
      type,
      options: defaultOptions(),
      correctAnswer: ['A'],
    },
    type,
  )

const normalizeQuestionByType = (question: Question, type: Question['type']): Question => {
  const base = { ...question, type }
  if (type === 'tfng') {
    return { ...base, options: undefined, rows: undefined, correctAnswer: ['TRUE'] }
  }
  if (type === 'single' || type === 'dropdown') {
    const opts = base.options?.length ? base.options : defaultOptions()
    const correct = opts[0]?.value ? [opts[0].value] : ['A']
    return { ...base, options: opts, rows: undefined, correctAnswer: correct }
  }
  if (type === 'multiple') {
    const opts = base.options?.length ? base.options : defaultOptions()
    return { ...base, options: opts, rows: undefined, correctAnswer: [] }
  }
  if (type === 'short') {
    return { ...base, options: undefined, rows: undefined, correctAnswer: [''] }
  }
  if (type === 'matrix') {
    const opts = base.options?.length ? base.options : defaultOptions()
    const rows = base.rows?.length
      ? base.rows
      : [
          { id: 'r1', label: 'Statement 1' },
          { id: 'r2', label: 'Statement 2' },
          { id: 'r3', label: 'Statement 3' },
          { id: 'r4', label: 'Statement 4' }
        ]
    const correct = rows.map(() => opts[0]?.value ?? 'A')
    return { ...base, options: opts, rows, correctAnswer: correct }
  }
  if (type === 'cloze') {
    return {
      ...base,
      options: undefined,
      rows: undefined,
      prompt: base.prompt || 'Type text with {{blank1}} here',
      correctAnswer: [''],
    }
  }
  return base
}

const buildInitialAnswers = (questions: Question[]): AnswerState =>
  questions.reduce((acc, q) => {
    if (q.type === 'matrix' && q.rows) {
      q.rows.forEach((row) => {
        const rowKey = `${q.id}__${row.id}`
        acc[rowKey] = []
      })
    } else if (q.type === 'cloze') {
      const blanks =
        q.prompt.match(/\{\{[^}]+\}\}/g)?.length ?? Math.max(1, q.correctAnswer.length)
      Array.from({ length: blanks }).forEach((_, idx) => {
        acc[`${q.id}__blank-${idx}`] = []
      })
    } else {
      acc[q.id] = []
    }
    return acc
  }, {} as AnswerState)

function App() {
  const [mode, setMode] = useState<Mode>('author')
  const [draft, setDraft] = useState<ReadingTest>({
    title: 'Custom IELTS Reading',
    subtitle: 'Build four parts, then start the test',
    durationMinutes: 60,
    sections: [0, 1, 2, 3].map((i) => createBlankSection(i))
  })
  const [test, setTest] = useState<ReadingTest | null>(null)
  const [newQuestionType, setNewQuestionType] = useState<
    Record<string, Question['type']>
  >({})
  const [newQuestionCount, setNewQuestionCount] = useState<Record<string, number>>({})
  const [bulkTfng, setBulkTfng] = useState<Record<string, string>>({})
  const [bulkShort, setBulkShort] = useState<Record<string, string>>({})
  const [bulkQuestions, setBulkQuestions] = useState<Record<string, string>>({})
  const [bulkOptions, setBulkOptions] = useState<Record<string, string>>({})

  const activeTest: ReadingTest = mode === 'exam' && test ? test : draft
  const allSections = activeTest.sections
  const allQuestions = useMemo(
    () => allSections.flatMap((s) => s.questions),
    [allSections],
  )

  const [answers, setAnswers] = useState<AnswerState>(() =>
    buildInitialAnswers(allQuestions),
  )
  const [reviewFlags, setReviewFlags] = useState<ReviewState>({})
  const [activeQuestionId, setActiveQuestionId] = useState(
    allQuestions[0]?.id ?? '',
  )
  const [secondsLeft, setSecondsLeft] = useState(
    activeTest.durationMinutes * 60,
  )
  const [highlights, setHighlights] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<QuestionResult[] | null>(null)
  const [savedResults, setSavedResults] = useState<SavedTestResult[]>(() => getSavedTestResults())
  const [viewingSavedResult, setViewingSavedResult] = useState<SavedTestResult | null>(null)

  // Normalize answer for comparison (case-insensitive, trimmed)
  const normalizeAnswer = (answer: string): string => {
    return answer.trim().toLowerCase()
  }

  // Check if two answer arrays match (case-insensitive)
  const answersMatch = useCallback((userAnswers: string[], correctAnswers: string[]): boolean => {
    const normalizedUser = userAnswers.map(normalizeAnswer).sort()
    const normalizedCorrect = correctAnswers.map(normalizeAnswer).sort()
    if (normalizedUser.length !== normalizedCorrect.length) return false
    return normalizedUser.every((ans, idx) => ans === normalizedCorrect[idx])
  }, [])

  const handleFinishTest = useCallback(() => {
    if (!test) return
    const allQuestions = test.sections.flatMap((s) => s.questions)
    const questionResults: QuestionResult[] = []

    allQuestions.forEach((question) => {
      let userAnswer: string[] = []
      let correctAnswer: string[] = question.correctAnswer

      if (question.type === 'matrix' && question.rows) {
        userAnswer = question.rows.map((row) => {
          const rowKey = `${question.id}__${row.id}`
          return (answers[rowKey] ?? [])[0] ?? ''
        })
      } else if (question.type === 'cloze') {
        const blanks = question.prompt.match(/\{\{[^}]+\}\}/g)?.length ?? Math.max(1, question.correctAnswer.length)
        userAnswer = Array.from({ length: blanks }).map((_, idx) => {
          const key = `${question.id}__blank-${idx}`
          return (answers[key] ?? [])[0] ?? ''
        })
      } else {
        userAnswer = answers[question.id] ?? []
      }

      const isCorrect = answersMatch(userAnswer, correctAnswer)
      questionResults.push({
        questionId: question.id,
        isCorrect,
        userAnswer,
        correctAnswer,
      })
    })

    setResults(questionResults)
    setMode('results')
    
    // Save results to localStorage
    const correctCount = questionResults.filter((r) => r.isCorrect).length
    const savedResult: SavedTestResult = {
      id: `test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      testTitle: test.title,
      testSubtitle: test.subtitle,
      completedAt: new Date().toISOString(),
      score: correctCount,
      totalQuestions: questionResults.length,
      results: questionResults,
      test: JSON.parse(JSON.stringify(test)) as ReadingTest,
    }
    saveTestResult(savedResult)
  }, [test, answers, answersMatch])

  useEffect(() => {
    if (mode !== 'exam') return
    const id = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => clearInterval(id)
  }, [mode])

  // Check if time is up and finish test
  useEffect(() => {
    if (mode === 'exam' && secondsLeft === 0 && test) {
      handleFinishTest()
    }
  }, [secondsLeft, mode, test, handleFinishTest])

  const scrollToQuestion = (questionId: string) => {
    const el = document.getElementById(`question-${questionId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const updateAnswer = (questionId: string, value: string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleCheckboxChange = (questionId: string, value: string) => {
    const existing = answers[questionId] ?? []
    const next = existing.includes(value)
      ? existing.filter((v) => v !== value)
      : [...existing, value]
    updateAnswer(questionId, next)
  }

  const toggleReview = (questionId: string) => {
    setReviewFlags((prev) => ({ ...prev, [questionId]: !prev[questionId] }))
  }

  const activeSection =
    allSections.find((section) =>
      section.questions.some((q) => q.id === activeQuestionId),
    ) ?? allSections[0]

  const isAnswered = (question: Question) => {
    if (question.type === 'matrix' && question.rows) {
      return question.rows.every((row) => {
        const rowKey = `${question.id}__${row.id}`
        return (answers[rowKey] ?? []).length > 0
      })
    }
    if (question.type === 'cloze') {
      const blanks =
        question.prompt.match(/\{\{[^}]+\}\}/g)?.length ??
        Math.max(1, question.correctAnswer.length)
      return Array.from({ length: blanks }).every((_, idx) => {
        const key = `${question.id}__blank-${idx}`
        return (answers[key] ?? []).length > 0
      })
    }
    return (answers[question.id] ?? []).length > 0
  }

  const sectionTokenKey = (sectionId: string, paraIdx: number, tokenIdx: number) =>
    `${sectionId}|${paraIdx}|${tokenIdx}`

  const toggleHighlight = (sectionId: string, paraIdx: number, tokenIdx: number) => {
    const key = sectionTokenKey(sectionId, paraIdx, tokenIdx)
    setHighlights((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const highlightSelection = () => {
    if (mode !== 'exam') return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const container = document.querySelector('.passage-body')
    if (!container) return

    const spans = container.querySelectorAll<HTMLSpanElement>('span.hl')
    const updates: Record<string, boolean> = {}

    spans.forEach((span) => {
      try {
        if (!range.intersectsNode(span)) return
      } catch {
        return
      }
      const sectionId = span.dataset.sectionId
      const paraIndex = span.dataset.paraIndex
      const tokenIndex = span.dataset.tokenIndex
      if (!sectionId || paraIndex === undefined || tokenIndex === undefined) return
      const key = sectionTokenKey(
        sectionId,
        Number(paraIndex),
        Number(tokenIndex),
      )
      updates[key] = true
    })

    if (Object.keys(updates).length) {
      setHighlights((prev) => ({ ...prev, ...updates }))
    }
    selection.removeAllRanges()
  }

  const handleStartExam = () => {
    const finalized = JSON.parse(JSON.stringify(draft)) as ReadingTest
    const finalQuestions = finalized.sections.flatMap((s) => s.questions)
    setTest(finalized)
    setMode('exam')
    setAnswers(buildInitialAnswers(finalQuestions))
    setReviewFlags({})
    setActiveQuestionId(finalQuestions[0]?.id ?? '')
    setSecondsLeft(finalized.durationMinutes * 60)
    // Scroll to top of page to show exam screen
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleImportTest = () => {
    const hasContent = draft.sections.some(
      (s) => s.questions.length > 0 || s.passage.some((p) => p.trim().length > 0)
    )
    if (hasContent) {
      const confirmed = window.confirm(
        'Bu işlem mevcut içeriğinizi değiştirecek. Devam etmek istediğinize emin misiniz?'
      )
      if (!confirmed) return
    }
    setDraft(JSON.parse(JSON.stringify(readingTest310)) as ReadingTest)
  }

  const handleBackToEdit = () => {
    setMode('author')
    setTest(null)
    setAnswers(buildInitialAnswers(draft.sections.flatMap((s) => s.questions)))
    setReviewFlags({})
    setResults(null)
    setViewingSavedResult(null)
    // Reload saved results
    setSavedResults(getSavedTestResults())
  }

  const handleViewSavedResult = (savedResult: SavedTestResult) => {
    setViewingSavedResult(savedResult)
  }

  const handleCloseSavedResult = () => {
    setViewingSavedResult(null)
  }

  const handleDeleteSavedResult = (id: string) => {
    if (window.confirm('Bu sonucu silmek istediğinize emin misiniz?')) {
      deleteSavedTestResult(id)
      setSavedResults(getSavedTestResults())
      if (viewingSavedResult?.id === id) {
        setViewingSavedResult(null)
      }
    }
  }


  const updateSection = (
    sectionId: string,
    updater: (section: PassageSection) => PassageSection,
  ) => {
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId ? updater(section) : section,
      ),
    }))
  }

  const updateQuestion = (
    sectionId: string,
    questionId: string,
    updater: (question: Question) => Question,
  ) => {
    updateSection(sectionId, (section) => ({
      ...section,
      questions: section.questions.map((q) =>
        q.id === questionId ? updater(q) : q,
      ),
    }))
  }

  const addQuestionToSection = (
    sectionId: string,
    count: number,
    type: Question['type'],
  ) => {
    updateSection(sectionId, (section) => {
      const nextNumber =
        section.questions.length > 0
          ? Math.max(...section.questions.map((q) => q.number)) + 1
          : 1
      const safeCount = Math.max(1, Math.min(20, count))
      const additions = Array.from({ length: safeCount }).map((_, idx) =>
        createQuestion(nextNumber + idx, type),
      )
      return {
        ...section,
        questions: [...section.questions, ...additions],
      }
    })
  }

  const removeQuestion = (sectionId: string, questionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      questions: section.questions.filter((q) => q.id !== questionId),
    }))
  }

  const renderAuthorQuestion = (sectionId: string, question: Question) => {
    const onTypeChange = (nextType: Question['type']) => {
      updateQuestion(sectionId, question.id, (q) =>
        normalizeQuestionByType(q, nextType),
      )
    }

    const onOptionChange = (
      idx: number,
      field: 'label' | 'value',
      value: string,
    ) => {
      updateQuestion(sectionId, question.id, (q) => {
        const opts = q.options ? [...q.options] : defaultOptions()
        opts[idx] = { ...opts[idx], [field]: value }
        return { ...q, options: opts }
      })
    }

    const addOption = () => {
      updateQuestion(sectionId, question.id, (q) => {
        const opts = q.options ? [...q.options] : defaultOptions()
        const nextLetter = String.fromCharCode(65 + opts.length)
        opts.push({ value: nextLetter, label: nextLetter })
        return { ...q, options: opts }
      })
    }

    const onRowChange = (idx: number, label: string) => {
      updateQuestion(sectionId, question.id, (q) => {
        const rows = q.rows ? [...q.rows] : []
        rows[idx] = { ...rows[idx], label }
        return { ...q, rows }
      })
    }

    const addRow = () => {
      updateQuestion(sectionId, question.id, (q) => {
        const rows = q.rows ? [...q.rows] : []
        rows.push({ id: `r${rows.length + 1}`, label: `Statement ${rows.length + 1}` })
        const correct = q.correctAnswer ? [...q.correctAnswer] : []
        correct.push(q.options?.[0]?.value ?? 'A')
        return { ...q, rows, correctAnswer: correct }
      })
    }

    const setCorrect = (value: string | string[]) => {
      updateQuestion(sectionId, question.id, (q) => ({
        ...q,
        correctAnswer: Array.isArray(value) ? value : [value],
      }))
    }

    const setMatrixCorrect = (rowIdx: number, value: string) => {
      updateQuestion(sectionId, question.id, (q) => {
        const next = [...(q.correctAnswer ?? [])]
        next[rowIdx] = value
        return { ...q, correctAnswer: next }
      })
    }

    const setShortAnswers = (value: string) => {
      const parts = value
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean)
      updateQuestion(sectionId, question.id, (q) => ({
        ...q,
        correctAnswer: parts.length ? parts : [''],
      }))
    }
    const setClozeAnswers = (value: string) => {
      const parts = value
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean)
      updateQuestion(sectionId, question.id, (q) => ({
        ...q,
        correctAnswer: parts.length ? parts : [''],
      }))
    }

    return (
      <div key={question.id} className="author-question">
        <div className="author-question-top">
          <div className="inline-field">
            <label>No.</label>
            <input
              type="number"
              value={question.number}
              onChange={(e) =>
                updateQuestion(sectionId, question.id, (q) => ({
                  ...q,
                  number: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="inline-field">
            <label>Type</label>
            <select
              value={question.type}
              onChange={(e) => onTypeChange(e.target.value as Question['type'])}
            >
              <option value="single">Multiple choice (one)</option>
              <option value="multiple">Multiple choice (many)</option>
              <option value="dropdown">Dropdown</option>
              <option value="tfng">TRUE / FALSE / NOT GIVEN</option>
              <option value="short">Short answer</option>
          <option value="cloze">Fill-in-the-blank (cloze)</option>
              <option value="matrix">Matrix (A–C table)</option>
            </select>
          </div>
          <button
            className="ghost small"
            type="button"
            onClick={() => removeQuestion(sectionId, question.id)}
          >
            Delete
          </button>
        </div>

        <label className="stacked">
          Prompt
          <textarea
            value={question.prompt}
            onChange={(e) =>
              updateQuestion(sectionId, question.id, (q) => ({
                ...q,
                prompt: e.target.value,
              }))
            }
          />
        </label>

        {(question.type === 'single' ||
          question.type === 'multiple' ||
          question.type === 'dropdown') && (
          <div className="author-options">
            <div className="options-header">
              <strong>Options</strong>
              <button type="button" className="ghost small" onClick={addOption}>
                Add option
              </button>
            </div>
            {question.options?.map((opt, idx) => (
              <div key={opt.value} className="option-row">
                <input
                  value={opt.value}
                  onChange={(e) => onOptionChange(idx, 'value', e.target.value)}
                  placeholder="Value (A)"
                />
                <input
                  value={opt.label}
                  onChange={(e) => onOptionChange(idx, 'label', e.target.value)}
                  placeholder="Label"
                />
                {question.type === 'multiple' ? (
                  <label className="correct-mark">
                    <input
                      type="checkbox"
                      checked={question.correctAnswer.includes(opt.value)}
                      onChange={() => {
                        const exists = question.correctAnswer.includes(opt.value)
                        const next = exists
                          ? question.correctAnswer.filter((c) => c !== opt.value)
                          : [...question.correctAnswer, opt.value]
                        setCorrect(next)
                      }}
                    />
                    Correct
                  </label>
                ) : (
                  <label className="correct-mark">
                    <input
                      type="radio"
                      name={`correct-${question.id}`}
                      checked={question.correctAnswer[0] === opt.value}
                      onChange={() => setCorrect(opt.value)}
                    />
                    Correct
                  </label>
                )}
              </div>
            ))}
          </div>
        )}

        {question.type === 'tfng' && (
          <label className="stacked small-gap">
            Correct answer
            <select
              value={question.correctAnswer[0] ?? 'TRUE'}
              onChange={(e) => setCorrect(e.target.value)}
            >
              <option value="TRUE">TRUE</option>
              <option value="FALSE">FALSE</option>
              <option value="NOT GIVEN">NOT GIVEN</option>
            </select>
          </label>
        )}

        {question.type === 'short' && (
          <label className="stacked">
            Accepted answers (one per line)
            <textarea
              value={(question.correctAnswer ?? []).join('\n')}
              onChange={(e) => setShortAnswers(e.target.value)}
              placeholder="heat islands&#10;urban heat islands"
            />
          </label>
        )}

        {question.type === 'cloze' && (
          <>
            <label className="stacked">
              Cloze text (use {'{{blank1}}'} markers)
              <textarea
                value={question.prompt}
                onChange={(e) =>
                  updateQuestion(sectionId, question.id, (q) => ({
                    ...q,
                    prompt: e.target.value,
                  }))
                }
                placeholder="The racket change was called {{blank1}}."
              />
            </label>
            <label className="stacked">
              Answers for blanks (order matters, one per line)
              <textarea
                value={(question.correctAnswer ?? []).join('\n')}
                onChange={(e) => setClozeAnswers(e.target.value)}
                placeholder="innovation&#10;durable"
              />
            </label>
          </>
        )}

        {question.type === 'matrix' && (
          <div className="matrix-author">
            <div className="options-header">
              <strong>Columns (letters)</strong>
              <button type="button" className="ghost small" onClick={addOption}>
                Add column
              </button>
            </div>
            <div className="matrix-cols">
              {question.options?.map((opt, idx) => (
                <div key={opt.value} className="option-row">
                  <input
                    value={opt.value}
                    onChange={(e) => onOptionChange(idx, 'value', e.target.value)}
                    placeholder="Value"
                  />
                  <input
                    value={opt.label}
                    onChange={(e) => onOptionChange(idx, 'label', e.target.value)}
                    placeholder="Label"
                  />
                </div>
              ))}
            </div>
            <div className="options-header">
              <strong>Rows (statements)</strong>
              <button type="button" className="ghost small" onClick={addRow}>
                Add row
              </button>
            </div>
            <div className="matrix-rows">
              {question.rows?.map((row, idx) => (
                <div key={row.id} className="matrix-row-edit">
                  <input
                    value={row.label}
                    onChange={(e) => onRowChange(idx, e.target.value)}
                  />
                  <select
                    value={question.correctAnswer[idx] ?? ''}
                    onChange={(e) => setMatrixCorrect(idx, e.target.value)}
                  >
                    {(question.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {question.type === 'cloze' && (
          <div className="choice">
            <small>Blanks will appear wherever you use {'{{blank}}'} markers in the text.</small>
          </div>
        )}
      </div>
    )
  }

  const renderQuestion = (question: Question) => {
    const value = answers[question.id] ?? []
    const isActive = question.id === activeQuestionId

    return (
      <div
        key={question.id}
        id={`question-${question.id}`}
        className={`question-card ${isAnswered(question) ? 'answered' : ''} ${
          isActive ? 'active' : ''
        }`}
      >
        <div className="question-header">
          <div className="prompt-wrap">
            <span className="pill">{question.number}</span>
            {question.type !== 'cloze' && (
              <span className="prompt">{question.prompt}</span>
            )}
          </div>
        </div>

        {question.type === 'tfng' && (
          <div className="choices grid-3">
            {['TRUE', 'FALSE', 'NOT GIVEN'].map((option) => (
              <label key={option} className="choice">
                <input
                  type="radio"
                  name={question.id}
                  checked={value.includes(option)}
                  onChange={() => updateAnswer(question.id, [option])}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'single' && (
          <div className="choices">
            {question.options?.map((option) => (
              <label key={option.value} className="choice">
                <input
                  type="radio"
                  name={question.id}
                  checked={value.includes(option.value)}
                  onChange={() => updateAnswer(question.id, [option.value])}
                />
                <span>
                  <strong>{option.value}</strong> {option.label}
                </span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'multiple' && (
          <div className="choices">
            {question.options?.map((option) => (
              <label key={option.value} className="choice">
                <input
                  type="checkbox"
                  name={`${question.id}-${option.value}`}
                  checked={value.includes(option.value)}
                  onChange={() =>
                    handleCheckboxChange(question.id, option.value)
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'dropdown' && (
          <select
            className="dropdown"
            value={value[0] ?? ''}
            onChange={(e) =>
              updateAnswer(question.id, e.target.value ? [e.target.value] : [])
            }
          >
            <option value="">Choose</option>
            {question.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {question.type === 'short' && (
          <input
            className="short-input"
            type="text"
            value={value[0] ?? ''}
            onChange={(e) => updateAnswer(question.id, [e.target.value])}
          />
        )}

        {question.type === 'cloze' && (
          <div className="cloze-text">
            {(() => {
              const parts = question.prompt.split(/(\{\{[^}]+\}\})/g).filter(Boolean)
              let blankIdx = 0
              return parts.map((part, idx) => {
                const isBlank = part.startsWith('{{') && part.endsWith('}}')
                if (!isBlank) return <span key={idx}>{part}</span>
                
                // Extract number from {{blank24}} or use index
                const numberMatch = part.match(/\d+/)
                const blankNumber = numberMatch ? numberMatch[0] : blankIdx + 1
                const key = `${question.id}__blank-${blankIdx}`
                const val = answers[key]?.[0] ?? ''
                const input = (
                  <span key={key} className="cloze-blank-wrapper">
                    <span className="cloze-number">{blankNumber}</span>
                    <input
                      className="short-input inline"
                      value={val}
                      onChange={(e) => updateAnswer(key, [e.target.value])}
                    />
                  </span>
                )
                blankIdx += 1
                return input
              })
            })()}
          </div>
        )}

        {question.type === 'matrix' && question.rows && (
          <div className="matrix-table">
            <div
              className="matrix-header"
              style={{
                gridTemplateColumns: `1fr repeat(${question.options?.length ?? 0}, 70px)`
              }}
            >
              <div className="matrix-corner" />
              {question.options?.map((opt) => (
                <div key={opt.value} className="matrix-col">
                  {opt.label}
                </div>
              ))}
            </div>
            <div className="matrix-body">
              {question.rows.map((row) => {
                const rowKey = `${question.id}__${row.id}`
                const rowValue = answers[rowKey] ?? []
                return (
                  <div
                    key={row.id}
                    className="matrix-row"
                    style={{
                      gridTemplateColumns: `1fr repeat(${question.options?.length ?? 0}, 70px)`
                    }}
                  >
                    <div className="matrix-row-label">{row.label}</div>
                    {question.options?.map((opt) => (
                      <label key={opt.value} className="matrix-cell">
                        <input
                          type="radio"
                          name={rowKey}
                          checked={rowValue.includes(opt.value)}
                          onChange={() => updateAnswer(rowKey, [opt.value])}
                        />
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      {mode !== 'exam' && (
      <div className="author-panel">
        <div className="author-head">
          <div>
            <p className="eyebrow">Author mode</p>
            <h1>Build your IELTS Reading (4 parts)</h1>
            <p className="muted">
              Enter passage and questions for each part, then press Start Exam. Question type controls change the input format automatically.
            </p>
          </div>
          <div className="author-actions">
            <button className="primary" type="button" onClick={handleStartExam}>
              Start exam with this content
            </button>
            {mode === 'exam' && (
              <button className="ghost" type="button" onClick={handleBackToEdit}>
                Back to editing
              </button>
            )}
          </div>
        </div>
        <div className="author-grid">
          <label className="stacked">
            Test title
            <input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="stacked">
            Subtitle
            <input
              value={draft.subtitle ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
            />
          </label>
          <label className="stacked">
            Duration (minutes)
            <input
              type="number"
              value={draft.durationMinutes}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  durationMinutes: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
        <div className="author-import">
          <button className="ghost" type="button" onClick={handleImportTest}>
            Import Reading Test 310
          </button>
          <p className="help-text">
            PDF'den çıkarılan test içeriğini yükler. Mevcut içerik kaybolur (onay istenir).
          </p>
        </div>

        <div className="author-import">
          <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Kaydedilmiş Sınav Sonuçları</h3>
          {savedResults.length === 0 ? (
            <p className="help-text">Henüz kaydedilmiş sınav sonucu yok.</p>
          ) : (
            <div className="saved-results-list">
              {savedResults.map((savedResult) => {
                const date = new Date(savedResult.completedAt)
                const dateStr = date.toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const percentage = Math.round((savedResult.score / savedResult.totalQuestions) * 100)
                return (
                  <div key={savedResult.id} className="saved-result-item">
                    <div className="saved-result-header">
                      <div>
                        <strong>{savedResult.testTitle}</strong>
                        {savedResult.testSubtitle && (
                          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                            {savedResult.testSubtitle}
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                          {dateStr}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
                          {savedResult.score} / {savedResult.totalQuestions}
                        </div>
                        <div style={{ fontSize: '14px', color: '#64748b' }}>
                          %{percentage}
                        </div>
                      </div>
                    </div>
                    <div className="saved-result-actions">
                      <button
                        className="ghost small"
                        type="button"
                        onClick={() => handleViewSavedResult(savedResult)}
                      >
                        Detayları Görüntüle
                      </button>
                      <button
                        className="ghost small"
                        type="button"
                        onClick={() => handleDeleteSavedResult(savedResult.id)}
                        style={{ color: '#ef4444' }}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {draft.sections.map((section, idx) => (
          <div key={section.id} className="author-section">
            <div className="author-section-head">
      <div>
                <p className="eyebrow">Part {idx + 1}</p>
                <input
                  className="section-title-input"
                  value={section.title}
                  onChange={(e) =>
                    updateSection(section.id, (s) => ({ ...s, title: e.target.value }))
                  }
                />
              </div>
              <button
                className="ghost small"
                type="button"
                onClick={() => updateSection(section.id, () => createBlankSection(idx))}
              >
                Clear part
              </button>
            </div>

            <label className="stacked">
              Instructions
              <textarea
                value={section.instructions}
                onChange={(e) =>
                  updateSection(section.id, (s) => ({ ...s, instructions: e.target.value }))
                }
              />
            </label>

            <label className="stacked">
              Passage (paragraphs separated by line breaks)
              <textarea
                value={section.passage.join('\n')}
                onChange={(e) =>
                  updateSection(section.id, (s) => ({
                    ...s,
                    passage: e.target.value.split('\n'),
                  }))
                }
                rows={6}
              />
            </label>

            <div className="section-questions-head">
              <h3>Questions</h3>
              <div className="inline-field">
                <label>New question type</label>
                <select
                  value={newQuestionType[section.id] ?? 'single'}
                  onChange={(e) =>
                    setNewQuestionType((prev) => ({
                      ...prev,
                      [section.id]: e.target.value as Question['type'],
                    }))
                  }
                >
                  <option value="single">Multiple choice (one)</option>
                  <option value="multiple">Multiple choice (many)</option>
                  <option value="dropdown">Dropdown</option>
                  <option value="tfng">TRUE / FALSE / NOT GIVEN</option>
                  <option value="short">Short answer</option>
                  <option value="matrix">Matrix (A–C table)</option>
                </select>
              </div>
              <div className="inline-field">
                <label>How many</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newQuestionCount[section.id] ?? 1}
                  onChange={(e) =>
                    setNewQuestionCount((prev) => ({
                      ...prev,
                      [section.id]: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <button
                className="ghost"
                type="button"
                onClick={() =>
                  addQuestionToSection(
                    section.id,
                    newQuestionCount[section.id] ?? 1,
                    newQuestionType[section.id] ?? 'single',
                  )
                }
              >
                Add question(s)
              </button>
            </div>

            <div className="stacked">
              <label>Bulk add TRUE/FALSE/NOT GIVEN (one statement per line)</label>
              <textarea
                placeholder="Paste statements here..."
                value={bulkTfng[section.id] ?? ''}
                onChange={(e) =>
                  setBulkTfng((prev) => ({ ...prev, [section.id]: e.target.value }))
                }
                rows={4}
              />
              <button
                className="ghost small"
                type="button"
                onClick={() => {
                  const text = bulkTfng[section.id] ?? ''
                  const lines = text
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean)
                  if (!lines.length) return
                  setBulkTfng((prev) => ({ ...prev, [section.id]: '' }))
                  updateSection(section.id, (sec) => {
                    const start =
                      sec.questions.length > 0
                        ? Math.max(...sec.questions.map((q) => q.number)) + 1
                        : 1
                    const additions = lines.map((line, idx) => ({
                      ...createQuestion(start + idx, 'tfng'),
                      prompt: line,
                      correctAnswer: ['TRUE'],
                    }))
                    return { ...sec, questions: [...sec.questions, ...additions] }
                  })
                }}
              >
                Add TFNG block
              </button>
            </div>

            <div className="stacked">
              <label>Bulk add Short Answer questions (one question per line)</label>
              <textarea
                placeholder="Paste questions here..."
                value={bulkShort[section.id] ?? ''}
                onChange={(e) =>
                  setBulkShort((prev) => ({ ...prev, [section.id]: e.target.value }))
                }
                rows={4}
              />
              <button
                className="ghost small"
                type="button"
                onClick={() => {
                  const text = bulkShort[section.id] ?? ''
                  const lines = text
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean)
                  if (!lines.length) return
                  setBulkShort((prev) => ({ ...prev, [section.id]: '' }))
                  updateSection(section.id, (sec) => {
                    const start =
                      sec.questions.length > 0
                        ? Math.max(...sec.questions.map((q) => q.number)) + 1
                        : 1
                    const additions = lines.map((line, idx) => ({
                      ...createQuestion(start + idx, 'short'),
                      prompt: line,
                      correctAnswer: [''],
                    }))
                    return { ...sec, questions: [...sec.questions, ...additions] }
                  })
                }}
              >
                Add Short Answer block
              </button>
            </div>

            {(['single', 'multiple', 'dropdown'] as const).map((qType) => {
              const key = `${section.id}__${qType}`
              const optionsKey = `${section.id}__${qType}__options`
              return (
                <div key={qType} className="stacked">
                  <label>
                    Bulk add {qType === 'single' ? 'Single Choice' : qType === 'multiple' ? 'Multiple Choice' : 'Dropdown'} questions
                  </label>
                  <textarea
                    placeholder="Paste questions here (one question per line)..."
                    value={bulkQuestions[key] ?? ''}
                    onChange={(e) =>
                      setBulkQuestions((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    rows={4}
                  />
                  <label>Options for all questions (one option per line)</label>
                  <textarea
                    placeholder="Paste options here (one option per line, e.g., A, B, C options)..."
                    value={bulkOptions[optionsKey] ?? ''}
                    onChange={(e) =>
                      setBulkOptions((prev) => ({ ...prev, [optionsKey]: e.target.value }))
                    }
                    rows={4}
                  />
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => {
                      const questionsText = bulkQuestions[key] ?? ''
                      const optionsText = bulkOptions[optionsKey] ?? ''
                      
                      const questionLines = questionsText
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)
                      
                      const optionLines = optionsText
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)

                      if (!questionLines.length) return
                      
                      // Build options from textarea or use defaults
                      let options: ChoiceOption[]
                      if (optionLines.length > 0) {
                        options = optionLines.map((opt, optIdx) => {
                          // Remove A), B), C) prefixes if present
                          const cleaned = opt.replace(/^[A-Z]\)\s*/, '').trim()
                          const letter = String.fromCharCode(65 + optIdx)
                          return { value: letter, label: cleaned || letter }
                        })
                      } else {
                        options = defaultOptions()
                      }

                      setBulkQuestions((prev) => ({ ...prev, [key]: '' }))
                      setBulkOptions((prev) => ({ ...prev, [optionsKey]: '' }))
                      
                      updateSection(section.id, (sec) => {
                        const start =
                          sec.questions.length > 0
                            ? Math.max(...sec.questions.map((q) => q.number)) + 1
                            : 1
                        const additions = questionLines.map((prompt, idx) =>
                          normalizeQuestionByType(
                            {
                              ...createQuestion(start + idx, qType),
                              prompt,
                              options: [...options], // Copy options array for each question
                            },
                            qType,
                          ),
                        )
                        return { ...sec, questions: [...sec.questions, ...additions] }
                      })
                    }}
                  >
                    Add {qType === 'single' ? 'Single Choice' : qType === 'multiple' ? 'Multiple Choice' : 'Dropdown'} block
                  </button>
                </div>
              )
            })}

            <div className="stacked">
              <label>Bulk add Cloze (Fill-in-the-blank) - Paragraph format with numbered blanks</label>
              <textarea
                placeholder="Paste paragraph with blanks like: '...resulted in calls for 24 ........................................... for the pirates...'"
                value={bulkQuestions[`${section.id}__cloze`] ?? ''}
                onChange={(e) =>
                  setBulkQuestions((prev) => ({ ...prev, [`${section.id}__cloze`]: e.target.value }))
                }
                rows={8}
              />
              <button
                className="ghost small"
                type="button"
                onClick={() => {
                  const text = bulkQuestions[`${section.id}__cloze`] ?? ''
                  if (!text.trim()) return
                  
                  // Detect blank patterns: number followed by dots/dashes (e.g., "24 ...........................................")
                  const blankPattern = /(\d+)\s*([.\-]{3,})\s*/g
                  let match
                  const blanks: Array<{ number: number; fullMatch: string }> = []
                  let lastIndex = 0
                  
                  while ((match = blankPattern.exec(text)) !== null) {
                    blanks.push({
                      number: parseInt(match[1], 10),
                      fullMatch: match[0]
                    })
                    lastIndex = Math.max(lastIndex, blankPattern.lastIndex)
                  }

                  if (blanks.length === 0) {
                    // Fallback: treat entire text as one cloze question with manual {{blank}} format
                    setBulkQuestions((prev) => ({ ...prev, [`${section.id}__cloze`]: '' }))
                    updateSection(section.id, (sec) => {
                      const start =
                        sec.questions.length > 0
                          ? Math.max(...sec.questions.map((q) => q.number)) + 1
                          : 1
                      const additions = [
                        normalizeQuestionByType(
                          {
                            ...createQuestion(start, 'cloze'),
                            prompt: text,
                          },
                          'cloze',
                        ),
                      ]
                      return { ...sec, questions: [...sec.questions, ...additions] }
                    })
                    return
                  }

                  // Replace blank patterns with {{blankN}} placeholders
                  let processedText = text
                  blanks.forEach((blank) => {
                    // Replace the first occurrence of this specific pattern (escape special chars in number)
                    const escapedNum = String(blank.number).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    const pattern = new RegExp(`(${escapedNum}\\s*[.\\-]{3,}\\s*)`)
                    const placeholder = `{{blank${blank.number}}}`
                    processedText = processedText.replace(pattern, placeholder)
                  })

                  setBulkQuestions((prev) => ({ ...prev, [`${section.id}__cloze`]: '' }))
                  updateSection(section.id, (sec) => {
                    const baseStart =
                      sec.questions.length > 0
                        ? Math.max(...sec.questions.map((q) => q.number)) + 1
                        : 1
                    const start = blanks[0]?.number || baseStart

                    // Create one cloze question with the entire paragraph
                    const additions = [
                      normalizeQuestionByType(
                        {
                          ...createQuestion(start, 'cloze'),
                          prompt: processedText,
                        },
                        'cloze',
                      ),
                    ]
                    return { ...sec, questions: [...sec.questions, ...additions] }
                  })
                }}
              >
                Add Cloze block
              </button>
            </div>

            <div className="stacked">
              <label>Bulk add Matrix questions (one statement per line)</label>
              <textarea
                placeholder="Paste statements here (will create one matrix question with all statements as rows)..."
                value={bulkQuestions[`${section.id}__matrix`] ?? ''}
                onChange={(e) =>
                  setBulkQuestions((prev) => ({ ...prev, [`${section.id}__matrix`]: e.target.value }))
                }
                rows={4}
              />
              <button
                className="ghost small"
                type="button"
                onClick={() => {
                  const text = bulkQuestions[`${section.id}__matrix`] ?? ''
                  const lines = text
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean)
                  if (!lines.length) return
                  setBulkQuestions((prev) => ({ ...prev, [`${section.id}__matrix`]: '' }))
                  updateSection(section.id, (sec) => {
                    const start =
                      sec.questions.length > 0
                        ? Math.max(...sec.questions.map((q) => q.number)) + 1
                        : 1
                    const rows = lines.map((line, idx) => ({
                      id: `r${idx + 1}`,
                      label: line,
                    }))
                    const additions = [
                      normalizeQuestionByType(
                        {
                          ...createQuestion(start, 'matrix'),
                          prompt: 'Choose the correct option for each statement.',
                          rows,
                        },
                        'matrix',
                      ),
                    ]
                    return { ...sec, questions: [...sec.questions, ...additions] }
                  })
                }}
              >
                Add Matrix block
              </button>
            </div>

            <div className="author-questions-list">
              {section.questions.map((q) => renderAuthorQuestion(section.id, q))}
              {section.questions.length === 0 && (
                <p className="muted">No questions yet. Add one to begin.</p>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {(mode === 'exam' || mode === 'results') && (
        <>
          <header className="masthead">
            <div className="user-block">XXXX XXXXXXX - 123456</div>
            <div className="timer-block">
              <span className="clock-icon" aria-hidden>
                ⏰
              </span>
              <span className="timer-text">
                {formatTime(secondsLeft)} <span className="timer-sub">minutes left</span>
              </span>
            </div>
            <div className="masthead-actions">
              <button className="masthead-btn" onClick={handleFinishTest}>Finish Test</button>
              <button className="masthead-btn">Help</button>
              <button className="masthead-btn">Hide</button>
            </div>
          </header>

          <div className="part-header">
            <h2>{activeSection?.title || 'Part'}</h2>
            <p>
              Read the text below and answer questions{' '}
              <strong>
                {activeSection?.questions[0]?.number ?? '–'} –{' '}
                {
                  activeSection?.questions[activeSection?.questions.length - 1]
                    ?.number ?? '–'
                }
              </strong>
              .
            </p>
          </div>

          <section className="columns">
            <div className="panel passage">
              <h3>{activeSection?.title}</h3>
              {activeSection?.instructions && (
                <p className="instruction">{activeSection.instructions}</p>
              )}
              {mode === 'exam' && (
                <div className="passage-tools">
                  <button
                    type="button"
                    className="ghost small"
                    onClick={highlightSelection}
                  >
                    Highlight selection
                  </button>
                </div>
              )}
              <div className="passage-body">
                {activeSection?.passage.map((para, pIdx) => {
                  const tokens = para.split(/(\s+)/)
                  return (
                    <p key={pIdx}>
                      {tokens.map((tok, tIdx) => {
                        if (!tok.trim()) return tok
                        const key = sectionTokenKey(activeSection.id, pIdx, tIdx)
                        const on = !!highlights[key]
                        return (
                          <span
                            key={tIdx}
                            className={on ? 'hl on' : 'hl'}
                            data-section-id={activeSection.id}
                            data-para-index={pIdx}
                            data-token-index={tIdx}
                            onClick={() =>
                              mode === 'exam' &&
                              toggleHighlight(activeSection.id, pIdx, tIdx)
                            }
                          >
                            {tok}
                          </span>
                        )
                      })}
                    </p>
                  )
                })}
              </div>
            </div>

            <div className="panel questions">
              <h3>
                Questions {activeSection?.questions[0]?.number ?? ''}{' '}
                {activeSection?.questions.length ? '–' : ''}{' '}
                {activeSection?.questions[activeSection?.questions.length - 1]?.number ?? ''}
              </h3>
              <div className="question-list">
                {activeSection?.questions.map((question) => renderQuestion(question))}
              </div>
            </div>
          </section>

          <footer className="palette-bar">
            <label className="review-toggle">
              <input
                type="checkbox"
                checked={!!reviewFlags[activeQuestionId]}
                onChange={() => toggleReview(activeQuestionId)}
              />
              Review
            </label>
            <div className="palette">
              {allQuestions.map((q) => {
                const answered = isAnswered(q)
                const review = reviewFlags[q.id]
                const isActive = q.id === activeQuestionId
                return (
                  <button
                    key={q.id}
                    className={`palette-item ${answered ? 'answered' : ''} ${
                      review ? 'review' : ''
                    } ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveQuestionId(q.id)
                      scrollToQuestion(q.id)
                    }}
                  >
                    {q.number}
                  </button>
                )
              })}
            </div>
          </footer>
        </>
      )}

      {mode === 'results' && results && test && (
        <div className="results-overlay">
          <div className="results-modal">
            <h2>Test Results</h2>
            <div className="results-summary">
              <div className="score-card">
                <div className="score-number">
                  {results.filter((r) => r.isCorrect).length} / {results.length}
                </div>
                <div className="score-percentage">
                  {Math.round((results.filter((r) => r.isCorrect).length / results.length) * 100)}%
                </div>
              </div>
            </div>
            <div className="results-details">
              <h3>Question-by-Question Results</h3>
              <div className="results-list">
                {test.sections.flatMap((section) =>
                  section.questions.map((question) => {
                    const result = results.find((r) => r.questionId === question.id)
                    if (!result) return null
                    return (
                      <div
                        key={question.id}
                        className={`result-item ${result.isCorrect ? 'correct' : 'incorrect'}`}
                      >
                        <div className="result-header">
                          <span className="result-number">Q{question.number}</span>
                          <span className={`result-status ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                            {result.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                        </div>
                        <div className="result-prompt">{question.prompt}</div>
                        <div className="result-answers">
                          <div className="answer-row">
                            <strong>Your answer:</strong>{' '}
                            {result.userAnswer.length > 0
                              ? result.userAnswer.join(', ')
                              : '(no answer)'}
                          </div>
                          <div className="answer-row">
                            <strong>Correct answer:</strong>{' '}
                            {result.correctAnswer.join(', ')}
                          </div>
                        </div>
                      </div>
                    )
                  }),
                )}
              </div>
            </div>
            <div className="results-actions">
              <button className="primary" type="button" onClick={handleBackToEdit}>
                Back to Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingSavedResult && (
        <div className="results-overlay">
          <div className="results-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Kaydedilmiş Sonuçlar</h2>
              <button className="ghost small" type="button" onClick={handleCloseSavedResult}>
                ✕ Kapat
              </button>
            </div>
            <div className="results-summary">
              <div style={{ marginBottom: '12px' }}>
                <strong>{viewingSavedResult.testTitle}</strong>
                {viewingSavedResult.testSubtitle && (
                  <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                    {viewingSavedResult.testSubtitle}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                  {new Date(viewingSavedResult.completedAt).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className="score-card">
                <div className="score-number">
                  {viewingSavedResult.score} / {viewingSavedResult.totalQuestions}
                </div>
                <div className="score-percentage">
                  {Math.round((viewingSavedResult.score / viewingSavedResult.totalQuestions) * 100)}%
                </div>
              </div>
            </div>
            <div className="results-details">
              <h3>Soru Bazında Sonuçlar</h3>
              <div className="results-list">
                {viewingSavedResult.test.sections.flatMap((section) =>
                  section.questions.map((question) => {
                    const result = viewingSavedResult.results.find((r) => r.questionId === question.id)
                    if (!result) return null
                    return (
                      <div
                        key={question.id}
                        className={`result-item ${result.isCorrect ? 'correct' : 'incorrect'}`}
                      >
                        <div className="result-header">
                          <span className="result-number">Q{question.number}</span>
                          <span className={`result-status ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                            {result.isCorrect ? '✓ Doğru' : '✗ Yanlış'}
                          </span>
                        </div>
                        <div className="result-prompt">{question.prompt}</div>
                        <div className="result-answers">
                          <div className="answer-row">
                            <strong>Sizin cevabınız:</strong>{' '}
                            {result.userAnswer.length > 0
                              ? result.userAnswer.join(', ')
                              : '(cevap yok)'}
                          </div>
                          <div className="answer-row">
                            <strong>Doğru cevap:</strong>{' '}
                            {result.correctAnswer.join(', ')}
                          </div>
                        </div>
                      </div>
                    )
                  }),
                )}
              </div>
            </div>
            <div className="results-actions">
              <button className="ghost" type="button" onClick={handleCloseSavedResult}>
                Kapat
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() => handleDeleteSavedResult(viewingSavedResult.id)}
                style={{ color: '#ef4444' }}
              >
                Sonucu Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
