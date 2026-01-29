import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { DrizzleAdapter } from './adapter';

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  session: {
    strategy: 'database',
  },
};

export const auth = () => getServerSession(authOptions);
