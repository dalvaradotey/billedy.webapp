import { and, eq } from 'drizzle-orm';
import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from 'next-auth/adapters';
import { db } from '@/lib/db';
import { users, oauthAccounts, sessions, verificationTokens } from '@/lib/db/schema';

export function DrizzleAdapter(): Adapter {
  return {
    async createUser(data: Omit<AdapterUser, 'id'>) {
      const [user] = await db
        .insert(users)
        .values({
          email: data.email,
          name: data.name,
          image: data.image,
          emailVerified: data.emailVerified,
        })
        .returning();

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      } as AdapterUser;
    },

    async getUser(id: string) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      } as AdapterUser;
    },

    async getUserByEmail(email: string) {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      } as AdapterUser;
    },

    async getUserByAccount({
      providerAccountId,
      provider,
    }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>) {
      const account = await db.query.oauthAccounts.findFirst({
        where: and(
          eq(oauthAccounts.providerAccountId, providerAccountId),
          eq(oauthAccounts.provider, provider)
        ),
        with: {
          user: true,
        },
      });

      if (!account?.user) return null;

      return {
        id: account.user.id,
        email: account.user.email,
        name: account.user.name,
        image: account.user.image,
        emailVerified: account.user.emailVerified,
      } as AdapterUser;
    },

    async updateUser(data: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      const [user] = await db
        .update(users)
        .set({
          name: data.name,
          email: data.email,
          image: data.image,
          emailVerified: data.emailVerified,
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.id))
        .returning();

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      } as AdapterUser;
    },

    async deleteUser(userId: string) {
      await db.delete(users).where(eq(users.id, userId));
    },

    async linkAccount(data: AdapterAccount) {
      await db.insert(oauthAccounts).values({
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refreshToken: data.refresh_token,
        accessToken: data.access_token,
        expiresAt: data.expires_at,
        tokenType: data.token_type,
        scope: data.scope,
        idToken: data.id_token,
        sessionState: data.session_state as string | undefined,
      });

      return data;
    },

    async unlinkAccount({
      providerAccountId,
      provider,
    }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>) {
      await db
        .delete(oauthAccounts)
        .where(
          and(
            eq(oauthAccounts.providerAccountId, providerAccountId),
            eq(oauthAccounts.provider, provider)
          )
        );
    },

    async createSession(data: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }) {
      const [session] = await db
        .insert(sessions)
        .values({
          sessionToken: data.sessionToken,
          userId: data.userId,
          expires: data.expires,
        })
        .returning();

      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      } as AdapterSession;
    },

    async getSessionAndUser(sessionToken: string) {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.sessionToken, sessionToken),
        with: {
          user: true,
        },
      });

      if (!session?.user) return null;

      return {
        session: {
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          emailVerified: session.user.emailVerified,
        } as AdapterUser,
      };
    },

    async updateSession(
      data: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>
    ) {
      const [session] = await db
        .update(sessions)
        .set({
          expires: data.expires,
        })
        .where(eq(sessions.sessionToken, data.sessionToken))
        .returning();

      if (!session) return null;

      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      } as AdapterSession;
    },

    async deleteSession(sessionToken: string) {
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    },

    async createVerificationToken(data: VerificationToken) {
      const [token] = await db
        .insert(verificationTokens)
        .values({
          identifier: data.identifier,
          token: data.token,
          expires: data.expires,
        })
        .returning();

      return {
        identifier: token.identifier,
        token: token.token,
        expires: token.expires,
      } as VerificationToken;
    },

    async useVerificationToken({
      identifier,
      token,
    }: Pick<VerificationToken, 'identifier' | 'token'>) {
      const [deletedToken] = await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token)
          )
        )
        .returning();

      if (!deletedToken) return null;

      return {
        identifier: deletedToken.identifier,
        token: deletedToken.token,
        expires: deletedToken.expires,
      } as VerificationToken;
    },
  };
}
