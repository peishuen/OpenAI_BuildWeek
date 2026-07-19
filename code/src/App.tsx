/*
  Display the controlled login demo used by the Playwright tests.
*/
import LoginPage from "./LoginPage";
import RepairConsole from "./RepairConsole";

export default function App() {
  const isLoginPage = window.location.pathname === "/login";

  return (
    <div className="app-shell">
      {isLoginPage ? <LoginPage /> : <RepairConsole />}
    </div>
  );
}
