/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 布偶猫 Claude - 温柔的蓝灰色
        ragdoll: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
        },
        // 缅因猫 Codex - 温暖的橙棕色
        maine: {
          50: '#fff8f1',
          100: '#feecdc',
          200: '#fcd9bd',
          300: '#fdba8c',
          400: '#ff8a4c',
          500: '#ff5a1f',
          600: '#d03801',
          700: '#b43403',
          800: '#8a2c0d',
          900: '#771d1d',
        },
        // 暹罗猫 Gemini - 优雅的深褐色
        siamese: {
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#eaddd7',
          300: '#e0cec7',
          400: '#d2bab0',
          500: '#bfa094',
          600: '#a18072',
          700: '#977669',
          800: '#846358',
          900: '#43302b',
        },
        // 猫咖背景色
        cafe: {
          cream: '#fef7ed',
          latte: '#f5e6d3',
          mocha: '#d4a574',
          espresso: '#6b4423',
        }
      },
      fontFamily: {
        cafe: ['Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
