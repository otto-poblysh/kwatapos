import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity?: number;
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  activeOrderId: string | null;
  activeOrderName: string | null;
  setActiveOrder: (
    orderId: string | null,
    orderName: string | null,
    items?: CartItem[]
  ) => void;
  clearActiveOrder: () => void;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  clearCart: () => void;
  totalPrice: () => number;
  totalAmount: () => number;
  totalItems: () => number;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  activeOrderId: null,
  activeOrderName: null,

  setActiveOrder: (orderId, orderName, items) => {
    set({
      activeOrderId: orderId,
      activeOrderName: orderName,
      items: items ?? [],
    });
  },

  clearActiveOrder: () => {
    set({
      activeOrderId: null,
      activeOrderName: null,
      items: [],
    });
  },

  addItem: (product: Product) => {
    const itemProduct = {
      ...product,
      price: typeof product.price === 'string' ? parseFloat(product.price) : Number(product.price),
    };
    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => item.product.id === itemProduct.id
      );

      if (existingIndex > -1) {
        const updatedItems = [...state.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + 1,
        };
        return { items: updatedItems };
      }

      return {
        items: [...state.items, { product: itemProduct, quantity: 1 }],
      };
    });
  },

  decrementItem: (productId: string) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => item.product.id === productId
      );

      if (existingIndex === -1) {
        return state;
      }

      const currentItem = state.items[existingIndex];
      if (currentItem.quantity <= 1) {
        return {
          items: state.items.filter((item) => item.product.id !== productId),
        };
      }

      const updatedItems = [...state.items];
      updatedItems[existingIndex] = {
        ...currentItem,
        quantity: currentItem.quantity - 1,
      };
      return { items: updatedItems };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  totalPrice: () => {
    return get().items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  },

  totalAmount: () => {
    return get().totalPrice();
  },

  totalItems: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getTotalPrice: () => {
    return get().totalPrice();
  },

  getTotalItems: () => {
    return get().totalItems();
  },
}));
