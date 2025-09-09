// Dados mockados para o sistema PDV + E-commerce Multi-loja

export interface Store {
  id: string;
  name: string;
  address: string;
  cep: string;
  phone: string;
  city: string;
  state: string;
  coverageAreas: string[];
  isActive: boolean;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  category: 'pizza' | 'bebida' | 'sobremesa' | 'adicional';
  image: string;
  isActive: boolean;
  showOnWebsite: boolean;
  preparationArea: 'cozinha' | 'bar' | 'balcao';
}

export interface Order {
  id: string;
  storeId: string;
  customerId?: string;
  type: 'balcao' | 'mesa' | 'delivery';
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  createdAt: Date;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  tableNumber?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  cep: string;
  city: string;
  loyaltyPoints: number;
  totalOrders: number;
  createdAt: Date;
}

export interface User {
  id: string;
  storeId: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'waiter';
  isActive: boolean;
}

export interface CEPData {
  cep: string;
  district: string;
  city: string;
  state: string;
  storeId: string;
  deliveryFee: number;
  estimatedTime: number;
}

// Mock Stores
export const mockStores: Store[] = [
  {
    id: '1',
    name: 'Pizzaria Bella Napoli - Centro',
    address: 'Rua das Flores, 123',
    cep: '01010-000',
    phone: '(11) 3333-4444',
    city: 'São Paulo',
    state: 'SP',
    coverageAreas: ['01000-000', '01100-000', '01200-000'],
    isActive: true,
  },
  {
    id: '2',
    name: 'Pizzaria Bella Napoli - Vila Madalena',
    address: 'Rua Harmonia, 456',
    cep: '05435-000',
    phone: '(11) 2222-3333',
    city: 'São Paulo',
    state: 'SP',
    coverageAreas: ['05400-000', '05500-000', '05600-000'],
    isActive: true,
  },
];

// Mock Products
export const mockProducts: Product[] = [
  {
    id: '1',
    storeId: '1',
    name: 'Pizza Margherita',
    description: 'Molho de tomate, mussarela e manjericão fresco',
    price: 35.90,
    category: 'pizza',
    image: '/api/placeholder/300/200',
    isActive: true,
    showOnWebsite: true,
    preparationArea: 'cozinha',
  },
  {
    id: '2',
    storeId: '1',
    name: 'Pizza Portuguesa',
    description: 'Molho de tomate, mussarela, presunto, ovos, cebola e azeitona',
    price: 42.90,
    category: 'pizza',
    image: '/api/placeholder/300/200',
    isActive: true,
    showOnWebsite: true,
    preparationArea: 'cozinha',
  },
  {
    id: '3',
    storeId: '1',
    name: 'Coca-Cola 350ml',
    description: 'Refrigerante gelado',
    price: 6.90,
    category: 'bebida',
    image: '/api/placeholder/300/200',
    isActive: true,
    showOnWebsite: true,
    preparationArea: 'bar',
  },
  {
    id: '4',
    storeId: '1',
    name: 'Pudim de Leite',
    description: 'Sobremesa tradicional da casa',
    price: 8.90,
    category: 'sobremesa',
    image: '/api/placeholder/300/200',
    isActive: true,
    showOnWebsite: true,
    preparationArea: 'cozinha',
  },
];

// Mock CEP Database
export const mockCEPs: CEPData[] = [
  {
    cep: '01010-000',
    district: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    storeId: '1',
    deliveryFee: 3.90,
    estimatedTime: 30,
  },
  {
    cep: '01100-000',
    district: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    storeId: '1',
    deliveryFee: 4.90,
    estimatedTime: 35,
  },
  {
    cep: '05435-000',
    district: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    storeId: '2',
    deliveryFee: 5.90,
    estimatedTime: 25,
  },
  {
    cep: '05500-000',
    district: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    storeId: '2',
    deliveryFee: 4.90,
    estimatedTime: 30,
  },
];

// Mock Orders
export const mockOrders: Order[] = [
  {
    id: '1',
    storeId: '1',
    customerId: '1',
    type: 'delivery',
    status: 'preparing',
    items: [
      {
        productId: '1',
        productName: 'Pizza Margherita',
        quantity: 1,
        unitPrice: 35.90,
        total: 35.90,
      },
      {
        productId: '3',
        productName: 'Coca-Cola 350ml',
        quantity: 2,
        unitPrice: 6.90,
        total: 13.80,
      },
    ],
    subtotal: 49.70,
    deliveryFee: 3.90,
    discount: 0,
    total: 53.60,
    createdAt: new Date(),
    customerName: 'João Silva',
    customerPhone: '(11) 99999-8888',
    deliveryAddress: 'Rua das Flores, 789 - Sé',
  },
];

// Mock Customers
export const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '(11) 99999-8888',
    address: 'Rua das Flores, 789',
    cep: '01010-000',
    city: 'São Paulo',
    loyaltyPoints: 150,
    totalOrders: 5,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Maria Santos',
    email: 'maria@email.com',
    phone: '(11) 88888-7777',
    address: 'Av. Paulista, 1000',
    cep: '01100-000',
    city: 'São Paulo',
    loyaltyPoints: 320,
    totalOrders: 12,
    createdAt: new Date('2023-11-20'),
  },
];

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    storeId: '1',
    name: 'Admin Master',
    email: 'admin@bellanapoli.com',
    role: 'admin',
    isActive: true,
  },
  {
    id: '2',
    storeId: '1',
    name: 'Carlos Gerente',
    email: 'carlos@bellanapoli.com',
    role: 'manager',
    isActive: true,
  },
  {
    id: '3',
    storeId: '1',
    name: 'Ana Caixa',
    email: 'ana@bellanapoli.com',
    role: 'cashier',
    isActive: true,
  },
];

// Função para buscar loja por CEP
export const findStoreByZipCode = (zipCode: string): Store | null => {
  const cepData = mockCEPs.find(cep => cep.cep === zipCode);
  if (cepData) {
    return mockStores.find(store => store.id === cepData.storeId) || null;
  }
  return null;
};

// Função para calcular taxa de entrega
export const calculateDeliveryFee = (zipCode: string): number => {
  const cepData = mockCEPs.find(cep => cep.cep === zipCode);
  return cepData?.deliveryFee || 8.90; // Taxa padrão
};