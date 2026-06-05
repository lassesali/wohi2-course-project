import { describe, it, expect, beforeEach, vi } from "vitest";
import { request, app, resetDb, registerAndLogin, createQuestion } from "./helpers.js";
import { v2 as cloudinary } from "cloudinary";
import stream from "stream";

// 1. Mock the Cloudinary SDK before any tests run
vi.mock("cloudinary", () => {
  return {
    v2: {
      config: vi.fn(),
      uploader: {
        // Mock upload_stream to act like a writable stream that instantly succeeds
        upload_stream: vi.fn((options, cb) => {
          return new stream.Writable({
            write(chunk, encoding, next) {
              next(); // Accept the data
            },
            final(next) {
              // Fire the Cloudinary callback with a fake secure_url when the stream finishes
              cb(null, { secure_url: "https://res.cloudinary.com/mock-account/image/upload/v123/fake.png" });
              next();
            }
          });
        }),
      },
    },
  };
});

beforeEach(resetDb);

describe("Edge Cases: File Uploads", () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndLogin("zuckerberg@fb.com", "Mark Zuckerberg");
    vi.clearAllMocks(); // Clear mock history between tests
  });

  it("creates a question with an image upload", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "What color is the sky?")
      .field("answer", "Blue")
      .attach("image", Buffer.from("fake-image-data"), "test.png"); 

    expect(res.status).toBe(201);
    // 2. Assert against the mock URL instead of the local /uploads/ path
    expect(res.body.imageUrl).toBe("https://res.cloudinary.com/mock-account/image/upload/v123/fake.png"); 
  });

  it("updates a question with a new image upload", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token);

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Updated question text")
      .field("answer", "Updated answer text")
      .attach("image", Buffer.from("fake-updated-image"), "updated.png");

    expect(res.status).toBe(200);
    // 3. Assert against the mock URL
    expect(res.body.imageUrl).toBe("https://res.cloudinary.com/mock-account/image/upload/v123/fake.png");
  });

  it("returns 400 and catches the Multer error if the file is not an image", async () => {
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "What is 2+3?")
      .field("answer", "5")
      .attach("image", Buffer.from("fake-text-data"), "document.txt"); 

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("Only image files are allowed"); 
    // Cloudinary should never be called here, because Multer blocks it first!
  });

  it("returns a 500 error if Cloudinary returns no result and no error", async () => {
    // 1. Temporarily override our global mock to simulate the edge case
    vi.mocked(cloudinary.uploader.upload_stream).mockImplementationOnce((options, cb) => {
      return new stream.Writable({
        write(chunk, encoding, next) {
          next();
        },
        final(next) {
          // Pass undefined for both the error and the result
          cb(undefined, undefined); 
          next();
        }
      });
    });

    // 2. Make the standard upload request
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "What happens if Cloudinary breaks?")
      .field("answer", "It throws a 500")
      .attach("image", Buffer.from("fake-image-data"), "test.png"); 

    // 3. Assert that your Express catch block handled it properly
    expect(res.status).toBe(500);
    // If you send a specific JSON error message in your catch block, you can assert it here:
    // expect(res.body.error).toBe("Failed to create question");
  });
});

it("returns a 500 error if Cloudinary explicitly returns an error", async () => {
    // 1. Temporarily override the mock to simulate a Cloudinary API failure
    vi.mocked(cloudinary.uploader.upload_stream).mockImplementationOnce((options, cb) => {
      return new stream.Writable({
        write(chunk, encoding, next) {
          next();
        },
        final(next) {
          // Pass an Error object as the first argument, triggering "if (error) return reject(error);"
          const cloudinaryError = new Error("Cloudinary API is currently down");
          cb(cloudinaryError, undefined); 
          next();
        }
      });
    });

    // 2. Make the standard upload request
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "What happens if Cloudinary rejects the file?")
      .field("answer", "It throws a 500")
      .attach("image", Buffer.from("fake-image-data"), "test.png"); 

    // 3. Assert that your Express catch block handled the rejection properly
    expect(res.status).toBe(500);
  });

describe("file size boundary", () => {
  const FIVE_MB = 5 * 1024 * 1024;

  it("accepts a file just under 5 MB", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Q")
      .field("answer", "A")
      .attach("image", Buffer.alloc(FIVE_MB - 1), {
        filename: "ok.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(201);
  });

  it("rejects a file at exactly the 5 MB limit (multer's limit is exclusive)", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Q")
      .field("answer", "A")
      .attach("image", Buffer.alloc(FIVE_MB), {
        filename: "limit.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
  });

});
