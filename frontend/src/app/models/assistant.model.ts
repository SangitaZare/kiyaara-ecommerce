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
  streaming?: boolean;           // true while the reply is still arriving
}

// One Server-Sent Event from POST api/assistant/chat/stream
export type ChatStreamEvent =
  | { type: 'status'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: string; products: ProductCard[] }
  | { type: 'error'; message: string };

export interface ChatRequest {
  messages: { role: 'user' | 'assistant'; text: string }[];
}

export interface ChatResponse {
  reply: string;
  products: ProductCard[];
}
