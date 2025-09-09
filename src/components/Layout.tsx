import React from 'react';
import { Outlet } from 'react-router-dom';
import { StoreSelector } from './StoreSelector';
import { Navigation } from './Navigation';
import { Button } from './ui/button';
import { User, Bell, Menu } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

export const Layout: React.FC = () => {
  const { state } = useApp();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="py-6 space-y-6">
                  <StoreSelector />
                  <Navigation />
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-hero flex items-center justify-center">
                <span className="text-white font-bold">BN</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">Bella Napoli</h1>
                <p className="text-xs text-muted-foreground">Sistema Multi-loja</p>
              </div>
            </div>
          </div>

          {/* Desktop Store Selector */}
          <div className="hidden md:block">
            <StoreSelector />
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full text-xs"></span>
            </Button>
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
            {state.currentUser && (
              <div className="hidden sm:block text-sm">
                <p className="font-medium">{state.currentUser.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{state.currentUser.role}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r border-border bg-muted/20">
          <div className="p-6 space-y-6">
            <Navigation />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="container px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};