/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./views/**/*.ejs",
        "./public/**/*.{js,css}",
        "./node_modules/tw-elements/js/**/*.js",
    ],
    darkMode: 'class',
    plugins: [
        require("tw-elements/dist/plugin"),
        require("daisyui"),
    ],
    daisyui: {
        themes: ['light'],
        styled: true,
        base: true,
        utils: true,
        logs: true,
        rtl: false,
    },
};