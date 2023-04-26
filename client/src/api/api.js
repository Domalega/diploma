const BASE_URL = "http://localhost:5000";

async function login(email, password) {
  const response = await fetch(`${BASE_URL}/api/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  return response;
}

async function register(email, password) {
  const response = await fetch(`${BASE_URL}/api/user/registration`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  return response;
}

export { login, register };
