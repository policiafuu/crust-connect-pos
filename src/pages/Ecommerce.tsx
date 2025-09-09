import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  ShoppingBag, 
  Star, 
  Heart,
  Search,
  Filter,
  Plus,
  MapPin,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { mockProducts, findStoreByZipCode } from '@/data/mockData';

export const Ecommerce: React.FC = () => {
  const { state, dispatch } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerZipCode, setCustomerZipCode] = useState('');
  const [selectedStore, setSelectedStore] = useState(state.currentStore);

  const categories = [
    { id: 'all', name: 'Todos' },
    { id: 'pizza', name: 'Pizzas' },
    { id: 'bebida', name: 'Bebidas' },
    { id: 'sobremesa', name: 'Sobremesas' },
  ];

  const filteredProducts = mockProducts.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const isAvailableOnline = product.showOnWebsite && product.isActive;
    return matchesCategory && matchesSearch && isAvailableOnline;
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

  const handleZipCodeCheck = () => {
    if (customerZipCode) {
      const store = findStoreByZipCode(customerZipCode);
      if (store) {
        setSelectedStore(store);
      } else {
        alert('CEP não atendido. Utilizando loja padrão.');
      }
    }
  };

  const getTotalAmount = () => {
    return state.cart.reduce((total, item) => total + item.total, 0);
  };

  const getTotalItems = () => {
    return state.cart.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            E-commerce Online
          </h1>
          <p className="text-muted-foreground">
            Simulação da loja online para clientes
          </p>
        </div>
        
        <Button variant="hero" size="lg">
          <TrendingUp className="h-4 w-4 mr-2" />
          Analytics
        </Button>
      </div>

      {/* Store Locator */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-delivery" />
            Localização e Entrega
          </CardTitle>
          <CardDescription>
            Informe seu CEP para encontrar a loja mais próxima
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite seu CEP (ex: 01010-000)"
              value={customerZipCode}
              onChange={(e) => setCustomerZipCode(e.target.value)}
              className="flex-1"
            />
            <Button variant="delivery" onClick={handleZipCodeCheck}>
              Buscar
            </Button>
          </div>
          
          {selectedStore && (
            <div className="p-4 rounded-lg bg-success-light/20 border border-success/20">
              <h3 className="font-semibold text-success mb-1">{selectedStore.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{selectedStore.address}</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-success">
                  <Clock className="h-3 w-3" />
                  Entrega em 30-40 min
                </span>
                <span className="text-success font-medium">Taxa: R$ 4,90</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Categorias</h4>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>

            {/* Cart Summary */}
            {state.cart.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">Seu Pedido</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{getTotalItems()} itens</span>
                    <span>R$ {getTotalAmount().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>+ Taxa entrega</span>
                    <span>R$ 4,90</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Total</span>
                    <span className="text-success">R$ {(getTotalAmount() + 4.90).toFixed(2)}</span>
                  </div>
                </div>
                <Button variant="success" size="sm" className="w-full mt-3">
                  <ShoppingBag className="h-3 w-3 mr-2" />
                  Finalizar Pedido
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="lg:col-span-3 space-y-6">
          {/* Featured Banner */}
          <Card className="bg-gradient-delivery text-white shadow-elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Oferta Especial!</h2>
                  <p className="text-delivery-foreground/90 mb-4">
                    Pizza Margherita + Coca-Cola por apenas R$ 39,90
                  </p>
                  <Button variant="secondary" className="text-delivery">
                    Ver Oferta
                  </Button>
                </div>
                <div className="text-6xl opacity-20">🍕</div>
              </div>
            </CardContent>
          </Card>

          {/* Products */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id} 
                className="group hover:shadow-elevated transition-smooth cursor-pointer overflow-hidden"
              >
                <div className="aspect-video bg-muted/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-success/20 flex items-center justify-center">
                    <span className="text-4xl opacity-50">
                      {product.category === 'pizza' ? '🍕' : 
                       product.category === 'bebida' ? '🥤' : '🍰'}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 text-white bg-black/20 hover:bg-black/40"
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
                
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Star className="h-3 w-3 fill-current" />
                      <span>4.8</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-success">
                        R$ {product.price.toFixed(2)}
                      </span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {product.preparationArea}
                      </Badge>
                    </div>
                    
                    <Button 
                      size="sm" 
                      variant="success"
                      onClick={() => addToCart(product.id)}
                      className="group-hover:shadow-success transition-smooth"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <Card className="shadow-card">
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground">
                  Tente ajustar os filtros ou termos de busca
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};