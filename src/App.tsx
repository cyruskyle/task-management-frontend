import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const foundation = [
  { label: 'Interface', value: 'React + TypeScript' },
  { label: 'Design system', value: 'Tailwind CSS + shadCN' },
  { label: 'Delivery', value: 'Vite + Docker' },
]

function App() {
  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,var(--muted),transparent_55%)]"
      />
      <section className="mx-auto flex min-h-svh w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-10 lg:px-12">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-6 bg-background/80 px-3 py-1">
            Internal team workspace
          </Badge>
          <p className="mb-3 text-sm font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Infrastructure operations
          </p>
          <h1 className="max-w-2xl text-4xl font-medium tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
            Tasks, ownership, and operational clarity.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            A focused frontend foundation for the internal infrastructure task
            tracker, designed for accessible and reliable team workflows.
          </p>
        </div>

        <Card className="mt-12 max-w-3xl bg-card/90 shadow-xl shadow-foreground/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Frontend foundation ready</CardTitle>
            <CardDescription>
              The initial interface, quality checks, and local delivery setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-3">
              {foundation.map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/50 p-4">
                  <dt className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-2 text-sm font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground">
          Setup baseline. No operational data connected.
        </p>
      </section>
    </main>
  )
}

export default App
