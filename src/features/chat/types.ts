export interface ChatProfile {
  id: string;
  nickname: string;
  city: string;
  state: string;
}
export interface ChatMessage {
  id: string;
  author: ChatProfile;
  text: string;
  at: string;
}
export interface ChatLocation {
  code: string;
  name: string;
  municipalities: { code: string; name: string }[];
}
