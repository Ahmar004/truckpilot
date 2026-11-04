import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppProviders } from './AppProviders'
import { AppRoutes } from './AppRoutes'

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}

test('an unknown path shows the not found page with a way home', () => {
  renderAt('/nowhere')
  expect(
    screen.getByRole('heading', { name: /this road doesn't go anywhere/i }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
})

test('the header has the theme and units controls', () => {
  renderAt('/')
  expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'mi' })).toBeChecked()
})

test('the guide links back to the planner from the far right of the header', () => {
  renderAt('/guide')
  const links = screen.getAllByRole('link', { name: 'Try TruckPilot' })
  expect(links[0]).toHaveAttribute('href', '/')
  expect(screen.queryByRole('link', { name: /^sign in$/i })).not.toBeInTheDocument()
})

test('/sign-in no longer exists', () => {
  renderAt('/sign-in')
  expect(
    screen.getByRole('heading', { name: /this road doesn't go anywhere/i }),
  ).toBeInTheDocument()
})
