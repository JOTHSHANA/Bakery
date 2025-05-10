import axios from "axios";
import apiHost from "./api";
import toast from "react-hot-toast";

// Helper function to check token expiration
const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;

    if (decoded.exp < currentTime) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error decoding token:", error);
    return true;
  }
};

// Create an Axios instance
const api = axios.create({
    baseURL: apiHost,
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("D!");
        if (token) {
            if (isTokenExpired(token)) {
                localStorage.removeItem("D!");
                window.location.href = "/login";
                return Promise.reject({
                    response: { status: 401, data: { message: "Token expired. Please log in." } },
                });
            }
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("D!");
            window.location.href = "/login";
        }
        toast.error("Invalid Request..");
        console.error("Error in api:", error);
        return Promise.reject(error);
    }
);

const requestApi = async (method, url, data = null, params = {}) => {
    try {
        let response;
        switch (method.toUpperCase()) {
            case "POST":
                response = await api.post(url, data, { params });
                break;
            case "GET":
                response = await api.get(url, { params });
                break;
            case "PUT":
                response = await api.put(url, data, { params });
                break;
            case "DELETE":
                response = await api.delete(url, { params });
                break;
            default:
                throw new Error(`Unsupported request method: ${method}`);
        }
        return { success: true, data: response.data };
    } catch (error) {
        // The error is already handled by the interceptor.
        return { success: false, error: error.response?.data || error.message };
    }
};

export default requestApi;
