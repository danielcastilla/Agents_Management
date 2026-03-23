# Frontend - AI Agents Management Platform

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Update environment variables
# Edit .env.local with your API URL
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home (redirects to dashboard)
│   ├── login/             # Authentication
│   ├── dashboard/         # Main dashboard
│   ├── agents/            # Agent management
│   │   ├── page.tsx       # List agents
│   │   ├── new/           # Create agent
│   │   └── [id]/          # Agent details
│   ├── runs/              # Run history
│   │   ├── page.tsx       # List runs
│   │   └── [id]/          # Run details
│   ├── tools/             # Tool management
│   ├── users/             # User management
│   ├── analytics/         # Analytics dashboard
│   ├── audit/             # Audit logs
│   └── settings/          # User settings
├── components/
│   ├── ui/                # Reusable UI components
│   ├── layout/            # Layout components
│   └── providers/         # Context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and API client
└── stores/                # Zustand state stores
```

## Features

- 🔐 **Authentication** - JWT-based auth with token refresh
- 🤖 **Agent Management** - Create, edit, clone, delete agents
- ▶️ **Run Execution** - Start runs with real-time streaming
- 🔧 **Tool Configuration** - Manage available tools
- 📊 **Analytics** - Token usage, costs, performance metrics
- 📝 **Audit Logs** - Track all system activities
- 👥 **User Management** - Team members and roles
- 🌙 **Dark Mode** - System and manual theme switching
- 📱 **Responsive** - Mobile-friendly design
- ⚡ **Real-time** - WebSocket updates for live data

## Technologies

- **Framework**: Next.js 14 (App Router)
- **UI**: TailwindCSS + Radix UI
- **State**: Zustand
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **HTTP**: Axios
- **WebSocket**: Socket.IO Client
