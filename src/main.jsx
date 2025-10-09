import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './designSystem/ThemeProvider.jsx'
import { initSharedStorage } from './lib/storageClient.js'

async function bootstrap() {
  try {
    await initSharedStorage()
  } catch (error) {
    console.error('Không thể khởi tạo bộ nhớ chia sẻ trước khi render ứng dụng, tiếp tục sử dụng bộ nhớ tạm.', error)
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
}

bootstrap()
