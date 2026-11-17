import { z } from 'zod';
import type { ReportService } from '../../report/report.service';
import { capabilityProcedure, router } from '../trpc';

export function makeReportRouter(reports: ReportService) {
  const daysInput = z.object({ days: z.number().int().min(1).max(365).default(30) }).default({ days: 30 });
  return router({
    entries: capabilityProcedure('salesreport.write')
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), cursor: z.string().uuid().optional() }).default({}))
      .query(({ input, ctx }) => reports.entries(ctx.user, input)),

    addEntry: capabilityProcedure('salesreport.write')
      .input(z.object({ title: z.string().min(2).max(200), body: z.string().max(3000).nullable().optional(), occurredAt: z.coerce.date() }))
      .mutation(({ input, ctx }) => reports.addEntry(ctx.user, input)),

    removeEntry: capabilityProcedure('salesreport.write')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input, ctx }) => reports.removeEntry(ctx.user, input.id)),

    byRep: capabilityProcedure('report.view')
      .input(daysInput)
      .query(({ input }) => reports.byRep(input.days)),

    summary: capabilityProcedure('report.view')
      .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).default({ days: 30 }))
      .query(({ input }) => reports.summary(input.days)),
  });
}
