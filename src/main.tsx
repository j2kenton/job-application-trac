import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Global error suppression for specific Google API console errors only
const handleGlobalError = (event: ErrorEvent) => {
  // Only suppress very specific console error messages that don't affect OAuth functionality
  if (event.message && (
    event.message.includes('message channel closed') ||
    event.message.includes('listener indicated an asynchronous response') ||
    event.message.includes('chrome-extension://') ||
    event.message.includes('moz-extension://') ||
    // Only suppress specific Cross-Origin-Opener-Policy errors
    event.message.includes('Cross-Origin-Opener-Policy policy would block the window.opener call') ||
    event.message.includes('cb=gapi.loaded_0') ||
    // Only suppress specific blocked API discovery errors
    event.message.includes('Discovery.GetDiscoveryRest are blocked')
  )) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  // Suppress browser extension and Google API promise rejections
  const reason = event.reason;
  if (reason && (
    (typeof reason === 'string' && (
      reason.includes('message channel closed') ||
      reason.includes('listener indicated an asynchronous response') ||
      reason.includes('Could not establish connection') ||
      reason.includes('Receiving end does not exist') ||
      reason.includes('Cross-Origin-Opener-Policy') ||
      reason.includes('window.opener call')
    )) ||
    (reason instanceof Error && (
      reason.message.includes('message channel closed') ||
      reason.message.includes('listener indicated an asynchronous response') ||
      reason.message.includes('Could not establish connection') ||
      reason.message.includes('Receiving end does not exist') ||
      reason.message.includes('Cross-Origin-Opener-Policy') ||
      reason.message.includes('window.opener call')
    ))
  )) {
    event.preventDefault();
    return false;
  }
};

// Install global error handlers as early as possible
window.addEventListener('error', handleGlobalError, true); // Use capture phase
window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
