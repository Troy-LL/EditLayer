import react from "@vitejs/plugin-react";
import editlayer from "../../packages/vite-plugin-editlayer/index.js";

export default {
  plugins: [editlayer(), react()],
};
