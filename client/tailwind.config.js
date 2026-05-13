export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        hospital: {
          ink: "#10231f",
          teal: "#0f766e",
          mint: "#dff7ef",
          line: "#d7e3df",
          soft: "#f5faf8"
        }
      },
      boxShadow: {
        panel: "0 16px 44px rgba(15, 118, 110, 0.10)"
      }
    }
  },
  plugins: []
};
