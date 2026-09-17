import { useCartStore, Product } from './cartStore';

describe('useCartStore', () => {
  const mockProduct1: Product = {
    id: 'p1',
    name: 'Castel Beer',
    price: 1000,
    category: 'Beer',
    quantity: 20,
  };

  const mockProduct2: Product = {
    id: 'p2',
    name: 'Guinness Foreign Extra',
    price: 1500,
    category: 'Stout',
    quantity: 15,
  };

  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('adds an item with quantity 1 when added for the first time', () => {
    useCartStore.getState().addItem(mockProduct1);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      product: mockProduct1,
      quantity: 1,
    });
  });

  it('increments quantity when adding an existing item', () => {
    useCartStore.getState().addItem(mockProduct1);
    useCartStore.getState().addItem(mockProduct1);

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('decrements item quantity when decrementItem is called', () => {
    useCartStore.getState().addItem(mockProduct1);
    useCartStore.getState().addItem(mockProduct1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);

    useCartStore.getState().decrementItem(mockProduct1.id);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it('removes item when quantity reaches 0 upon decrement', () => {
    useCartStore.getState().addItem(mockProduct1);
    expect(useCartStore.getState().items).toHaveLength(1);

    useCartStore.getState().decrementItem(mockProduct1.id);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('removes item directly via removeItem', () => {
    useCartStore.getState().addItem(mockProduct1);
    useCartStore.getState().addItem(mockProduct2);
    expect(useCartStore.getState().items).toHaveLength(2);

    useCartStore.getState().removeItem(mockProduct1.id);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].product.id).toBe(mockProduct2.id);
  });

  it('clears all items in the cart', () => {
    useCartStore.getState().addItem(mockProduct1);
    useCartStore.getState().addItem(mockProduct2);
    expect(useCartStore.getState().items).toHaveLength(2);

    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('calculates total price and total items count accurately', () => {
    useCartStore.getState().addItem(mockProduct1); // 1000 * 1
    useCartStore.getState().addItem(mockProduct1); // 1000 * 2 = 2000
    useCartStore.getState().addItem(mockProduct2); // 1500 * 1 = 1500

    expect(useCartStore.getState().totalItems()).toBe(3);
    expect(useCartStore.getState().totalPrice()).toBe(3500);
    expect(useCartStore.getState().totalAmount()).toBe(3500);
    expect(useCartStore.getState().getTotalItems()).toBe(3);
    expect(useCartStore.getState().getTotalPrice()).toBe(3500);
  });

  it('initializes with activeOrderId and activeOrderName as null', () => {
    expect(useCartStore.getState().activeOrderId).toBeNull();
    expect(useCartStore.getState().activeOrderName).toBeNull();
  });

  it('sets active order details and items via setActiveOrder', () => {
    useCartStore.getState().setActiveOrder('order-123', 'Table 4', [
      { product: mockProduct1, quantity: 2 },
    ]);

    expect(useCartStore.getState().activeOrderId).toBe('order-123');
    expect(useCartStore.getState().activeOrderName).toBe('Table 4');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]).toEqual({
      product: mockProduct1,
      quantity: 2,
    });
    expect(useCartStore.getState().totalPrice()).toBe(2000);
  });

  it('clears active order and resets items via clearActiveOrder', () => {
    useCartStore.getState().setActiveOrder('order-123', 'Table 4', [
      { product: mockProduct1, quantity: 2 },
    ]);

    expect(useCartStore.getState().activeOrderId).toBe('order-123');
    expect(useCartStore.getState().items).toHaveLength(1);

    useCartStore.getState().clearActiveOrder();

    expect(useCartStore.getState().activeOrderId).toBeNull();
    expect(useCartStore.getState().activeOrderName).toBeNull();
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
