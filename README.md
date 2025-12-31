# PO Translator

A modern web application for translating `.po` (Gettext) files with AI-powered suggestions.

## ✨ Features

- **📂 Drag & Drop** - Simply drag your `.po` files to start translating
- **🤖 AI Suggestions** - Get translation suggestions powered by OpenAI or Google Gemini
- **📊 Progress Tracking** - Visual progress bar and statistics for your translations
- **🔍 Search & Filter** - Quickly find entries by text or filter by status (pending/translated)
- **💾 Export** - Download your translated `.po` file when ready
- **🌙 Modern UI** - Clean, glassmorphism-inspired interface

<img width="1389" height="907" alt="image" src="https://github.com/user-attachments/assets/f283743b-89d8-4e3c-ad77-93035ef9b2e7" />


## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd po-translator

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys
```

### Configuration

Edit the `.env` file with your API keys:

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

You can get your API keys from:
- **OpenAI**: https://platform.openai.com/api-keys
- **Google Gemini**: https://aistudio.google.com/apikey

### Running

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## 🎯 How to Use

1. **Upload a file** - Drag and drop a `.po` file or click to browse
2. **Select an entry** - Click on any translation entry from the list
3. **Translate** - Type your translation or click "Generate" for AI suggestions
4. **Apply suggestion** - Click on any AI suggestion to apply it
5. **Export** - Click "Export .po" to download your translated file

## 🛠️ Tech Stack

- **React 19** + TypeScript
- **Vite** - Fast build tool
- **OpenAI API** - GPT-4o mini for translations
- **Google Gemini API** - Gemini 2.5 Flash for translations

## 📝 License

MIT
