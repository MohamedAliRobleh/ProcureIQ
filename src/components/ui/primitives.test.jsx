import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoadingSpinner from './LoadingSpinner'
import Badge from './Badge'
import Button from './Button'
import Card from './Card'

describe('LoadingSpinner', () => {
  it('renders a status role for accessibility', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('Badge', () => {
  it('renders its label text', () => {
    render(<Badge variant="green">active</Badge>)
    expect(screen.getByText('active')).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('renders children and responds to clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies the disabled attribute', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('Card', () => {
  it('renders its children inside a styled container', () => {
    render(<Card>content</Card>)
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
