import { render, screen } from '@testing-library/react'
import App from './App'

test('見出し「タスク管理」を表示する', () => {
  render(<App />)
  expect(
    screen.getByRole('heading', { name: 'タスク管理' }),
  ).toBeInTheDocument()
})
