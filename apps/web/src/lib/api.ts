import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && !config?._retry && !config?.url?.includes("/auth/")) {
      config._retry = true;
      try {
        await api.post("/auth/refresh");
        return api(config);
      } catch {
        if (typeof window !== "undefined") window.location.href = "/sign-in";
      }
    }
    return Promise.reject(error);
  }
);
