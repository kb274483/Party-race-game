// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  app: {
    head: {
      meta: [
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
        },
      ],
      link: [
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&display=swap",
        },
      ],
    },
  },

  css: ["~/assets/css/main.css"],

  components: [{ path: "~~/components", pathPrefix: false }],

  modules: ["@nuxtjs/tailwindcss", "@pinia/nuxt"],

  typescript: {
    strict: true,
    typeCheck: true,
  },

  ssr: false, // 遊戲需要客戶端渲染

  vite: {
    define: {
      "import.meta.env.NUXT_PUBLIC_API_URL": JSON.stringify(
        process.env.NUXT_PUBLIC_API_URL ?? "",
      ),
      "import.meta.env.NUXT_PUBLIC_WS_URL": JSON.stringify(
        process.env.NUXT_PUBLIC_WS_URL ?? "",
      ),
    },
  },

  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? "",
      wsUrl: process.env.NUXT_PUBLIC_WS_URL ?? "",
    },
  },
});
