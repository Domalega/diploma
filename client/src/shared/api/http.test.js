import { request } from "./http";

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});
afterEach(() => {
  delete global.fetch;
});

test("failed authenticated requests clear an expired token", async () => {
  localStorage.setItem("token", "expired");
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: "Unauthorized" }),
  });
  await expect(request("/user/auth", { token: "expired" })).rejects.toMatchObject({ status: 401 });
  expect(localStorage.getItem("token")).toBeNull();
});

test("a non-JSON server error is still reported with its HTTP status", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 502,
    json: async () => {
      throw new SyntaxError();
    },
  });
  await expect(request("/userDate/get")).rejects.toMatchObject({
    status: 502,
    message: "Request failed",
  });
});
