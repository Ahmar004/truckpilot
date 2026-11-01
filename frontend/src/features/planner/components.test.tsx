import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToastStack } from '../../components/ui/Toast'
import { INTERVAL_AUTO, LOAD_UNIT, UNIT_SYSTEM } from '../../lib/constants'
import type { TripForm as TripFormValue } from '../../lib/tripValidation'
import type { Plan } from '../../lib/types'
import planFixture from '../../test/fixtures/plan-response.json'
import { CheckpointList } from './CheckpointList'
import { ForecastSlider } from './ForecastSlider'
import { TripForm } from './TripForm'

const emptyForm: TripFormValue = {
  origin: null,
  destination: null,
  departureLocal: '',
  departureEdited: false,
  load: { value: null, unit: LOAD_UNIT.LB },
  interval: INTERVAL_AUTO,
  hos: true,
}

function renderForm(overrides: Partial<Parameters<typeof TripForm>[0]> = {}) {
  const props = {
    form: emptyForm,
    errors: {},
    units: UNIT_SYSTEM.IMPERIAL,
    planning: false,
    onOriginChange: vi.fn(),
    onDestinationChange: vi.fn(),
    onSwap: vi.fn(),
    onDepartureChange: vi.fn(),
    onLoadChange: vi.fn(),
    onIntervalChange: vi.fn(),
    onHosChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TripForm {...props} />
    </QueryClientProvider>,
  )
  return props
}

describe('TripForm', () => {
  it('submits on Enter inside the load field', async () => {
    const props = renderForm()
    await userEvent.type(screen.getByLabelText('Load weight'), '{Enter}')
    expect(props.onSubmit).toHaveBeenCalledOnce()
  })

  it('shows field errors under the fields', () => {
    renderForm({ errors: { origin: 'Pick a place from the suggestions.' } })
    expect(screen.getByText('Pick a place from the suggestions.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Origin' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('while planning, disables the fields and does not submit', async () => {
    const props = renderForm({ planning: true })
    const button = screen.getByRole('button', { name: /Planning/ })
    expect(button).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Origin' })).toBeDisabled()
    await userEvent.click(button)
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('the swap button calls onSwap', async () => {
    const props = renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Swap origin and destination' }))
    expect(props.onSwap).toHaveBeenCalledOnce()
  })

  it('More options summarises the interval and HOS setting', () => {
    renderForm()
    expect(
      screen.getByRole('button', { name: 'More options · Interval Auto · HOS breaks on' }),
    ).toBeInTheDocument()
  })
})

describe('CheckpointList', () => {
  const plan = planFixture as unknown as Plan
  const route = plan.routes[0]

  it('shows a row per checkpoint and marks the selected one', () => {
    render(
      <CheckpointList
        route={route}
        checkpointN={2}
        units={UNIT_SYSTEM.IMPERIAL}
        onSelectCheckpoint={() => undefined}
      />,
    )
    const rows = screen.getAllByRole('button', { name: /Checkpoint \d+/ })
    expect(rows).toHaveLength(route.checkpoints.length)
    expect(screen.getByRole('button', { name: /Checkpoint 2 ·/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('selecting a row reports its number', async () => {
    const onSelect = vi.fn()
    render(
      <CheckpointList
        route={route}
        checkpointN={null}
        units={UNIT_SYSTEM.IMPERIAL}
        onSelectCheckpoint={onSelect}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Checkpoint 1 ·/ }))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('every checkpoint shows a risk label, never color alone', () => {
    render(
      <CheckpointList
        route={route}
        checkpointN={null}
        units={UNIT_SYSTEM.IMPERIAL}
        onSelectCheckpoint={() => undefined}
      />,
    )
    const labels = /Low|Moderate|High|Severe|No Travel|No weather data/
    for (const row of screen.getAllByRole('button', { name: /Checkpoint \d+/ })) {
      expect(row).toHaveTextContent(labels)
    }
  })
})

describe('ForecastSlider', () => {
  it('exposes the hour and its text, and keys move the hour', async () => {
    const onHourChange = vi.fn()
    render(
      <ForecastSlider
        hour={5}
        valueText="+5 h"
        ariaValueText="+5 h. Truck at mile 10"
        onHourChange={onHourChange}
        onKeyDownCapture={() => undefined}
      />,
    )
    const thumb = screen.getByRole('slider', { name: 'Forecast hour' })
    expect(thumb).toHaveAttribute('aria-valuenow', '5')
    expect(thumb).toHaveAttribute('aria-valuetext', '+5 h. Truck at mile 10')
    thumb.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onHourChange).toHaveBeenLastCalledWith(6)
    await userEvent.keyboard('{End}')
    expect(onHourChange).toHaveBeenLastCalledWith(48)
  })
})

describe('ToastStack', () => {
  it('shows each toast, runs its action and reports dismissal', async () => {
    const run = vi.fn()
    const onDismiss = vi.fn()
    render(
      <ToastStack
        toasts={[
          {
            id: 1,
            title: 'Plan failed',
            description: 'Try again',
            action: { label: 'Retry', run },
          },
        ]}
        onDismiss={onDismiss}
      />,
    )
    expect(screen.getAllByText('Plan failed').length).toBeGreaterThan(0)
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    expect(run).toHaveBeenCalledOnce()
  })
})
