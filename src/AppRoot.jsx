import React, { StrictMode } from 'react';

import App from './App.jsx';
import { ThemeProvider } from './designSystem/ThemeProvider.jsx';
import RuntimeErrorBoundary from './components/errorBoundaries/RuntimeErrorBoundary.jsx';

export default function AppRoot() {
  return (
    <StrictMode>
      <ThemeProvider>
        <RuntimeErrorBoundary
          level="page"
          title="Ứng dụng gặp lỗi khi hiển thị."
          description="Hãy thử hiển thị lại ứng dụng. Nếu lỗi tiếp diễn, vui lòng tải lại trang hoặc liên hệ quản trị viên."
        >
          <App />
        </RuntimeErrorBoundary>
      </ThemeProvider>
    </StrictMode>
  );
}
