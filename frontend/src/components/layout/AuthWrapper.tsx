'use client';

import React from 'react';
import { AuthProvider, useAuth } from '../../hooks/useAuth';
import LoginPage from '../../app/login/page';
import Loader from '../ui/Loader';

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthContent({ children }: AuthWrapperProps) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200">
        <Loader variant="ring" text="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <AuthProvider>
      <AuthContent>{children}</AuthContent>
    </AuthProvider>
  );
}

