import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { projectFixtures, taskFixtures } from '@/test/fixtures'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function signIn(username = 'team', password = 'secret') {
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: username },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

function mockTrackerApi() {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit) => {
      const path = String(input)

      if (path === '/api/projects') {
        return jsonResponse(projectFixtures)
      }

      if (path === '/api/tasks') {
        return jsonResponse(taskFixtures)
      }

      throw new Error(`Unexpected request: ${path}`)
    },
  )

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('starts signed out without storing credentials', () => {
    mockTrackerApi()
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Task tracker' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('signs in and renders tasks returned by the API', async () => {
    const fetchMock = mockTrackerApi()
    render(<App />)

    signIn()

    expect(
      await screen.findByText('Cache project summaries'),
    ).toBeInTheDocument()
    expect(screen.getByText('5 of 5 tasks')).toBeInTheDocument()
    expect(screen.getByText('OPS-143')).toBeInTheDocument()
    expect(screen.getByText('Signed in as team')).toBeInTheDocument()

    const authorization = fetchMock.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Authorization'),
    )
    expect(authorization).toEqual([
      `Basic ${btoa('team:secret')}`,
      `Basic ${btoa('team:secret')}`,
    ])
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('shows an authentication error and clears the password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 401)),
    )
    render(<App />)

    signIn('team', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incorrect username or password.',
    )
    expect(screen.getByLabelText('Username')).toHaveValue('team')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('rejects API data that fails runtime validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/projects') {
          return jsonResponse(projectFixtures)
        }

        return jsonResponse([{ ...taskFixtures[0], status: 'Shipped' }])
      }),
    )
    render(<App />)

    signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A task entry has an unknown status.',
    )
    expect(
      screen.queryByText('Cache project summaries'),
    ).not.toBeInTheDocument()
  })

  it('signs out and returns to the sign-in form', async () => {
    mockTrackerApi()
    render(<App />)

    signIn()
    await screen.findByText('Cache project summaries')

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(screen.getByLabelText('Username')).toHaveValue('')
    expect(screen.queryByText('Cache project summaries')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('offers a retry when the API cannot be reached', async () => {
    let failNext = true
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (failNext) {
        failNext = false
        throw new TypeError('Failed to fetch')
      }

      return String(input) === '/api/projects'
        ? jsonResponse(projectFixtures)
        : jsonResponse(taskFixtures)
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the tracker API.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(screen.getByText('Cache project summaries')).toBeInTheDocument()
    })
  })
})
