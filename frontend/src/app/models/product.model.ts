export interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  gender: string;        // 'Women' | 'Men' | 'Kids'
  description: string;
  imageUrl: string;
  price: number;         // selling price
  mrp: number;           // price before discount
  stock: number;
  sizes: string[];
  rating: number;
  ratingCount: number;
  createdAt: string;
}

// What the admin product form sends to POST and PUT /api/products
export interface ProductSave {
  name: string;
  brand: string;
  category: string;
  gender: string;
  description: string;
  imageUrl: string;
  price: number;
  mrp: number;
  stock: number;
  sizes: string[];
}

// What POST /api/products/photo answers, e.g. { url: '/uploads/products/3f9c2a7e.jpg' }
export interface PhotoUpload {
  url: string;
}