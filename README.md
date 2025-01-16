# Next.js Chat Application

This is a modern chat application built with Next.js, Supabase, and various UI components. The application features real-time messaging, file attachments, reactions, and a responsive design.

## Core Components

### App Structure

- `app/layout.tsx`: Root layout component that handles authentication state changes and user profile creation
- `app/page.tsx`: Main application page with chat interface and sidebar
- `app/globals.css`: Global styles and Tailwind CSS configuration
- `app/channels/[channelId]/page.tsx`: Dynamic route for individual channel pages

### Chat Components

- `app/components/chat-area.tsx`: Main chat interface component handling messages, reactions, and real-time updates
- `app/components/chat-input.tsx`: Message input component with file attachment support
- `app/components/sidebar.tsx`: Navigation sidebar with channel list and user management
- `app/components/message-component.tsx`: Individual message display with reactions and attachments
- `app/components/search-box.tsx`: Search functionality for messages

### UI Components

The `components/ui/` directory contains reusable UI components built with Radix UI:

- `accordion.tsx`: Collapsible content sections
- `alert.tsx`: Alert and notification components
- `calendar.tsx`: Date picker component
- `card.tsx`: Card container components
- `carousel.tsx`: Image/content carousel
- `chart.tsx`: Data visualization components
- `collapsible.tsx`: Toggle-able content sections
- `dialog.tsx`: Modal dialog components
- `drawer.tsx`: Slide-out drawer components
- `form.tsx`: Form input components
- `menubar.tsx`: Navigation menu components
- `sidebar.tsx`: Customizable sidebar component
- `table.tsx`: Data table components
- `textarea.tsx`: Multi-line text input

### Database Schema

`schema.sql` defines the Supabase database structure with tables for:
- Profiles (user data)
- Channels (chat rooms)
- Messages (with file attachments)
- Reactions (emoji reactions to messages)
- Channel memberships
- Storage configuration for file attachments

Key features include:
- Row Level Security (RLS) policies
- Real-time subscriptions
- Vector embeddings for message search
- File storage management

### Configuration Files

- `tailwind.config.ts`: Tailwind CSS configuration with custom theme
- `tsconfig.json`: TypeScript configuration
- `postcss.config.mjs`: PostCSS configuration
- `components.json`: UI component configuration
- `.gitignore`: Git ignore rules

## Security Features

- Environment variables management
- Secure file storage policies
- Authentication integration
- Row Level Security for database access
- API key protection

## Styling

The application uses a comprehensive theming system with:
- Light/dark mode support
- CSS variables for colors
- Tailwind CSS utilities
- Custom animations
- Responsive design

## Development

The project uses:
- Next.js 14
- TypeScript
- Supabase for backend
- Tailwind CSS for styling
- Radix UI for components
- Various React hooks and utilities

To get started:
1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables
4. Run development server with `npm run dev`

## Features

- Real-time messaging
- File attachments
- Emoji reactions
- User presence
- Message search
- Channel management
- Direct messaging
- Responsive design
- Dark mode support
