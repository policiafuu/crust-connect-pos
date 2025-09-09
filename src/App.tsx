import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { PDV } from "@/pages/PDV";
import { Ecommerce } from "@/pages/Ecommerce";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="pdv" element={<PDV />} />
              <Route path="ecommerce" element={<Ecommerce />} />
              {/* Outras rotas serão adicionadas posteriormente */}
              <Route path="products" element={<div className="p-8 text-center">Produtos - Em desenvolvimento</div>} />
              <Route path="orders" element={<div className="p-8 text-center">Pedidos - Em desenvolvimento</div>} />
              <Route path="customers" element={<div className="p-8 text-center">Clientes - Em desenvolvimento</div>} />
              <Route path="admin" element={<div className="p-8 text-center">Admin - Em desenvolvimento</div>} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
