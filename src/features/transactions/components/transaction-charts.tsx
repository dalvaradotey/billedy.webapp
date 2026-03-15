'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts';
import { ChevronDown } from 'lucide-react';
import {
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/formatting';
import type { TransactionWithCategory } from '../types';

interface TransactionChartsContentProps {
  transactions: TransactionWithCategory[];
  defaultCurrency: string;
}

type ChartMode = 'expense' | 'income';

interface CategoryDatum {
  name: string;
  color: string;
  value: number;
  percentage: number;
}

const FALLBACK_COLOR = '#94a3b8';
const OTROS_COLOR = '#64748b';
const MIN_PERCENTAGE = 3; // Categorías < 3% se agrupan en "Otros"
const BAR_WIDTH_PER_CATEGORY = 56; // px por barra
const BAR_CHART_HEIGHT = 220;
const Y_AXIS_WIDTH = 48;

export function TransactionChartsContent({
  transactions,
  defaultCurrency,
}: TransactionChartsContentProps) {
  const [mode, setMode] = useState<ChartMode>('expense');
  const [showDetail, setShowDetail] = useState(false);

  // Datos crudos por categoría
  const allData = useMemo<CategoryDatum[]>(() => {
    const map = new Map<string, { name: string; color: string; income: number; expense: number }>();
    for (const t of transactions) {
      const key = t.categoryName ?? 'Sin categoría';
      const existing = map.get(key);
      const entry = existing ?? { name: key, color: t.categoryColor ?? FALLBACK_COLOR, income: 0, expense: 0 };
      const amount = Math.abs(parseFloat(t.originalAmount));
      if (t.type === 'income') entry.income += amount;
      else entry.expense += amount;
      if (!existing) map.set(key, entry);
    }

    const entries = Array.from(map.values())
      .map((d) => ({
        name: d.name,
        color: d.color,
        value: mode === 'expense' ? d.expense : d.income,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const total = entries.reduce((sum, d) => sum + d.value, 0);
    return entries.map((d) => ({
      ...d,
      percentage: total > 0 ? (d.value / total) * 100 : 0,
    }));
  }, [transactions, mode]);

  // Datos para pie chart: agrupar categorías pequeñas en "Otros"
  const pieData = useMemo<CategoryDatum[]>(() => {
    const main: CategoryDatum[] = [];
    let otrosValue = 0;

    for (const d of allData) {
      if (d.percentage >= MIN_PERCENTAGE) {
        main.push(d);
      } else {
        otrosValue += d.value;
      }
    }

    if (otrosValue > 0) {
      const total = allData.reduce((sum, d) => sum + d.value, 0);
      main.push({
        name: 'Otros',
        color: OTROS_COLOR,
        value: otrosValue,
        percentage: total > 0 ? (otrosValue / total) * 100 : 0,
      });
    }

    return main;
  }, [allData]);

  // Bar chart dimensions
  const barChartWidth = Math.max(250, allData.length * BAR_WIDTH_PER_CATEGORY);
  const maxValue = useMemo(() => Math.max(...allData.map((d) => d.value), 0), [allData]);

  const total = allData.reduce((sum, d) => sum + d.value, 0);

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg flex flex-col overflow-hidden">
        <DrawerHeader>
          <DrawerTitle>Gráficos por categoría</DrawerTitle>
          <DrawerDescription>
            Distribución de {mode === 'expense' ? 'gastos' : 'ingresos'} por categoría
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ChartMode)}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">Gastos</TabsTrigger>
              <TabsTrigger value="income" className="flex-1">Ingresos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 space-y-6">
          {allData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No hay {mode === 'expense' ? 'gastos' : 'ingresos'} en este período.
            </p>
          ) : (
            <>
              {/* Pie Chart — sin labels, con leyenda inline */}
              <div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={1.5}
                        label={false}
                        labelLine={false}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatCurrency(value, defaultCurrency),
                          name,
                        ]}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--background)',
                          color: 'var(--foreground)',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: 'var(--foreground)' }}
                        itemStyle={{ color: 'var(--foreground)' }}
                      />
                      {/* Center label */}
                      <text
                        x="50%"
                        y="48%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--foreground)"
                        style={{ fontSize: '14px', fontWeight: 600 }}
                      >
                        {formatCurrency(total, defaultCurrency)}
                      </text>
                      <text
                        x="50%"
                        y="58%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--muted-foreground)"
                        style={{ fontSize: '10px' }}
                      >
                        {allData.length} categorías
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Leyenda compacta del pie */}
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: d.color }}
                      />
                      <span>{d.name} {d.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar Chart — scroll horizontal con Y-axis sticky */}
              <div>
                <h3 className="text-sm font-medium mb-3">
                  Montos por categoría
                </h3>
                <div className="overflow-x-auto -mx-4 pb-2">
                  <div className="flex" style={{ minWidth: Y_AXIS_WIDTH + barChartWidth }}>
                    {/* Sticky Y-axis */}
                    <div
                      className="sticky left-0 z-10 shrink-0 bg-card dark:bg-slate-900"
                      style={{ width: Y_AXIS_WIDTH }}
                    >
                      <BarChart
                        width={Y_AXIS_WIDTH}
                        height={BAR_CHART_HEIGHT}
                        data={allData}
                        margin={{ top: 8, right: 0, bottom: 48, left: 0 }}
                      >
                        <YAxis
                          domain={[0, maxValue]}
                          tickFormatter={(v: number) => {
                            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                            return String(v);
                          }}
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                          width={Y_AXIS_WIDTH}
                        />
                      </BarChart>
                    </div>
                    {/* Scrollable bars */}
                    <div className="shrink-0" style={{ width: barChartWidth }}>
                      <BarChart
                        data={allData}
                        width={barChartWidth}
                        height={BAR_CHART_HEIGHT}
                        margin={{ top: 8, right: 12, bottom: 48, left: 0 }}
                      >
                        <YAxis hide domain={[0, maxValue]} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          angle={-40}
                          textAnchor="end"
                          height={48}
                          tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                        />
                        <Tooltip
                          content={({ active, payload }: TooltipProps<number, string>) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload as CategoryDatum;
                            return (
                              <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                                <p className="font-medium text-foreground">{d.name}</p>
                                <p className="text-muted-foreground">
                                  {formatCurrency(d.value, defaultCurrency)} · {d.percentage.toFixed(1)}%
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          {allData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalle colapsable */}
              <div>
                <button
                  onClick={() => setShowDetail((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Detalle ({allData.length})
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDetail ? 'rotate-180' : ''}`} />
                </button>
                {showDetail && (
                  <div className="space-y-1.5 mt-2">
                    {allData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-muted-foreground text-xs">{d.percentage.toFixed(1)}%</span>
                          <span className="font-medium tabular-nums">{formatCurrency(d.value, defaultCurrency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DrawerContent>
  );
}
