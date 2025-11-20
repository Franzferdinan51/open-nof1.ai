# 🤖 OpenTradingBot

> An open-source, multi-model autonomous trading platform compatible with Exbitron and various AI providers.

![Screenshot](./screenshot.png)

## 🌟 What is OpenTradingBot?

OpenTradingBot is a flexible trading platform designed to let AI models trade cryptocurrency autonomously. Originally inspired by nof1.ai's Alpha Arena, this platform has been evolved to serve as a general-purpose trading bot manager.

It supports:
- **Multiple AI Models**: Run strategies using DeepSeek, OpenAI, Gemini, Anthropic, or local models (via LM Studio/OpenAI Compatible).
- **Real Exchange Integration**: Currently optimized for **Exbitron** (Spot trading), with architecture to support others.
- **Autonomous Operation**: The bot analyzes market data, manages risk, and executes trades without human intervention.

## 🎯 Features

- 🔄 **Automated Trading**: Executes trades based on AI analysis.
- 📊 **Real-time Dashboard**: Monitor portfolio performance and active trades.
- 🧠 **Chain-of-Thought Logging**: See exactly *why* the AI made a decision.
- 💹 **Multi-Asset Support**: Configurable for various pairs (BTC, ETH, DOGE, etc.).
- 🔌 **Pluggable AI**: Switch between different LLMs to find the best trader.

## 🏗️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/)
- **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Trading Engine**: Custom adapter for Exbitron (expandable to CCXT)
- **Runtime**: [Bun](https://bun.sh/)

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- PostgreSQL database
- Exbitron API credentials
- AI Model API key (DeepSeek, OpenAI, etc.)

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

   # AI Models
   DEEPSEEK_API_KEY=""
   OPENAI_API_KEY=""
   OPENROUTER_API_KEY=""
   GOOGLE_GENERATIVE_AI_API_KEY="" # For Gemini
   
   # Exchange (Exbitron)
   EXBITRON_API_KEY=""
   EXBITRON_API_SECRET=""
   
   # Configuration
   START_MONEY=100 # Initial capital in USDT
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

   - `POST /api/cron/20-seconds-metrics-interval` - Collect metrics
   - `POST /api/cron/3-minutes-run-interval` - Execute trading logic

## ⚠️ Disclaimer

**This software is for educational and research purposes only. Trading cryptocurrencies involves substantial risk of loss.**

- Use at your own risk.
- The developers are not responsible for financial losses.
- Always test with small amounts first.

## 📝 License

MIT License
