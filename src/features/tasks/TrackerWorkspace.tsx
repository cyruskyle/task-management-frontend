import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import TaskTracker from './TaskTracker'
import {
  createTask,
  fetchTrackerData,
  TrackerApiError,
  updateTask,
  type ApiCredentials,
  type TrackerData,
} from './api'
import { sortTasks, type Task, type TaskInput } from './tracker'

type WorkspaceState =
  | { status: 'signedOut' }
  | { status: 'loading'; username: string }
  | { status: 'ready'; username: string; data: TrackerData }
  | { status: 'error'; username: string; message: string }

const inputClassName =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20'

function TrackerWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ status: 'signedOut' })
  const [credentials, setCredentials] = useState<ApiCredentials>({
    username: '',
    password: '',
  })
  const [notice, setNotice] = useState<string | null>(null)
  const pendingCredentials = useRef<ApiCredentials | null>(null)
  const sessionCredentials = useRef<ApiCredentials | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      pendingCredentials.current = null
      sessionCredentials.current = null
    }
  }, [])

  const signOut = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    pendingCredentials.current = null
    sessionCredentials.current = null
    setCredentials({ username: '', password: '' })
    setNotice(null)
    setState({ status: 'signedOut' })
  }

  const load = async (input: ApiCredentials) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    pendingCredentials.current = input
    setNotice(null)
    setState({ status: 'loading', username: input.username })

    try {
      const data = await fetchTrackerData(input, controller.signal)

      if (controller.signal.aborted) {
        return
      }

      pendingCredentials.current = null
      sessionCredentials.current = input
      setState({ status: 'ready', username: input.username, data })
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      if (error instanceof TrackerApiError && error.kind === 'unauthorized') {
        pendingCredentials.current = null
        sessionCredentials.current = null
        setCredentials({ username: input.username, password: '' })
        setState({ status: 'signedOut' })
        setNotice(error.message)
        return
      }

      setState({
        status: 'error',
        username: input.username,
        message:
          error instanceof Error
            ? error.message
            : 'Could not load tracker data. Try again.',
      })
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = credentials.username.trim()

    if (!username || !credentials.password) {
      setNotice('Enter both your username and password.')
      return
    }

    const input = { username, password: credentials.password }
    setCredentials({ username, password: '' })
    void load(input)
  }

  const retry = () => {
    const input = pendingCredentials.current

    if (input) {
      void load(input)
      return
    }

    signOut()
  }

  const storeTask = (task: Task) => {
    setState((current) => {
      if (current.status !== 'ready') {
        return current
      }

      return {
        ...current,
        data: {
          ...current.data,
          tasks: sortTasks([
            task,
            ...current.data.tasks.filter((item) => item.id !== task.id),
          ]),
        },
      }
    })
  }

  const runTaskMutation = async (
    call: (credentials: ApiCredentials) => Promise<Task>,
  ) => {
    const credentials = sessionCredentials.current

    if (!credentials) {
      throw new TrackerApiError(
        'unauthorized',
        'Your session ended. Sign in again.',
      )
    }

    try {
      return await call(credentials)
    } catch (error) {
      if (error instanceof TrackerApiError && error.kind === 'unauthorized') {
        sessionCredentials.current = null
        setState({ status: 'signedOut' })
        setCredentials({ username: '', password: '' })
        setNotice('Your session ended. Sign in again.')
        throw new TrackerApiError(
          'unauthorized',
          'Your session ended. Sign in again.',
        )
      }

      throw error
    }
  }

  const createTaskRecord = async (input: TaskInput) => {
    const task = await runTaskMutation((credentials) =>
      createTask(credentials, input),
    )
    storeTask(task)
    return task
  }

  const updateTaskRecord = async (id: string, input: TaskInput) => {
    const task = await runTaskMutation((credentials) =>
      updateTask(credentials, id, input),
    )
    storeTask(task)
    return task
  }

  if (state.status === 'ready') {
    return (
      <TaskTracker
        tasks={state.data.tasks}
        projects={state.data.projects}
        username={state.username}
        onSignOut={signOut}
        onCreateTask={createTaskRecord}
        onUpdateTask={updateTaskRecord}
      />
    )
  }

  return (
    <div className="relative grid min-h-svh place-items-center bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,var(--muted),transparent_70%)]"
      />

      {state.status === 'loading' ? (
        <div className="relative flex w-full max-w-md flex-col items-center text-center">
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-muted-foreground"
          />
          <h1 className="mt-4 text-3xl font-medium tracking-[-0.04em]">
            Task tracker
          </h1>
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Signing in as {state.username} and loading tracker data…
          </p>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <Card className="relative w-full max-w-md shadow-sm">
          <CardContent>
            <Badge variant="destructive" className="rounded-full">
              Data unavailable
            </Badge>
            <h1 className="mt-4 text-3xl font-medium tracking-[-0.04em]">
              Task tracker
            </h1>
            <p role="alert" className="mt-3 text-sm text-muted-foreground">
              {state.message}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={retry}>
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state.status === 'signedOut' ? (
        <div className="relative w-full max-w-md">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1">
              Infrastructure operations
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              Private workspace
            </span>
          </div>
          <h1 className="text-3xl font-medium tracking-[-0.04em] text-balance sm:text-4xl">
            Task tracker
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in with your team credentials to read delivery status across
            projects.
          </p>

          <Card className="mt-6 shadow-sm">
            <CardContent>
              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <label htmlFor="username" className="text-sm font-medium">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    required
                    value={credentials.username}
                    onChange={(event) =>
                      setCredentials((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </div>

                <div className="grid gap-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={credentials.password}
                    onChange={(event) =>
                      setCredentials((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </div>

                {notice ? (
                  <p role="alert" className="text-sm text-destructive">
                    {notice}
                  </p>
                ) : null}

                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Credentials stay in memory for this tab only. Task data is read from
            the authenticated API and rendered as plain text.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default TrackerWorkspace
