/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        galaxy: {
          background: "#030712",
          surface: "#090d1a",
          card: "#0e1326",
          border: "#1e2640"
        },
        platinum: {
          brushed: "#cbd5e1",
          metallic: "#94a3b8",
          laserBlue: "#38bdf8"
        },
        cyberYellow: {
          neon: "#facc15",
          glow: "rgba(250, 204, 21, 0.15)"
        }
      },
      boxShadow: {
        "cyber-glow": "0 0 25px rgba(56, 189, 248, 0.15)",
        "neon-laser": "0 0 30px rgba(250, 204, 21, 0.2)",
        "glass-inset": "inset 0 1px 1px rgba(255, 255, 255, 0.03)"
      },
      animation: {
        "matrix-pulse": "matrixPulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "laser-slide": "laserSlide 6s linear infinite"
      },
      keyframes: {
        matrixPulse: {
          "0%, 100%": { opacity: 0.8, filter: "drop-shadow(0 0 12px rgba(56, 189, 248, 0.4))" },
          "50%": { opacity: 0.5, filter: "drop-shadow(0 0 4px rgba(250, 204, 21, 0.1))" }
        },
        laserSlide: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        }
      }
    }
  },
  plugins: []
};
