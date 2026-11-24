import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './generated/fonts.css'
import './assets/main.css'

// Vuetify (components are imported on demand by vite-plugin-vuetify)
import 'vuetify/styles'
import { createVuetify } from 'vuetify'

import '@mdi/font/css/materialdesignicons.css'

import { detectTheme } from './composables/useThemeMode'

const vuetify = createVuetify({
  theme: {
    defaultTheme: detectTheme(),
    themes: {
      light: { colors: { background: '#ffffff', surface: '#ffffff', primary: '#2a9fd6' } },
      dark: { colors: { background: '#16181d', surface: '#16181d', primary: '#6cc8f0' } },
    },
  },
})

const app = createApp(App)

app.use(vuetify)
app.use(router)

app.mount('#app')
