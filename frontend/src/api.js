import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || "http://localhost:8000"}/api`,
});

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("cp_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const setToken = (t) =>
  t ? localStorage.setItem("cp_token", t) : localStorage.removeItem("cp_token");

export default api;
