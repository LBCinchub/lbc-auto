import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { installAutoCapitalize } from '@/lib/autoCapitalize'
import { installProgrammaticInputSync } from '@/lib/programmaticInputSync'

installAutoCapitalize()
installProgrammaticInputSync()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)