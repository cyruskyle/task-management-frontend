import {
  taskStatuses,
  type Task,
  type TaskInput,
  type TaskStatus,
} from './tracker'

export type ApiCredentials = {
  username: string
  password: string
}

export type TrackerData = {
  projects: string[]
  tasks: Task[]
}

export type TrackerApiErrorKind =
  | 'unauthorized'
  | 'http'
  | 'invalid'
  | 'conflict'
  | 'network'
  | 'invalid-response'

export class TrackerApiError extends Error {
  readonly kind: TrackerApiErrorKind

  constructor(kind: TrackerApiErrorKind, message: string) {
    super(message)
    this.name = 'TrackerApiError'
    this.kind = kind
  }
}

const statusValues = new Set<string>(taskStatuses)
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function invalidResponse(message: string) {
  return new TrackerApiError('invalid-response', message)
}

function encodeBasic({ username, password }: ApiCredentials) {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return `Basic ${btoa(binary)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && isoDatePattern.test(value)
}

function isStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && statusValues.has(value)
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
) {
  const value = record[key]

  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw invalidResponse(`Task field "${key}" is not a valid string.`)
  }

  return value
}

function parseProjects(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    throw invalidResponse('The projects response was not a list.')
  }

  const seen = new Set<string>()

  return payload.map((item) => {
    if (!isRecord(item) || typeof item.name !== 'string') {
      throw invalidResponse('A project entry is missing its name.')
    }

    const name = item.name.trim()

    if (
      name.length === 0 ||
      name.length > 120 ||
      typeof item.id !== 'number' ||
      !Number.isSafeInteger(item.id) ||
      seen.has(name)
    ) {
      throw invalidResponse('A project entry is invalid.')
    }

    seen.add(name)
    return name
  })
}

function parseTask(item: unknown): Task {
  if (!isRecord(item)) {
    throw invalidResponse('A task entry is not an object.')
  }

  const id = requireString(item, 'id', 36)
  const assignedDate = item.assignedDate
  const assignees = item.assignees
  const storyPoints = item.storyPoints
  const doneDate = item.doneDate
  const status = item.status

  if (!uuidPattern.test(id)) {
    throw invalidResponse('A task entry has an invalid identifier.')
  }

  if (
    !Array.isArray(assignees) ||
    assignees.some(
      (assignee) => typeof assignee !== 'string' || assignee.length > 120,
    )
  ) {
    throw invalidResponse('A task entry has invalid assignees.')
  }

  if (
    storyPoints !== null &&
    (typeof storyPoints !== 'number' ||
      !Number.isInteger(storyPoints) ||
      storyPoints < 0 ||
      storyPoints > 100)
  ) {
    throw invalidResponse('A task entry has invalid story points.')
  }

  if (doneDate !== null && !isDate(doneDate)) {
    throw invalidResponse('A task entry has an invalid completion date.')
  }

  if (!isDate(assignedDate)) {
    throw invalidResponse('A task entry has an invalid assigned date.')
  }

  if (!isStatus(status)) {
    throw invalidResponse('A task entry has an unknown status.')
  }

  return {
    id,
    reference: requireString(item, 'reference', 32),
    name: requireString(item, 'name', 300),
    project: requireString(item, 'project', 120),
    assignees: [...assignees],
    storyPoints,
    assignedDate,
    doneDate,
    status,
    notes: typeof item.notes === 'string' ? item.notes.slice(0, 2000) : '',
  }
}

function parseTasks(payload: unknown): Task[] {
  if (!Array.isArray(payload)) {
    throw invalidResponse('The tasks response was not a list.')
  }

  return payload.map(parseTask)
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

async function readProblemDetail(response: Response) {
  try {
    const payload = (await response.json()) as unknown

    if (
      isRecord(payload) &&
      typeof payload.detail === 'string' &&
      payload.detail.length > 0 &&
      payload.detail.length <= 300
    ) {
      return payload.detail
    }
  } catch {
    return null
  }

  return null
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  signal?: AbortSignal
}

async function requestJson(
  path: string,
  credentials: ApiCredentials,
  options: RequestOptions = {},
) {
  const { method = 'GET', body, signal } = options
  let response: Response

  try {
    response = await fetch(path, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: encodeBasic(credentials),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }

    throw new TrackerApiError(
      'network',
      'Could not reach the tracker API. Check your connection and try again.',
    )
  }

  if (response.status === 401) {
    throw new TrackerApiError(
      'unauthorized',
      'Incorrect username or password.',
    )
  }

  if (response.status === 403) {
    throw new TrackerApiError(
      'http',
      'This account is not allowed to change tracker data.',
    )
  }

  if (response.status === 400 || response.status === 409 || response.status === 404) {
    const detail = await readProblemDetail(response)

    if (response.status === 400) {
      throw new TrackerApiError(
        'invalid',
        detail ?? 'The task data is invalid.',
      )
    }

    if (response.status === 409) {
      throw new TrackerApiError(
        'conflict',
        detail ?? 'That change conflicts with an existing task.',
      )
    }

    throw new TrackerApiError('http', detail ?? 'That task no longer exists.')
  }

  if (!response.ok) {
    throw new TrackerApiError(
      'http',
      `The tracker API returned an unexpected response (${response.status}).`,
    )
  }

  try {
    return (await response.json()) as unknown
  } catch {
    throw new TrackerApiError(
      'invalid-response',
      'The tracker API returned data that could not be read.',
    )
  }
}

export async function fetchTrackerData(
  credentials: ApiCredentials,
  signal?: AbortSignal,
): Promise<TrackerData> {
  const [projectPayload, taskPayload] = await Promise.all([
    requestJson('/api/projects', credentials, { signal }),
    requestJson('/api/tasks', credentials, { signal }),
  ])

  return {
    projects: parseProjects(projectPayload),
    tasks: parseTasks(taskPayload),
  }
}

export async function createTask(
  credentials: ApiCredentials,
  input: TaskInput,
  signal?: AbortSignal,
): Promise<Task> {
  const payload = await requestJson('/api/tasks', credentials, {
    method: 'POST',
    body: input,
    signal,
  })

  return parseTask(payload)
}

export async function updateTask(
  credentials: ApiCredentials,
  id: string,
  input: TaskInput,
  signal?: AbortSignal,
): Promise<Task> {
  const payload = await requestJson(
    `/api/tasks/${encodeURIComponent(id)}`,
    credentials,
    { method: 'PUT', body: input, signal },
  )

  return parseTask(payload)
}
