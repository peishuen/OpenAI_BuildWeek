/*
  Display a small fake login form for the demo.
*/
import { type SubmitEvent, useState } from "react";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"success" | "error" | null>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!email || !password) {
      setStatus("error");
      setMessage("Enter your email and password.");
      return;
    }

    if (!email.includes("@")) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("success");
    setMessage("Signed in successfully.");
  }

  return (
    <div className="login-layout">
      <main>
        <h1>Self-Healing Playwright Repair Console</h1>

        <form noValidate onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />

          <button id="sign-in-button" type="submit">
            Sign in
          </button>
        </form>
      </main>

      {status && (
        <p className={`toast ${status}`} role={status === "error" ? "alert" : "status"}>
          <strong>{status === "success" ? "Success: " : "Error: "}</strong>
          {message}
        </p>
      )}
    </div>
  );
}
