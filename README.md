# Chaos Coordinator

Cross-functional project management and coordination platform that solves real coordination gaps between teams.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Set up database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

## Architecture

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React (client directory)
- **Database**: PostgreSQL with Knex.js migrations

## Core Features

- **Project Lifecycle Management**: 7-stage structured workflow
- **Cross-functional Handoffs**: Sales → Project Manager handoff process
- **Role-based Dashboards**: Customized views for each team role
- **Task Dependencies**: Automatic dependency tracking and blocking
- **Accountability Enforcement**: Clear ownership and deadline tracking

## User Roles

- **Sales**: Deal management and handoff initiation
- **Project Manager**: Project execution and task management
- **Customer Success**: Client health monitoring
- **Product**: Roadmap and dependency management
- **Admin**: System configuration and user management

## Project Stages

1. Deal Closed (Sales)
2. Project Kickoff
3. Planning
4. Execution
5. Review
6. Delivery
7. Post-Delivery / CSM Monitoring

## Development

```bash
# Run tests
npm test

# Database migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

## Environment Variables

See `.env.example` for required configuration:
- Database connection
- JWT secret
- Email settings
- CRM integration keys
