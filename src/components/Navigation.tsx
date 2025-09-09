import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Store, 
  Globe, 
  Settings, 
  Users,
  Package,
  TrendingUp 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationProps {
  className?: string;
}

const navigationItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Visão geral das vendas'
  },
  {
    title: 'PDV',
    href: '/pdv',
    icon: ShoppingCart,
    description: 'Ponto de venda'
  },
  {
    title: 'E-commerce',
    href: '/ecommerce',
    icon: Globe,
    description: 'Loja online'
  },
  {
    title: 'Produtos',
    href: '/products',
    icon: Package,
    description: 'Gerenciar cardápio'
  },
  {
    title: 'Pedidos',
    href: '/orders',
    icon: TrendingUp,
    description: 'Acompanhar pedidos'
  },
  {
    title: 'Clientes',
    href: '/customers',
    icon: Users,
    description: 'Base de clientes'
  },
  {
    title: 'Admin',
    href: '/admin',
    icon: Settings,
    description: 'Configurações'
  },
];

export const Navigation: React.FC<NavigationProps> = ({ className }) => {
  return (
    <nav className={cn('space-y-2', className)}>
      {navigationItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-smooth',
              'hover:bg-accent hover:text-accent-foreground',
              isActive
                ? 'bg-primary text-primary-foreground shadow-primary'
                : 'text-muted-foreground'
            )
          }
        >
          <item.icon className="h-4 w-4" />
          <div className="flex flex-col">
            <span>{item.title}</span>
            <span className="text-xs opacity-70">{item.description}</span>
          </div>
        </NavLink>
      ))}
    </nav>
  );
};