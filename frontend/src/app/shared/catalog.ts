// Choices the admin product form offers
export const SECTIONS = ['Women', 'Men', 'Kids'];

export const CATEGORIES = ['Kurta Sets', 'Sarees', 'Dresses', 'Tops', 'Jeans', 'Shirts',
                           'Kurtas', 'T-Shirts', 'Trousers', 'Kidswear', 'Jewellery', 'Bags'];

// The size chips; anything else (28, 4-5Y...) goes in the "More sizes" box
export const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

// Same rule as the "Only 3 left" tag in the store and the dashboard
export const LOW_STOCK_BELOW = 5;

// Text and colour name for a stock number: "In stock" (ok), "Only 3 left" (low), "Sold out" (out)
export function stockLook(stock: number): { label: string; tone: 'ok' | 'low' | 'out' } {
  if (stock === 0) return { label: 'Sold out', tone: 'out' };
  if (stock < LOW_STOCK_BELOW) return { label: `Only ${stock} left`, tone: 'low' };
  return { label: 'In stock', tone: 'ok' };
}