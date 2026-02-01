import { db } from '@/lib/db';
import {
  templates,
  templateItems,
  categories,
  accounts,
  entities,
  projectMembers,
} from '@/lib/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import type {
  TemplateWithItems,
  TemplateItemWithDetails,
  TemplatesSummary,
} from './types';

/**
 * Obtiene todas las plantillas de un proyecto con sus items
 */
export async function getTemplatesWithItems(
  projectId: string,
  userId: string,
  showArchived = false
): Promise<TemplateWithItems[]> {
  // Verificar acceso al proyecto
  const hasAccess = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (hasAccess.length === 0) {
    return [];
  }

  // Obtener plantillas
  const templatesData = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.projectId, projectId),
        showArchived ? undefined : eq(templates.isArchived, false)
      )
    )
    .orderBy(templates.name);

  // Obtener items con detalles
  const itemsData = await db
    .select({
      item: templateItems,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(templateItems)
    .innerJoin(categories, eq(templateItems.categoryId, categories.id))
    .leftJoin(accounts, eq(templateItems.accountId, accounts.id))
    .leftJoin(entities, eq(templateItems.entityId, entities.id))
    .where(eq(templateItems.projectId, projectId));

  // Agrupar items por plantilla
  const itemsByTemplate = new Map<string, TemplateItemWithDetails[]>();
  for (const row of itemsData) {
    const templateId = row.item.templateId;
    const item: TemplateItemWithDetails = {
      ...row.item,
      categoryName: row.categoryName,
      categoryColor: row.categoryColor,
      accountName: row.accountName,
      entityName: row.entityName,
      entityImageUrl: row.entityImageUrl,
    };

    if (!itemsByTemplate.has(templateId)) {
      itemsByTemplate.set(templateId, []);
    }
    itemsByTemplate.get(templateId)!.push(item);
  }

  // Construir resultado
  return templatesData.map((template) => {
    const items = itemsByTemplate.get(template.id) || [];
    const totalIncome = items
      .filter((i) => i.type === 'income')
      .reduce((sum, i) => sum + parseFloat(i.baseAmount), 0);
    const totalExpense = items
      .filter((i) => i.type === 'expense')
      .reduce((sum, i) => sum + parseFloat(i.baseAmount), 0);

    return {
      ...template,
      items,
      itemsCount: items.length,
      totalIncome,
      totalExpense,
    };
  });
}

/**
 * Obtiene una plantilla por ID con sus items
 */
export async function getTemplateById(
  templateId: string,
  userId: string
): Promise<TemplateWithItems | null> {
  // Verificar acceso
  const [template] = await db
    .select({
      template: templates,
    })
    .from(templates)
    .innerJoin(
      projectMembers,
      eq(templates.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(templates.id, templateId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!template) {
    return null;
  }

  // Obtener items
  const itemsData = await db
    .select({
      item: templateItems,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(templateItems)
    .innerJoin(categories, eq(templateItems.categoryId, categories.id))
    .leftJoin(accounts, eq(templateItems.accountId, accounts.id))
    .leftJoin(entities, eq(templateItems.entityId, entities.id))
    .where(eq(templateItems.templateId, templateId));

  const items: TemplateItemWithDetails[] = itemsData.map((row) => ({
    ...row.item,
    categoryName: row.categoryName,
    categoryColor: row.categoryColor,
    accountName: row.accountName,
    entityName: row.entityName,
    entityImageUrl: row.entityImageUrl,
  }));

  const totalIncome = items
    .filter((i) => i.type === 'income')
    .reduce((sum, i) => sum + parseFloat(i.baseAmount), 0);
  const totalExpense = items
    .filter((i) => i.type === 'expense')
    .reduce((sum, i) => sum + parseFloat(i.baseAmount), 0);

  return {
    ...template.template,
    items,
    itemsCount: items.length,
    totalIncome,
    totalExpense,
  };
}

/**
 * Obtiene el resumen de plantillas para un proyecto
 */
export async function getTemplatesSummary(
  projectId: string,
  userId: string
): Promise<TemplatesSummary> {
  // Verificar acceso
  const hasAccess = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (hasAccess.length === 0) {
    return {
      totalTemplates: 0,
      activeTemplates: 0,
      totalItems: 0,
      totalMonthlyIncome: 0,
      totalMonthlyExpense: 0,
      netMonthly: 0,
    };
  }

  // Contar plantillas
  const [templateCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${templates.isActive} = true and ${templates.isArchived} = false)::int`,
    })
    .from(templates)
    .where(eq(templates.projectId, projectId));

  // Sumar items de plantillas activas
  const [itemSums] = await db
    .select({
      totalItems: sql<number>`count(*)::int`,
      totalIncome: sql<number>`coalesce(sum(case when ${templateItems.type} = 'income' then ${templateItems.baseAmount}::numeric else 0 end), 0)::numeric`,
      totalExpense: sql<number>`coalesce(sum(case when ${templateItems.type} = 'expense' then ${templateItems.baseAmount}::numeric else 0 end), 0)::numeric`,
    })
    .from(templateItems)
    .innerJoin(templates, eq(templateItems.templateId, templates.id))
    .where(
      and(
        eq(templates.projectId, projectId),
        eq(templates.isActive, true),
        eq(templates.isArchived, false)
      )
    );

  const totalIncome = Number(itemSums?.totalIncome ?? 0);
  const totalExpense = Number(itemSums?.totalExpense ?? 0);

  return {
    totalTemplates: templateCounts?.total ?? 0,
    activeTemplates: templateCounts?.active ?? 0,
    totalItems: itemSums?.totalItems ?? 0,
    totalMonthlyIncome: totalIncome,
    totalMonthlyExpense: totalExpense,
    netMonthly: totalIncome - totalExpense,
  };
}
