// Update this page (the content is just a fallback if you fail to update the page)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Store, Globe, ShoppingCart, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-delivery-light/10">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-hero text-white shadow-elevated">
              <Store className="h-6 w-6" />
              <span className="font-bold text-lg">Bella Napoli Multi-Store</span>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-delivery to-premium bg-clip-text text-transparent">
            Sistema PDV + E-commerce
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Plataforma SaaS completa para pizzarias com PDV integrado, e-commerce online, 
            distribuição inteligente de pedidos e gestão multi-loja.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="hero" size="xl">
              <Link to="/dashboard">
                <TrendingUp className="h-5 w-5 mr-2" />
                Acessar Dashboard
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="xl">
              <Link to="/pdv">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Abrir PDV
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="shadow-card hover:shadow-elevated transition-smooth">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <CardTitle>PDV Completo</CardTitle>
              <CardDescription>
                Sistema de ponto de venda com impressão térmica, gestão de comandas e controle de estoque
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="pdv" size="sm" className="w-full">
                <Link to="/pdv">Usar PDV</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-smooth">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-delivery rounded-lg flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <CardTitle>E-commerce Online</CardTitle>
              <CardDescription>
                Loja online sincronizada com PDV, pedidos delivery e integração com marketplaces
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="delivery" size="sm" className="w-full">
                <Link to="/ecommerce">Ver Loja Online</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-smooth">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-premium rounded-lg flex items-center justify-center mb-4">
                <Store className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Multi-loja SaaS</CardTitle>
              <CardDescription>
                Gestão de múltiplas pizzarias, relatórios consolidados e distribuição inteligente de pedidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="premium" size="sm" className="w-full">
                <Link to="/admin">Painel Admin</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Demo Notice */}
        <div className="text-center">
          <Card className="inline-block shadow-card border-2 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-primary mb-2">
                <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
                <span className="font-semibold">Demo em Tempo Real</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Esta é uma demonstração completa com dados fictícios. 
                Todas as funcionalidades estão operacionais para testes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
