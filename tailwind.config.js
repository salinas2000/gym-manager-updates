/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/renderer/**/*.{js,jsx,ts,tsx}",
        "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                slate: {
                    850: '#1e293b', // Custom in between
                    900: '#0f172a',
                    950: '#020617', // Base background
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
