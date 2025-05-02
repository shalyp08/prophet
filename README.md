# Prophet - Financial Prediction System

A system that generates financial predictions based on news headlines using GPT-4 and tracks their accuracy.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root with the following content:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
OPENAI_API_KEY=your-openai-api-key
```

## Environment Variables

Create a `.env.local` file with the following variables:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

### Generate New Predictions
To generate new predictions based on the latest financial news:
```bash
npm run generate
```

### Resolve Existing Predictions
To check and update the status of existing predictions:
```bash
npm run resolve
```

## Project Structure

- `autoGenerate.ts`: Fetches news headlines and generates predictions using GPT-4
- `resolveProphet.ts`: Updates predictions based on actual SPY performance
- `package.json`: Project configuration and dependencies
- `.env`: Environment variables (create manually)
- `.env.example`: Template for environment variables

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys secure and never share them
- The `.env` file is automatically added to `.gitignore`

## Automation

You can automate these scripts using:
- Cron jobs (for local scheduling)
- Cloud functions (AWS Lambda, Google Cloud Functions, etc.)
- CI/CD pipelines 