import { render, screen } from '@testing-library/react'
import App from './App'
import { mockFetch } from './test/cards'

test('見出し「タスク管理」とボードを表示する', async () => {
  mockFetch(200, [])
  render(<App />)
  expect(
    screen.getByRole('heading', { name: 'タスク管理' }),
  ).toBeInTheDocument()
  expect(
    await screen.findByRole('region', { name: '未着手' }),
  ).toBeInTheDocument()
  vi.restoreAllMocks()
})
