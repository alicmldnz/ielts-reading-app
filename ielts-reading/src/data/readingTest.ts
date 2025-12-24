import type { ReadingTest } from '../types'

// Edit this file to swap passages or questions.
// Keep ids stable if you want to preserve saved answers in the UI.
const readingTest: ReadingTest = {
  title: 'IELTS General Training – Reading (Computer-delivered)',
  subtitle: 'Practice set mirrored from the official sample',
  durationMinutes: 60,
  sections: [
    {
      id: 'section-1',
      title: 'Section 1 – Matching (A–C)',
      instructions:
        'Questions 1–4. Choose the correct letter (A–C) for each statement. Any letter may be used more than once.',
      passage: [
        'Political units in the history of West Africa (extract).',
        'A. Tichitt-Oualata: A four-tier settlement hierarchy with rich terracotta and bead work; many tumuli remain unexcavated.',
        'B. Dhar Tichitt: Regional centre focused on mixed farming, rapid evolution and immigration; evidence of early city walls.',
        'C. Dhar Oualata: Later decline, yet shrines with elaborate pavements of pottery and brass.'
      ],
      questions: [
        {
          id: 'q1',
          number: 1,
          prompt: 'Questions 1–4: Choose the correct political unit (A–C) for each statement.',
          type: 'matrix',
          options: [
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
            { value: 'C', label: 'C' }
          ],
          rows: [
            { id: 'r1', label: '1 There is evidence that metal workers were highly skilled.' },
            { id: 'r2', label: '2 No investigation of certain structures has taken place.' },
            { id: 'r3', label: '3 Habitation continued after the decline of the political unit.' },
            { id: 'r4', label: '4 Different residential areas had different characteristics.' }
          ],
          correctAnswer: ['A', 'B', 'C', 'A']
        }
      ]
    },
    {
      id: 'section-2',
      title: 'Section 2 – Workplace Policy Extract',
      instructions:
        'Questions 6–15. Read the policy and complete the tasks. Choose the correct letter A, B, C or D for multiple choice questions. For matching, choose the correct option from the dropdown.',
      passage: [
        'Company Travel Policy (Excerpt)',
        '1. Staff may book economy tickets for trips under six hours. Premium economy is permitted for trips exceeding six hours. Business class requires director approval.',
        '2. Hotel bookings should favour mid-range chains unless the client specifies otherwise. Rooms with breakfast included are preferred.',
        '3. Local transport: ride-share and public transport are acceptable. Car rental is only for destinations with poor transit links.',
        '4. Expense claims must be submitted within 7 days of return, with digital receipts attached.',
        '5. Loyalty points earned on business travel belong to the traveller.'
      ],
      questions: [
        {
          id: 'q6',
          number: 6,
          prompt: 'What is the default class for a 5-hour flight?',
          type: 'single',
          options: [
            { value: 'A', label: 'Economy' },
            { value: 'B', label: 'Premium economy' },
            { value: 'C', label: 'Business' },
            { value: 'D', label: 'Any class with approval' }
          ],
          correctAnswer: ['A']
        },
        {
          id: 'q7',
          number: 7,
          prompt: 'Premium economy is allowed without approval for flights longer than:',
          type: 'single',
          options: [
            { value: 'A', label: '4 hours' },
            { value: 'B', label: '6 hours' },
            { value: 'C', label: '8 hours' },
            { value: 'D', label: 'Only with client request' }
          ],
          correctAnswer: ['B']
        },
        {
          id: 'q8',
          number: 8,
          prompt: 'Which hotel type should staff book by default?',
          type: 'single',
          options: [
            { value: 'A', label: 'Luxury hotel' },
            { value: 'B', label: 'Mid-range chain' },
            { value: 'C', label: 'Hostel' },
            { value: 'D', label: 'Client-preferred only' }
          ],
          correctAnswer: ['B']
        },
        {
          id: 'q9',
          number: 9,
          prompt: 'Acceptable local transport methods (choose two).',
          type: 'multiple',
          options: [
            { value: 'rideshare', label: 'Ride-share' },
            { value: 'public', label: 'Public transport' },
            { value: 'rental', label: 'Car rental in all cases' },
            { value: 'limo', label: 'Chauffeur service' }
          ],
          correctAnswer: ['rideshare', 'public']
        },
        {
          id: 'q10',
          number: 10,
          prompt: 'When must expenses be submitted?',
          type: 'dropdown',
          options: [
            { value: '24h', label: 'Within 24 hours' },
            { value: '3d', label: 'Within 3 days' },
            { value: '7d', label: 'Within 7 days' },
            { value: '14d', label: 'Within 14 days' }
          ],
          correctAnswer: ['7d']
        }
      ]
    },
    {
      id: 'section-3',
      title: 'Section 3 – Article: Urban Green Roofs',
      instructions:
        'Questions 11–20. Read the article and answer the questions. Use NO MORE THAN THREE WORDS for short answers.',
      passage: [
        'Urban planners are turning to green roofs to reduce heat islands and manage stormwater. By adding soil and vegetation to rooftops, buildings can absorb rainfall that would otherwise burden drainage systems.',
        'Early projects focused on biodiversity, but newer designs emphasise energy savings and community access. Lightweight soil mixes allow older buildings to participate without heavy structural upgrades.',
        'Researchers note that maintenance is frequently underestimated. Native plants often outperform exotic species because they survive temperature swings and require less irrigation.'
      ],
      questions: [
        {
          id: 'q11',
          number: 11,
          prompt: 'What environmental problem do green roofs help address in cities?',
          type: 'short',
          correctAnswer: ['heat islands', 'urban heat islands']
        },
        {
          id: 'q12',
          number: 12,
          prompt: 'Green roofs reduce pressure on what infrastructure?',
          type: 'short',
          correctAnswer: ['drainage systems', 'stormwater systems']
        },
        {
          id: 'q13',
          number: 13,
          prompt: 'What feature allows older buildings to install green roofs?',
          type: 'short',
          correctAnswer: ['lightweight soil', 'lightweight soil mixes']
        },
        {
          id: 'q14',
          number: 14,
          prompt: 'According to the article, what is often underestimated?',
          type: 'short',
          correctAnswer: ['maintenance']
        },
        {
          id: 'q15',
          number: 15,
          prompt: 'Which plants usually cope better with temperature swings?',
          type: 'single',
          options: [
            { value: 'native', label: 'Native plants' },
            { value: 'exotic', label: 'Exotic species' },
            { value: 'both', label: 'Both equally' },
            { value: 'none', label: 'Neither – all require irrigation' }
          ],
          correctAnswer: ['native']
        }
      ]
    }
  ]
}

export default readingTest

