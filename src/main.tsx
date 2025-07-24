import React from 'react'
import ReactDOM from 'react-dom/client'
import { HeroUIProvider, ToastProvider } from "@heroui/react"
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <HeroUIProvider
        theme={{
          extend: {
            components: {
              table: {
                base: "overflow-x-scroll overflow-y-auto",
                wrapper: "overflow-x-scroll"
              }
            }
          }
        }}
      >
        <ToastProvider placement="top-right" style={{ marginTop: '32px' }} />
        <App />
      </HeroUIProvider>
    </BrowserRouter>
  </React.StrictMode>,
);