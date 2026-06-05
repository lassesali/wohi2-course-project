import { CONFIG } from './config.js';

export class AuthUI {
  constructor(apiService, onLoginSuccess) {
    this.api = apiService;
    this.onLoginSuccess = onLoginSuccess;
    this.container = document.getElementById("auth-section");
    this.isRegisterMode = false;
  }

  show() {
    document.getElementById("app-section").classList.add("d-none");
    document.getElementById("logout-btn").classList.add("d-none");
    this.container.classList.remove("d-none");
    this.render();
  }

  render() {
    const fields = this.isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
    const title = this.isRegisterMode ? "Sign Up" : "Log In";
    const switchText = this.isRegisterMode
      ? 'Already have an account? <a href="#" id="switch-mode" class="text-warning text-decoration-none">Log in</a>'
      : 'Don\'t have an account? <a href="#" id="switch-mode" class="text-warning text-decoration-none">Sign up</a>';

    this.container.innerHTML = `
      <div class="card shadow-lg mx-auto" style="max-width: 400px; margin-top: 5rem;">
        <div class="card-body p-4">
          <h3 class="text-center text-warning fw-bold mb-4">${title}</h3>
          <form id="auth-form">
            ${fields.map(f => {
              const type = f === "password" ? "password" : f === "email" ? "email" : "text";
              const label = f.charAt(0).toUpperCase() + f.slice(1);
              return `
                <div class="mb-3">
                  <label for="${f}" class="form-label text-muted small text-uppercase">${label}</label>
                  <input type="${type}" id="${f}" class="form-control bg-dark text-light border-0" required />
                </div>`;
            }).join("")}

            ${this.isRegisterMode ? `
              <div id="recaptcha-container" class="d-flex justify-content-center mt-3 mb-3"></div>
            ` : ""}

            <button type="submit" class="btn btn-warning w-100 fw-bold mt-4">${title}</button>
          </form>
          <p class="text-center mt-4 small text-muted">${switchText}</p>
          <div id="auth-error" class="text-danger text-center fw-bold small mt-2"></div>
        </div>
      </div>
    `;

    // Explicitly tell Google to render the widget when switching to Register mode
    if (this.isRegisterMode && typeof grecaptcha !== "undefined") {
      grecaptcha.render('recaptcha-container', {
        'sitekey': '6Lej_w0tAAAAACqs-pgeBWJ225EJxik4iFUQ7GYT'
      });
    }

    document.getElementById("auth-form").addEventListener("submit", (e) => this.handleAuth(e));
    document.getElementById("switch-mode").addEventListener("click", (e) => {
      e.preventDefault();
      this.isRegisterMode = !this.isRegisterMode;
      this.render();
    });
  }

  async handleAuth(e) {
    e.preventDefault();

    const errorEl = document.getElementById("auth-error");
    errorEl.textContent = "";

    const fields = this.isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
    const route = this.isRegisterMode ? CONFIG.ROUTES.REGISTER : CONFIG.ROUTES.LOGIN;
    const body = {};
    
    fields.forEach((f) => {
      body[f] = document.getElementById(f).value;
    });

    if (this.isRegisterMode) {
      const recaptchaToken = grecaptcha.getResponse();

      if (!recaptchaToken) {
        alert("Please check the 'I am not a robot' box.");
        return;
      }

      body.recaptchaToken = recaptchaToken;
    }
    
    try {
      const data = await this.api.fetch(route, {
        method: "POST",
        body: JSON.stringify(body),
      });
      this.api.setToken(data.token);
      this.onLoginSuccess();
    } catch (err) {
      errorEl.textContent = err.message;

      // If registration fails (e.g. email taken), reset the captcha so they can try again!
      if (this.isRegisterMode && typeof grecaptcha !== "undefined") {
        grecaptcha.reset();
      }
    }
  }
}
