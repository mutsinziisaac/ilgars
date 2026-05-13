import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

function originFor(baseUrl: string | undefined, fallback: string): string {
  if (!baseUrl) return fallback

  try {
    return new URL(baseUrl).origin
  } catch {
    return fallback
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const coreOrigin = originFor(
    env.VITE_API_BASE_URL,
    "https://ilgars.ayinza.dev"
  )
  const motorVehicleOrigin = originFor(
    env.VITE_MOTOR_VEHICLE_API_BASE_URL,
    "https://ilgars.ayinza.dev"
  )

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/core/api": {
          target: coreOrigin,
          changeOrigin: true,
          secure: true,
        },
        "/motorvehicle": {
          target: motorVehicleOrigin,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
