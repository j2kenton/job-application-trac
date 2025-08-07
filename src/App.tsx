import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { MainApp } from './components/MainApp';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="bottom-right" />
    </AuthProvider>
  );
}

export default App
