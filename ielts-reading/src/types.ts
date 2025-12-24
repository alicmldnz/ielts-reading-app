export type QuestionType =
  | 'single'
  | 'multiple'
  | 'tfng'
  | 'short'
  | 'dropdown'
  | 'matrix'
  | 'cloze'

export interface ChoiceOption {
  value: string
  label: string
}

export interface TableRow {
  id: string
  label: string
}

export interface Question {
  id: string
  number: number
  prompt: string
  type: QuestionType
  options?: ChoiceOption[]
  rows?: TableRow[]
  correctAnswer: string[]
  reference?: string
}

export interface PassageSection {
  id: string
  title: string
  instructions: string
  passage: string[]
  questions: Question[]
}

export interface ReadingTest {
  title: string
  subtitle?: string
  durationMinutes: number
  sections: PassageSection[]
}

