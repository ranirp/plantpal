/**
 * @fileoverview Tailwind CSS configuration for Plant Sharing Community.
 * Configures content scanning paths, dark mode, and DaisyUI plugin.
 * Uses 'cupcake' theme for consistent, pleasant color palette.
 * 
 * @type {import('tailwindcss').Config}
 */
module.exports = {
    content: [
        "./views/**/*.ejs",
        "./public/**/*.{js,css}",
    ],
    darkMode: 'class',
    plugins: [
        require("daisyui"),
    ],
    daisyui: {
        themes: ['cupcake'],
        styled: true,
        base: true,
        utils: true,
        logs: true,
        rtl: false,
    },
};