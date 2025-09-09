import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  DollarSign, 
  Pizza,
  Clock,
  MapPin,
  Star
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const Dashboard: React.FC = () => {
  const { state } = useApp();

  // Mock data para o dashboard
  const stats = {
    todaySales: 2847.50,
    todayOrders: 23,
    activeCustomers: 156,
    avgOrderValue: 123.80,
    pendingOrders: 5,
    preparingOrders: 3,
    readyOrders: 2,
  };

  const recentOrders = [
    { id: '#001', customer: 'João Silva', total: 45.90, status: 'preparing', time: '10min' },
    { id: '#002', customer: 'Maria Santos', total: 67.80, status: 'ready', time: '5min' },
    { id: '#003', customer: 'Carlos Lima', total: 89.90, status: 'pending', time: '2min' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-delivery';
      case 'preparing': return 'text-primary';
      case 'ready': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Pronto';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo ao {state.currentStore?.name || 'Bella Napoli'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Clock className="h-4 w-4 mr-2" />
            Hoje
          </Button>
          <Button variant="hero">
            <TrendingUp className="h-4 w-4 mr-2" />
            Relatórios
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card hover:shadow-elevated transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {stats.todaySales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">+12% em relação a ontem</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-elevated transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Hoje</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.todayOrders}</div>
            <p className="text-xs text-muted-foreground">+8% em relação a ontem</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-elevated transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-delivery" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-delivery">{stats.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">+23 novos este mês</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-elevated transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Pizza className="h-4 w-4 text-premium" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-premium">
              R$ {stats.avgOrderValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">+5% em relação ao mês passado</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders and Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Orders */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
            <CardDescription>Últimos pedidos recebidos hoje</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-smooth"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {order.customer.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{order.customer}</p>
                    <p className="text-xs text-muted-foreground">{order.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">R$ {order.total.toFixed(2)}</p>
                  <p className={`text-xs ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)} • {order.time}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Acesso rápido às funcionalidades principais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="pdv" className="w-full justify-start" size="lg">
              <ShoppingCart className="h-5 w-5 mr-3" />
              Abrir PDV
            </Button>
            <Button variant="success" className="w-full justify-start" size="lg">
              <Pizza className="h-5 w-5 mr-3" />
              Gerenciar Cardápio
            </Button>
            <Button variant="delivery" className="w-full justify-start" size="lg">
              <MapPin className="h-5 w-5 mr-3" />
              Pedidos Delivery
            </Button>
            <Button variant="premium" className="w-full justify-start" size="lg">
              <Star className="h-5 w-5 mr-3" />
              Programa Fidelidade
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Order Status Overview */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Status dos Pedidos</CardTitle>
          <CardDescription>Acompanhe o fluxo de pedidos em tempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-delivery-light/20 border border-delivery/20">
              <div className="text-2xl font-bold text-delivery">{stats.pendingOrders}</div>
              <p className="text-sm text-delivery">Pendentes</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary-light/20 border border-primary/20">
              <div className="text-2xl font-bold text-primary">{stats.preparingOrders}</div>
              <p className="text-sm text-primary">Preparando</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-success-light/20 border border-success/20">
              <div className="text-2xl font-bold text-success">{stats.readyOrders}</div>
              <p className="text-sm text-success">Prontos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};