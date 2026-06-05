import { CONFIG } from './config.js';

export class QuestionsUI {
  constructor(apiService, onLogoutRequired) {
    this.api = apiService;
    this.onLogoutRequired = onLogoutRequired;
    this.container = document.getElementById("questions-container");

    // Pull from sessionStorage, or use defaults if nothing is saved
    this.currentKeyword = sessionStorage.getItem("savedKeyword") || ""; 
    this.currentPage = parseInt(sessionStorage.getItem("savedPage")) || 1;

  }

  show() {
    document.getElementById("auth-section").classList.add("d-none");
    document.getElementById("logout-btn").classList.remove("d-none");
    document.getElementById("app-section").classList.remove("d-none");
    this.loadQuestions();
  }

  async loadRandomQuestions(useSaved = false) {
    // Clear out any existing search keywords from memory
    this.currentKeyword = "";
    sessionStorage.removeItem("savedKeyword");
    
    this.container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-success" role="status"></div></div>';

    try {
      let questions;
      if (useSaved) {
        questions = JSON.parse(sessionStorage.getItem('savedQuestions') || "[]");
      } else {
        this.currentKeyword = "";
        sessionStorage.removeItem("savedKeyword");

        // 1. Fetch the array of random questions directly
        questions = await this.api.getRandomQuestions();
        sessionStorage.setItem('savedQuestions', JSON.stringify(questions));
        sessionStorage.setItem('isRandomMode', 'true');
      }

      const currentUserId = this.api.getCurrentUserId();
      const solvedCount = questions.filter(q => q[CONFIG.API_FIELDS.SOLVED]).length;

      // 2. Build the top interface (Notice I changed the stats to reflect a "Random Play" mode)
      let html = `
        <div class="row g-3 mb-4">
          <div class="col-12">
              <div class="stats-container d-flex justify-content-center gap-4 shadow-sm py-3">
                <div class="text-center">
                  <h3 class="text-success fw-bold mb-0">${questions.length}</h3>
                  <small class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem; letter-spacing: 1px;">Random Questions</small>
                </div>
                <div class="text-center">
                  <h3 class="text-success fw-bold mb-0">${solvedCount}/${questions.length}</h3>
                  <small class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem; letter-spacing: 1px;">Solved</small>
                </div>
              </div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <button class="btn btn-warning fw-bold px-3" id="new-question-btn">+ New Question</button>
              <button id="random-btn" class="btn btn-success">
                🎲 Roll Again!
              </button>
              <div class="search-wrapper gap-2" style="width: 280px;">
                <input type="text" id="keyword-input" class="form-control search-input" placeholder="Search by keyword..." value="">
                <button class="btn search-btn" id="search-btn">Search</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // 3. Loop over the questions using your exact same UI card structure
      if (questions.length === 0) {
        html += '<p class="text-center text-muted mt-5">No questions found. Create one!</p>';
      } else {
        html += '<div class="row g-3 mb-5">';
        html += questions.map(q => {
          const isOwner = q.userId === currentUserId;
          const keywords = q.keywords?.length ? q.keywords.map(k => `<span class="badge keyword-badge me-2">${k}</span>`).join("") : "";
          const solvedBadge = q[CONFIG.API_FIELDS.SOLVED] 
            ? `<span class="badge bg-success ms-2 align-text-top" style="font-size: 0.7rem;">Solved</span>` 
            : "";
          const solvedClass = q[CONFIG.API_FIELDS.SOLVED] ? "card-solved" : "";
          
          return `
            <div class="col-12">
              <div class="card shadow-sm p-2 mb-1 ${solvedClass}">
                <div class="card-body">
                  <h6 class="card-title text-white fw-bold mb-3" style="font-size: 1.05rem;">
                    ${q.question} ${solvedBadge}
                  </h6>
                  <div class="mb-4">${keywords}</div>
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                      <button class="btn btn-play px-4 py-1" data-id="${q.id}">PLAY</button>
                      <a href="#" class="see-answer" data-id="${q.id}">See answer</a>
                    </div>
                    ${isOwner ? `
                      <div class="btn-group gap-2">
                        <button class="btn btn-sm btn-outline-info btn-edit" data-id="${q.id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${q.id}">Delete</button>
                      </div>
                    ` : ""}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("");
        html += '</div>';
      }

      // 4. Note: I left out the pagination block because we only want 10 results!

      this.container.innerHTML = html;
      
      // 5. Re-attach the event listeners so your Play/Edit/Delete buttons still function
      this.attachListListeners("", 1);
      
      // Keep the random button working within this specific view!
      document.getElementById("random-btn").addEventListener("click", () => this.loadRandomQuestions());

    } catch (err) {
      // Used your existing error handler method
      this.handleError(err); 
    }
  }

  async loadQuestions(keyword = this.currentKeyword, page = this.currentPage) {
    // Tell the app we are no longer in random mode
    sessionStorage.removeItem('isRandomMode');
    sessionStorage.removeItem('savedQuestions');

    // To save the state
    this.currentKeyword = keyword;
    this.currentPage = page;

    // Save the exact state to the browser to survive a CTRL+R reload
    sessionStorage.setItem("savedKeyword", keyword);
    sessionStorage.setItem("savedPage", page);

    this.container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-warning" role="status"></div></div>';

    try {
      const params = new URLSearchParams({ page, limit: CONFIG.QUESTIONS_PER_PAGE });
      if (keyword) params.set("keyword", keyword);
      const result = await this.api.fetch(`${CONFIG.ROUTES.QUESTIONS}?${params}`);
      
      const { data: questions, total, totalPages } = result;
      const currentUserId = this.api.getCurrentUserId();
      const solvedCount = questions.filter(q => q[CONFIG.API_FIELDS.SOLVED]).length;

      let html = `
        <div class="row g-3 mb-4">
          <div class="col-12">
              <div class="stats-container d-flex justify-content-center gap-4 shadow-sm py-3">
                
                <div class="text-center">
                  <h3 class="text-warning fw-bold mb-0">${total}</h3>
                  <small class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem; letter-spacing: 1px;">Questions</small>
                </div>

                <div class="text-center">
                  <h3 class="text-warning fw-bold mb-0">${solvedCount}/${questions.length}</h3>
                  <small class="text-muted text-uppercase fw-bold" style="font-size: 0.65rem; letter-spacing: 1px;">Solved (This Page)</small>
                </div>

              </div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <button class="btn btn-warning fw-bold px-3" id="new-question-btn">+ New Question</button>
              <button id="random-btn" class="btn btn-success">
                🎲 Quizzes
              </button>
              <div class="search-wrapper gap-2" style="width: 280px;">
                <input type="text" id="keyword-input" class="form-control search-input" placeholder="Search by keyword..." value="${keyword}">
                <button class="btn search-btn" id="search-btn">Search</button>
                ${keyword ? `<button class="btn search-btn ms-1" id="clear-btn">X</button>` : ""}
              </div>
            </div>
          </div>
        </div>
      `;

      if (questions.length === 0) {
        html += '<p class="text-center text-muted mt-5">No questions found. Create one!</p>';
      } else {
        html += '<div class="row g-3 mb-5">';
        html += questions.map(q => {
          const isOwner = q.userId === currentUserId;
          const keywords = q.keywords?.length ? q.keywords.map(k => `<span class="badge keyword-badge me-2">${k}</span>`).join("") : "";

          // Check if solved and create the badge HTML
          const solvedBadge = q[CONFIG.API_FIELDS.SOLVED] 
            ? `<span class="badge bg-success ms-2 align-text-top" style="font-size: 0.7rem;">Solved</span>` 
            : "";
	  const solvedClass = q[CONFIG.API_FIELDS.SOLVED] ? "card-solved" : "";
          
          return `
            <div class="col-12">
              <div class="card shadow-sm p-2 mb-1 ${solvedClass}">
                <div class="card-body">
                  <h6 class="card-title text-white fw-bold mb-3" style="font-size: 1.05rem;">
                    ${q.question} ${solvedBadge}
                  </h6>
                  <div class="mb-4">${keywords}</div>
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                      <button class="btn btn-play px-4 py-1" data-id="${q.id}">PLAY</button>
                      <a href="#" class="see-answer" data-id="${q.id}">See answer</a>
                    </div>
                    ${isOwner ? `
                      <div class="btn-group gap-2">
                        <button class="btn btn-sm btn-outline-info btn-edit" data-id="${q.id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${q.id}">Delete</button>
                      </div>
                    ` : ""}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("");
        html += '</div>';
      }

      if (totalPages > 1) {
        html += `
          <div class="d-flex justify-content-center align-items-center gap-3 mt-5">
            <button class="btn btn-sm btn-outline-secondary px-3" id="prev-btn" ${page <= 1 ? "disabled" : ""}>Previous</button>
            <span class="text-muted small">Page ${page} of ${totalPages}</span>
            <button class="btn btn-sm btn-outline-secondary px-3" id="next-btn" ${page >= totalPages ? "disabled" : ""}>Next</button>
          </div>`;
      }

      this.container.innerHTML = html;
      this.attachListListeners(keyword, page);

    } catch (err) {
      this.handleError(err);
    }
  }

  attachListListeners(keyword, page) {

    const randomBtn = document.getElementById("random-btn");
    if (randomBtn) {
      randomBtn.addEventListener("click", () => this.loadRandomQuestions());
    }

    document.getElementById("new-question-btn")?.addEventListener("click", () => this.showQuestionForm());
    
    document.getElementById("search-btn")?.addEventListener("click", () => {
      this.loadQuestions(document.getElementById("keyword-input").value.trim(), 1);
    });

    //document.getElementById("clear-btn")?.addEventListener("click", () => this.loadQuestions());
    
    // To explicitly pass an empty string for the keyword and 1 for the page:
    document.getElementById("clear-btn")?.addEventListener("click", () => this.loadQuestions("", 1));

    document.getElementById("prev-btn")?.addEventListener("click", () => this.loadQuestions(keyword, page - 1));
    document.getElementById("next-btn")?.addEventListener("click", () => this.loadQuestions(keyword, page + 1));

    this.container.querySelectorAll(".btn-edit").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault(); 
        this.showQuestionForm(el.dataset.id);
      });
    });

    this.container.querySelectorAll(".btn-delete").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault(); 
        this.deleteQuestion(el.dataset.id);
      });
    });

    this.container.querySelectorAll(".btn-play").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault(); 
        this.playQuestion(el.dataset.id);
      });
    });

    this.container.querySelectorAll(".see-answer").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault(); 
        this.loadQuestionDetail(el.dataset.id);
      });
    });

  }

  async showQuestionForm(qId) {
    const isEdit = !!qId;
    let q = { question: "", answer: "", keywords: [] };

    if (isEdit) {
      try {
        q = await this.api.fetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
      } catch (err) {
        return this.handleError(err);
      }
    }

    this.container.innerHTML = `
      <button id="back-btn" class="btn btn-link text-warning text-decoration-none mb-3 px-0">
        ${isEdit ? "&larr; Back" : "&larr; Back to questions"}
      </button>
      <div class="card shadow-lg">
        <div class="card-body p-4">
          <h3 class="text-warning mb-4">${isEdit ? "Edit" : "New"} Question</h3>
          <form id="question-form">
            <div class="mb-3">
              <label class="form-label text-muted">QUESTION</label>
              <input type="text" id="q-question" class="form-control bg-dark text-light border-0" value="${q.question}" required />
            </div>
            <div class="mb-3">
              <label class="form-label text-muted">ANSWER</label> 
              <textarea id="q-answer" class="form-control bg-dark text-light border-0" rows="3" required>${q.answer}</textarea>
            </div>
            <div class="mb-3">
              <label class="form-label text-muted">KEYWORDS (COMMA-SEPARATED)</label>
              <input type="text" id="q-keywords" class="form-control bg-dark text-light border-0" value="${q.keywords ? q.keywords.join(", ") : ""}" />
            </div>
            <div class="mb-4">
              <label class="form-label text-muted">IMAGE ${isEdit ? "(OPTIONAL)" : "(OPTIONAL)"}</label>
              <input type="file" id="q-image" class="form-control bg-dark text-light border-0" accept="image/*" />
              ${isEdit && q.imageUrl ? `<img src="${q.imageUrl}" class="mt-2 rounded" style="max-height: 150px;">` : ""}
            </div>
            <button type="submit" class="btn btn-warning fw-bold px-4">${isEdit ? "Save" : "Create Question"}</button>
          </form>
          <div id="form-error" class="text-danger mt-3 fw-bold"></div>
        </div>
      </div>`;

    document.getElementById("back-btn").addEventListener("click", () => {
      if (isEdit) {
        this.loadQuestionDetail(qId); 
      } else {
        // Check mode when going back to the main list
        if (sessionStorage.getItem('isRandomMode') === 'true') {
          this.loadRandomQuestions(true);
        } else {
          this.loadQuestions(); 
        }
      }
    });

    document.getElementById("question-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = new FormData();
      body.append("question", document.getElementById("q-question").value);
      body.append("answer", document.getElementById("q-answer").value);
      body.append("keywords", document.getElementById("q-keywords").value);
      const imageFile = document.getElementById("q-image").files[0];
      if (imageFile) body.append("image", imageFile);

      try {
        if (isEdit) {
          await this.api.fetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "PUT", body });
          this.loadQuestionDetail(qId); // If it was an edit, go back to the detail view
        } else {
          await this.api.fetch(CONFIG.ROUTES.QUESTIONS, { method: "POST", body });
          this.loadQuestions(); // If it was a new question, go back to the main list
        }
      } catch (err) {
        document.getElementById("form-error").textContent = err.message;
      }
    });
  }

  async playQuestion(qId) {
    try {
      const q = await this.api.fetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

      // 1. Generate the keywords badges just like you did in the main view list
      const keywordsHtml = q.keywords?.length 
        ? `<div class="mb-4">${q.keywords.map(k => `<span class="badge keyword-badge me-2">${k}</span>`).join("")}</div>` 
        : "";

      this.container.innerHTML = `
        <button id="back-btn" class="btn btn-link text-warning text-decoration-none mb-3 px-0">&larr; Back to questions</button>
        <div class="card text-center p-5 shadow-lg">
          <div class="play-question-text mb-4">${q.question}</div>

          ${keywordsHtml}
          
          ${q.imageUrl ? `<img src="${q.imageUrl}" class="img-fluid rounded mx-auto mb-4" style="max-height: 300px;">` : ""}
          <form id="play-form" class="mt-3 text-start mx-auto w-100">
            <div class="mb-4">
              <label class="form-label text-muted">YOUR ANSWER</label>
              <textarea id="play-answer" class="form-control bg-dark text-light border-0 rounded" rows="3" required></textarea>
            </div>
            <button type="submit" class="btn btn-play w-100 fw-bold">SUBMIT</button>
          </form>
          <div id="play-result" class="mt-4"></div>
        </div>`;

      document.getElementById("back-btn").addEventListener("click", () => {
        if (sessionStorage.getItem('isRandomMode') === 'true') {
          this.loadRandomQuestions(true); // Load the saved random questions
        } else {
          this.loadQuestions(); // Load the default paginated list
        }
      });

      document.getElementById("play-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const resultEl = document.getElementById("play-result");
        const answer = document.getElementById("play-answer").value;

        try {
          const result = await this.api.fetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/play`, {
            method: "POST",
            body: JSON.stringify({ answer }),
          });

          if (result.correct) {
            if (sessionStorage.getItem('isRandomMode') === 'true') {
              let savedQuestions = JSON.parse(sessionStorage.getItem('savedQuestions') || "[]");
              
              // Find the question we just solved and update its solved status
              savedQuestions = savedQuestions.map(question => {
                // Ensure we compare strings/ints correctly by using == or converting
                if (question.id == qId) { 
                  return { ...question, [CONFIG.API_FIELDS.SOLVED]: true };
                }
                return question;
              });
              
              // Save the updated list back to the browser
              sessionStorage.setItem('savedQuestions', JSON.stringify(savedQuestions));
            }
            
            resultEl.innerHTML = `<div class="alert alert-success fw-bold border-0 bg-success bg-opacity-25 text-success">Correct!</div>`;
          } else {
            resultEl.innerHTML = `<div class="alert alert-danger border-0 bg-danger bg-opacity-25 text-danger">Incorrect! The answer was: <strong>${result.correctAnswer}</strong></div>`;
          }
        } catch (err) {
          resultEl.innerHTML = `<div class="text-danger fw-bold">${err.message}</div>`;
        }
      });
    } catch (err) {
      this.handleError(err);
    }
  }

  async loadQuestionDetail(qId) {
    const container = document.getElementById("questions-container");
    // Use the exact same loading spinner as the rest of the app
    container.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-warning" role="status"></div></div>';

    try {
      const q = await this.api.fetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
      const currentUserId = this.api.getCurrentUserId();
      const isOwner = q.userId === currentUserId;

      // Format keywords using your existing .keyword-badge class
      let keywordsHtml = "";
      if (q.keywords && q.keywords.length) {
        keywordsHtml = `<div class="mb-1">
          ${q.keywords.map((k) => `<span class="badge keyword-badge me-2">${k}</span>`).join("")}
        </div>`;
      }

      const solvedClass = q[CONFIG.API_FIELDS.SOLVED] ? "card-solved" : "";

      container.innerHTML = `
        <button id="back-btn" class="btn btn-link text-warning text-decoration-none mb-3 px-0">&larr; Back to questions</button>
        <div class="card shadow-lg ${solvedClass}">
          <div class="card-body p-4">
            <h3 class="text-white fw-bold mb-1">
              ${q.question} 
              ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge bg-success ms-2 fs-6 align-middle">Solved</span>` : ""}
            </h3>
            <p class="text-muted small mb-2">by ${q.userName || "Unknown"}</p>
            
            ${q.imageUrl ? `<img src="${q.imageUrl}" class="img-fluid rounded mb-4" style="max-height: 300px;">` : ""}
            
            <div class="mb-2">
              <!-- <h6 class="text-muted text-uppercase fw-bold" style="font-size: 0.8rem; letter-spacing: 1px;">Answer</h6> -->
              <div class="p-3 rounded" style="background-color: var(--bg-input); color: white;">
                ${q.answer}
              </div>
            </div>

            ${keywordsHtml}

            ${
              isOwner
                ? `<div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-secondary border-opacity-25">
                    <button class="btn btn-sm btn-outline-info px-3" id="detail-edit-btn">Edit</button>
                    <button class="btn btn-sm btn-outline-danger px-3" id="detail-delete-btn">Delete</button>
                  </div>`
                : ""
            }
          </div>
        </div>`;

      // Event Listeners
      document.getElementById("back-btn").addEventListener("click", () => {
        if (sessionStorage.getItem('isRandomMode') === 'true') {
          this.loadRandomQuestions(true); // Load the saved random questions
        } else {
          this.loadQuestions(); // Load the default paginated list
        }
      });

      if (isOwner) {
        // Added 'this.' to properly scope the class methods!
        document.getElementById("detail-edit-btn").addEventListener("click", () => this.showQuestionForm(qId));
        document.getElementById("detail-delete-btn").addEventListener("click", () => this.deleteQuestion(qId));
      }
    } catch (err) {
      this.handleError(err); // Changed to use your standard error handler
    }
  }


  async deleteQuestion(qId) {
    if (!confirm("Delete this question?")) return;
    try {
      await this.api.fetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "DELETE" });
      this.loadQuestions();
    } catch (err) {
      alert(err.message);
    }
  }

  handleError(err) {
    if (err.message === "No token provided" || err.message === "Invalid or expired token") {
      this.onLogoutRequired();
    } else {
      this.container.innerHTML = `<div class="alert alert-danger border-0 bg-danger bg-opacity-25 text-danger">${err.message}</div>`;
    }
  }
}