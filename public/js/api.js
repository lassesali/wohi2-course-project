import { CONFIG } from './config.js';

export class ApiService {
  getToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEY);
  }

  setToken(token) {
    localStorage.setItem(CONFIG.STORAGE_KEY, token);
  }

  removeToken() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  }

  getCurrentUserId() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.userId;
    } catch {
      return null;
    }
  }

  async fetch(route, options = {}) {
    const token = this.getToken();
    const isFormData = options.body instanceof FormData;
    const headers = { ...options.headers };
    
    if (!isFormData) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    //console.log(`${CONFIG.API_URL}${route}`);
    //console.log(options);
    //console.log(headers);
    
    const res = await fetch(`${CONFIG.API_URL}${route}`, { ...options, headers });
    const data = await res.json();
    
    // console.log(data);


    if (!res.ok) throw new Error(data.error || data.msg || "Request failed");
    return data;
  }

  async getRandomQuestions() {
    return await this.fetch(`${CONFIG.ROUTES.QUESTIONS}/random`);
  }
  
}