# Admin Dashboard - Supervisor Interface

This is the supervisor dashboard for managing customer help requests and building the AI knowledge base.

## Features

- View pending customer questions in real-time
- Submit answers that are automatically sent via email to customers
- Track request history and statistics
- View learned answers that have been added to the knowledge base
- Real-time updates every 5 seconds

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Edit `.env` and set your backend API URL (default: http://localhost:3000)

3. Start the development server:

```bash
npm run dev
```

The dashboard will be available at http://localhost:5174

## Usage

### Pending Requests Tab

- View all unanswered customer questions
- See customer email if provided
- Type your answer and click "Submit Answer & Send Email"
- The answer will be sent to the customer via email automatically

### History Tab

- View all past requests with their status
- See submitted answers and timestamps
- Track resolved, answered, and timeout requests

### Learned Answers Tab

- View all answers that have been added to the knowledge base
- See how many times each answer has been used
- Monitor the AI's learning progress

## Email Notifications

When you submit an answer:

- If the customer provided an email, they'll receive a beautifully formatted email with the answer
- The email includes both the question and your answer
- You'll see a confirmation toast notification indicating if the email was sent

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview Production Build

```bash
npm run preview
```
