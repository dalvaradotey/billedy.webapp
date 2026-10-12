'use server';

import { sql } from 'drizzle-orm';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import type { ActionResult } from '../types';
import { verifyProjectAccess } from '../lib/access';

export type DescriptionSuggestion = {
  description: string;
  type: 'income' | 'expense';
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  budgetId: string | null;
  uses: number;
};

/**
 * Descripciones usadas en el proyecto (la más reciente de cada una), para sugerirlas
 * al registrar. Al elegir una se completan la categoría y la cuenta de la última vez.
 */
export async function fetchDescriptionSuggestions(
  projectId: string,
  userId: string
): Promise<ActionResult<DescriptionSuggestion[]>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  if (!(await verifyProjectAccess(projectId, userId))) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const rows = (await db.execute(sql`
    with ranked as (
      select
        t.description,
        t.type::text as type,
        t.category_id,
        c.name as category_name,
        t.account_id,
        t.budget_id,
        count(*) over (partition by lower(trim(t.description))) as uses,
        row_number() over (partition by lower(trim(t.description)) order by t.date desc, t.created_at desc) as rn,
        max(t.date) over (partition by lower(trim(t.description))) as last_date
      from n1n4_transactions t
      left join n1n4_categories c on c.id = t.category_id
      where t.project_id = ${projectId}
        and t.linked_transaction_id is null
        and t.card_purchase_id is null
        and t.credit_id is null
        and length(trim(t.description)) > 0
    )
    select description, type, category_id, category_name, account_id, budget_id, uses
    from ranked
    where rn = 1
    order by last_date desc
    limit 200
  `)) as unknown as Record<string, string | null>[];

  return {
    success: true,
    data: rows.map((r) => ({
      description: r.description ?? '',
      type: r.type === 'income' ? 'income' : 'expense',
      categoryId: r.category_id,
      categoryName: r.category_name,
      accountId: r.account_id,
      budgetId: r.budget_id,
      uses: Number(r.uses ?? 1),
    })),
  };
}
