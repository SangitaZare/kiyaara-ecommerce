// What POST api/assistant/chat sends and returns

// One product the assistant mentioned, drawn as a card under its reply
export interface ProductCard {
  id: number;
  name: string;
  brand: string;
  imageUrl: string;
  price: number;
  mrp: number;
  rating: number;
  inStock: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  products?: ProductCard[];      // assistant replies only; never sent back to the API
}

export interface ChatRequest {
  messages: { role: 'user' | 'assistant'; text: string }[];
}

export interface ChatResponse {
  reply: string;
  products: ProductCard[];
}
