import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Routes } from "./app/routes";
import { Provider } from "react-redux";
import { store } from "./app/store";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <Routes />
    </Provider>
  </React.StrictMode>
);
