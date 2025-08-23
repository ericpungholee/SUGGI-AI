# SSUGI - AI Writing App

Write with intention, create with purpose.

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ssugi"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
npm run db:generate
npm run db:push
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Clean, distraction-free writing interface
- AI-powered writing assistance
- Document organization with folders
- User authentication and authorization
- Responsive design for all devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM
- **Authentication**: NextAuth.js
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes
│   ├── auth/           # Authentication pages
│   ├── editor/         # Document editor
│   └── home/           # Dashboard
├── components/          # Reusable components
├── lib/                 # Utility functions
└── types/               # TypeScript type definitions
```

## Troubleshooting

### NextAuth Errors

If you encounter NextAuth errors:

1. Ensure all environment variables are set correctly
2. Check that the database is running and accessible
3. Verify the API route is accessible at `/api/auth/signin`
4. Check browser console for detailed error messages

### Database Issues

If you have database connection problems:

1. Verify PostgreSQL is running
2. Check your `DATABASE_URL` format
3. Ensure the database exists
4. Run `npm run db:generate` to regenerate Prisma client

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
