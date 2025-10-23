import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./App.jsx";

import { ThemeProvider } from "./designSystem/ThemeProvider.jsx";

import { initSharedStorage } from "./lib/storageClient.js";

async function bootstrap() {
  if (import.meta.env?.VITE_DEMO_MODE === "1") {
    try {
      const module = await import("./demo/demoMode.js");

      if (typeof module.enableDemoMode === "function") {
        await module.enableDemoMode();
      }
    } catch (error) {
      console.warn("Không thể bật chế độ demo", error);
    }
  }

  try {
    await initSharedStorage();
  } catch (error) {
    console.error(
      "Không thể khởi tạo bộ nhớ chia sẻ trước khi render ứng dụng, tiếp tục sử dụng bộ nhớ tạm.",
      error,
    );
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}

bootstrap();
