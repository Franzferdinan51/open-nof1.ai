# 🤖 OpenTradingBot

> An open-source, multi-model autonomous trading platform compatible with Exbitron and various AI providers.

![Screenshot](./screenshot.png)

## 🌟 What is OpenTradingBot?

OpenTradingBot is a flexible trading platform designed to let AI models trade cryptocurrency autonomously. It is built to be model-agnostic, allowing you to deploy various LLMs as trading agents on the **Exbitron** exchange (Spot).

Whether you want to run state-of-the-art cloud models like GPT-4o and DeepSeek, or run completely local models via LM Studio, OpenTradingBot provides the infrastructure to manage market data, execute trades, and track performance.

## 🎯 Features

- 🔄 **Exbitron Integration**: Optimized for Spot trading on Exbitron.
- 🧠 **Multi-Model Support**:
  - **DeepSeek R1** (via OpenRouter)
  - **OpenAI GPT-4o**
  - **Google Gemini 1.5 Pro**
  - **Local Models** (via LM Studio / OpenAI Compatible API)
- 🤖 **Optional Multi-Bot Support**: Run single or multiple bot instances with different strategies or models.
- 📊 **Real-time Dashboard**: Monitor portfolio performance, active trades, and AI reasoning logs.
- 🔍 **Transparent Decision Making**: Every trade includes a "Chain of Thought" log explaining the AI's reasoning.
- 🌗 **Automatic Dark Mode**: UI adapts to your system preference.

## 🏗️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/)
- **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Trading Engine**: Custom adapter for Exbitron (expandable to CCXT)
- **Runtime**: [Bun](https://bun.sh/)
- **Styling**: Tailwind CSS v4 with `next-themes`

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- PostgreSQL database
- Exbitron API credentials
- API Key for your chosen AI provider (or a running local model)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/open-trading-bot.git
   cd open-trading-bot
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Fill in your `.env` file:
   ```env
   # Application
   NEXT_PUBLIC_URL="http://localhost:3000"

   # Database
   DATABASE_URL="postgresql://postgres:password@localhost:5432/opentradingbot"

   # Trading Configuration
   START_MONEY=100         # Initial capital in USDT
   ACTIVE_MODEL="deepseek" # Options: deepseek, openai, gemini, local, agentevolver
   
   # Exchange (Exbitron)
   EXBITRON_API_KEY="your_exbitron_key"
   EXBITRON_API_SECRET="your_exbitron_secret"

   # AI Model Keys (Fill the one matching ACTIVE_MODEL)
   DEEPSEEK_API_KEY=""
   OPENROUTER_API_KEY=""
   OPENAI_API_KEY=""
   GOOGLE_GENERATIVE_AI_API_KEY=""
   
   # Local Model Config (if ACTIVE_MODEL="local")
   LOCAL_LLM_BASE_URL="http://localhost:1234/v1" # Default for LM Studio
   LOCAL_MODEL_ID="llama-3-8b-instruct"          # The ID used by your local server

   # AgentEvolver Config (if ACTIVE_MODEL="agentevolver")
   AGENT_EVOLVER_URL="http://localhost:8000"

   # Security
   CRON_SECRET_KEY="your_secret_token"
   ```

4. **Set up the database**
   ```bash
   bunx prisma generate
   bunx prisma db push
   ```

5. **Run the development server**
   ```bash
   bun dev
   ```

6. **Set up cron jobs**

   To enable autonomous trading, set up cron jobs to hit these endpoints:

   - `POST /api/cron/20-seconds-metrics-interval` - Collects account metrics
   - `POST /api/cron/3-minutes-run-interval` - Triggers the AI trading logic

## 🧠 Using Local Models (LM Studio)

You can run OpenTradingBot completely privately using local LLMs:

1. Download and install [LM Studio](https://lmstudio.ai/).
2. Load a model (e.g., Llama 3, Mistral).
3. Start the **Local Inference Server** in LM Studio (usually on port 1234).
4. Set `.env` variables:
   ```env
   ACTIVE_MODEL="local"
   LOCAL_LLM_BASE_URL="http://localhost:1234/v1"
   ```
5. The bot will now use your local machine for reasoning!

## 🤖 Using AgentEvolver (Python Service)

To use the self-evolving agent framework:

1. Set up the Python environment in `python-service/`:
   ```bash
   cd python-service
   pip install -r requirements.txt
   python server.py
   ```
2. Set `.env` variable:
   ```env
   ACTIVE_MODEL="agentevolver"
   ```

## ⚠️ Disclaimer

**This software is for educational and research purposes only. Trading cryptocurrencies involves substantial risk of loss.**

- Use at your own risk.
- The developers are not responsible for financial losses.
- Always test with small amounts first.

## 📝 License

MIT License
