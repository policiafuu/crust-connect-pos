import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Store, Order, Product, Customer, mockStores, mockProducts, mockOrders, mockCustomers } from '@/data/mockData';

interface AppState {
  currentStore: Store | null;
  currentUser: { id: string; name: string; role: string } | null;
  orders: Order[];
  products: Product[];
  customers: Customer[];
  cart: CartItem[];
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

type AppAction =
  | { type: 'SET_STORE'; payload: Store }
  | { type: 'SET_USER'; payload: { id: string; name: string; role: string } }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER'; payload: { id: string; updates: Partial<Order> } }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'UPDATE_CART_ITEM'; payload: { productId: string; quantity: number } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: { id: string; updates: Partial<Customer> } };

const initialState: AppState = {
  currentStore: mockStores[0],
  currentUser: null,
  orders: mockOrders,
  products: mockProducts,
  customers: mockCustomers,
  cart: [],
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_STORE':
      return { ...state, currentStore: action.payload };

    case 'SET_USER':
      return { ...state, currentUser: action.payload };

    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders] };

    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map(order =>
          order.id === action.payload.id
            ? { ...order, ...action.payload.updates }
            : order
        ),
      };

    case 'ADD_TO_CART':
      const existingItem = state.cart.find(item => item.productId === action.payload.productId);
      if (existingItem) {
        return {
          ...state,
          cart: state.cart.map(item =>
            item.productId === action.payload.productId
              ? { ...item, quantity: item.quantity + action.payload.quantity, total: (item.quantity + action.payload.quantity) * item.unitPrice }
              : item
          ),
        };
      }
      return { ...state, cart: [...state.cart, action.payload] };

    case 'UPDATE_CART_ITEM':
      return {
        ...state,
        cart: state.cart.map(item =>
          item.productId === action.payload.productId
            ? { ...item, quantity: action.payload.quantity, total: action.payload.quantity * item.unitPrice }
            : item
        ),
      };

    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(item => item.productId !== action.payload),
      };

    case 'CLEAR_CART':
      return { ...state, cart: [] };

    case 'ADD_CUSTOMER':
      return { ...state, customers: [action.payload, ...state.customers] };

    case 'UPDATE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.map(customer =>
          customer.id === action.payload.id
            ? { ...customer, ...action.payload.updates }
            : customer
        ),
      };

    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser usado dentro de AppProvider');
  }
  return context;
};