import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import { login, register } from "../api/authApi";
import { setToken } from "../../../shared/api/tokenStorage";
import { LOGIN_ROUTE, CALENDAR_ROUTE } from "../../../shared/config/routes";

export default function AuthPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  async function handleSubmit(email, password) {
    setPending(true);
    setError("");
    try {
      const authenticate = location.pathname === LOGIN_ROUTE ? login : register;
      const { token } = await authenticate(email, password);
      if (!token) throw new Error("The server did not return an access token");
      setToken(token);
      navigate(CALENDAR_ROUTE, { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  return <AuthForm onSubmit={handleSubmit} pending={pending} error={error} />;
}
