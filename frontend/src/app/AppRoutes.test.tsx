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
