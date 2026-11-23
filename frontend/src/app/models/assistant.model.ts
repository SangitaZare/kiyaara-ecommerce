// What POST api/assistant/chat sends and returns

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}
