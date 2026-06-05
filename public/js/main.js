import { ApiService } from './api.js';
import { AuthUI } from './auth.js';
import { QuestionsUI } from './questions.js';

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize API Service
  const api = new ApiService();

  // 2. Define App-level State Transitions
  const handleLogout = () => {
    api.removeToken();
    authUI.show();
  };

  const handleLogin = () => {
    questionsUI.show();
  };

  // 3. Initialize UI Managers
  const authUI = new AuthUI(api, handleLogin);
  const questionsUI = new QuestionsUI(api, handleLogout);

  // 4. Attach Global Header Listeners
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // 5. Bootstrap the App based on Token status
  if (api.getToken()) {
    handleLogin();
  } else {
    authUI.show();
  }
});