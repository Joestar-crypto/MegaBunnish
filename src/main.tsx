import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App';
import './styles/global.css';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || 'cmn5xqu7o00ge0cl4aztig426';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#00e5ff',
        },
        loginMethodsAndOrder: {
          primary: ['privy:cm5l76en107pt1lpl2ve2ocfy'],
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
