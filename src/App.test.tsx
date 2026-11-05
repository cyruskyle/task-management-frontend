import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the accessible frontend foundation', () => {
    render(<App />)

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tasks, ownership, and operational clarity.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Tailwind CSS + shadCN')).toBeInTheDocument()
  })
})
