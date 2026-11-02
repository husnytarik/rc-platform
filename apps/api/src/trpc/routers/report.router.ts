import { z } from 'zod';
import type { ReportService } from '../../report/report.service';
import { capabilityProcedure, router } from '../trpc';

export function makeReportRouter(reports: ReportService) {
  return router({
    summary: capabilityProcedure('report.view')
      .input(z.object({ days: z.number().int().min(1).max(365).default(30) }).default({ days: 30 }))
      .query(({ input }) => reports.summary(input.days)),
  });
}
