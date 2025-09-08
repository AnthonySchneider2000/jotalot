# Jotalot

Jotalot is a powerful, yet simple, note-taking application built with Next.js and powered by Google's Gemini AI. It provides a seamless writing experience with AI-powered code completion and suggestions, all while saving your work automatically to your local browser storage.

## Key Features

*   **AI Copilot**: Integrated with Google Gemini for intelligent text completion and suggestions.
*   **Rich Text Editor**: Uses Monaco Editor for a familiar and powerful editing experience.
*   **Local Storage**: Notes are automatically saved to your browser's local storage, ensuring you never lose your work.
*   **Keyboard Shortcuts**: Includes common keyboard shortcuts like `Ctrl+S` for manual saving.
*   **Themeable**: Light and dark mode support, powered by `next-themes`.
*   **Responsive Design**: Built with Tailwind CSS for a great experience on any device.

## Tech Stack

*   [Next.js](https://nextjs.org/) - The React Framework for the Web
*   [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript at Any Scale
*   [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework
*   [shadcn/ui](https://ui.shadcn.com/) - Re-usable components built using Radix UI and Tailwind CSS.
*   [Google Generative AI](https://ai.google.dev/) - Powering the AI copilot features.
*   [Monaco Editor](https://microsoft.github.io/monaco-editor/) - The code editor that powers VS Code.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   [Bun](https://bun.sh/) (or npm/yarn/pnpm)
*   A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1.  Clone the repo
    ```sh
    git clone https://github.com/AnthonySchneider2000/jotalot.git
    ```
2.  Install dependencies
    ```sh
    bun install
    ```
3.  Run the development server
    ```sh
    bun run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) in your browser. You will be prompted to enter your Google Gemini API key to enable the AI copilot features.

## Available Scripts

In the project directory, you can run:

*   `bun run dev`: Runs the app in development mode.
*   `bun run build`: Builds the app for production.
*   `bun run start`: Starts a production server.
*   `bun run lint`: Lints the codebase for errors.
