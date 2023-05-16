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

async function check(token) {
  const response = await fetch(`${BASE_URL}/api/user/auth`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
}

async function createDate(date, comment, token) {
  const response = await fetch(`${BASE_URL}/api/userDate/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date, comment }),
  });
  return response;
}

async function getAllDates(token) {
  const response = await fetch(`${BASE_URL}/api/userDate/get`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return response;
}

async function deleteDate(token, date) {
  const response = await fetch(`${BASE_URL}/api/userDate/delete`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date }),
  });
  return response;
}

export { login, register, check, createDate, getAllDates, deleteDate };
