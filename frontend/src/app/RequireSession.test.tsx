import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { RequireSession } from './RequireSession'

function renderGuard(me: { status: number; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(me.body), { status: me.status })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <RequireSession>
          <p>planner</p>
        </RequireSession>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

test('signed out: the planner shows under a sign-in pop-up that cannot be closed', async () => {
  renderGuard({ status: 401, body: { code: 'not_signed_in' } })
  const dialog = await screen.findByRole('dialog', { name: 'Sign in to plan your trip' })
  expect(screen.getByText('planner')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(dialog).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Take a guide' })).toHaveAttribute('href', '/guide')
})

test('signed in: the planner shows with no pop-up', async () => {
  renderGuard({ status: 200, body: { user: { name: 'A', email: 'a@b.c', picture: null } } })
  expect(await screen.findByText('planner')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
