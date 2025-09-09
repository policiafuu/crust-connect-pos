import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Minus, 
  ShoppingCart, 
  Printer, 
  CreditCard,
  User,
  MapPin,
  Table,
  Clock,
  Search
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { mockProducts } from '@/data/mockData';

export const PDV: React.FC = () => {
  const { state, dispatch } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderType, setOrderType] = useState<'balcao' | 'mesa' | 'delivery'>('balcao');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { id: 'all', name: 'Todos', count: mockProducts.length },
    { id: 'pizza', name: 'Pizzas', count: mockProducts.filter(p => p.category === 'pizza').length },
    { id: 'bebida', name: 'Bebidas', count: mockProducts.filter(p => p.category === 'bebida').length },
    { id: 'sobremesa', name: 'Sobremesas', count: mockProducts.filter(p => p.category === 'sobremesa').length },
  ];

  const filteredProducts = mockProducts.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStore = product.storeId === state.currentStore?.id;
    return matchesCategory && matchesSearch && matchesStore && product.isActive;
  });

  const addToCart = (productId: string) => {
    const product = mockProducts.find(p => p.id === productId);
    if (product) {
      dispatch({
        type: 'ADD_TO_CART',
        payload: {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          total: product.price,
        },
      });
    }
  };

  const updateCartItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: productId });
    } else {
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { productId, quantity } });
    }
  };

  const getTotalAmount = () => {
    return state.cart.reduce((total, item) => total + item.total, 0);
  };

  const getTotalItems = () => {
    return state.cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleCheckout = () => {
    // Simular finalização do pedido
    const newOrder = {
      id: Date.now().toString(),
      storeId: state.currentStore?.id || '1',
      type: orderType,
      status: 'pending' as const,
      items: state.cart,
      subtotal: getTotalAmount(),
      deliveryFee: orderType === 'delivery' ? 5.90 : 0,
      discount: 0,
      total: getTotalAmount() + (orderType === 'delivery' ? 5.90 : 0),
      createdAt: new Date(),
      customerName: 'Cliente Balcão',
    };

    dispatch({ type: 'ADD_ORDER', payload: newOrder });
    dispatch({ type: 'CLEAR_CART' });
    
    // Simular impressão
    console.log('Imprimindo pedido:', newOrder);
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'balcao': return ShoppingCart;
      case 'mesa': return Table;
      case 'delivery': return MapPin;
      default: return ShoppingCart;
    }
  };

  const getOrderTypeColor = (type: string) => {
    switch (type) {
      case 'balcao': return 'success';
      case 'mesa': return 'primary';
      case 'delivery': return 'delivery';
      default: return 'success';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      {/* Products Section */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PDV - Ponto de Venda</h1>
            <p className="text-muted-foreground">
              Loja: {state.currentStore?.name}
            </p>
          </div>
          
          {/* Order Type Selector */}
          <div className="flex gap-2">
            {(['balcao', 'mesa', 'delivery'] as const).map((type) => {
              const Icon = getOrderTypeIcon(type);
              const color = getOrderTypeColor(type);
              return (
                <Button
                  key={type}
                  variant={orderType === type ? color as any : 'outline'}
                  size="sm"
                  onClick={() => setOrderType(type)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {type === 'balcao' ? 'Balcão' : type === 'mesa' ? 'Mesa' : 'Delivery'}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="whitespace-nowrap"
            >
              {category.name} ({category.count})
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[50vh]">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id} 
              className="cursor-pointer hover:shadow-card transition-smooth"
              onClick={() => addToCart(product.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{product.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {product.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-success">
                    R$ {product.price.toFixed(2)}
                  </span>
                  <Button size="sm" variant="success">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className="space-y-6">
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedido Atual
            </CardTitle>
            <CardDescription>
              {getTotalItems()} {getTotalItems() === 1 ? 'item' : 'itens'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Carrinho vazio</p>
                <p className="text-xs">Adicione produtos para começar</p>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {state.cart.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.productName}</h4>
                        <p className="text-xs text-muted-foreground">
                          R$ {item.unitPrice.toFixed(2)} cada
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-medium text-sm">R$ {item.total.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Summary */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>R$ {getTotalAmount().toFixed(2)}</span>
                  </div>
                  {orderType === 'delivery' && (
                    <div className="flex justify-between text-sm">
                      <span>Taxa de entrega</span>
                      <span>R$ 5,90</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-success">
                      R$ {(getTotalAmount() + (orderType === 'delivery' ? 5.90 : 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button 
                    variant="success" 
                    className="w-full" 
                    size="lg"
                    onClick={handleCheckout}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Finalizar Pedido
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => dispatch({ type: 'CLEAR_CART' })}
                  >
                    Limpar Carrinho
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Printer className="h-4 w-4 mr-2" />
              Reimprimir Último
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <User className="h-4 w-4 mr-2" />
              Cadastrar Cliente
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Clock className="h-4 w-4 mr-2" />
              Pedidos Pendentes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};