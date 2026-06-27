export interface UserOut {
  id: string;
  email: string;
  username: string;
  nombre: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
