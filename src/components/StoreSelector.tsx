import React from 'react';
import { Store, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { mockStores } from '@/data/mockData';

export const StoreSelector: React.FC = () => {
  const { state, dispatch } = useApp();

  const handleStoreChange = (storeId: string) => {
    const store = mockStores.find(s => s.id === storeId);
    if (store) {
      dispatch({ type: 'SET_STORE', payload: store });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-primary" />
      <Select
        value={state.currentStore?.id || ''}
        onValueChange={handleStoreChange}
      >
        <SelectTrigger className="w-[280px] bg-card border-border">
          <SelectValue placeholder="Selecione uma loja" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {mockStores.map((store) => (
            <SelectItem 
              key={store.id} 
              value={store.id}
              className="hover:bg-accent"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{store.name}</span>
                <span className="text-xs text-muted-foreground">{store.address}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};