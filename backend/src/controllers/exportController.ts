import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { exportService } from '../services/exportService';

export const exportMarksCSV = asyncHandler(async (req: Request, res: Response) => {
  const teacherId = req.user!._id.toString();

  const rows = await exportService.getTeacherMarksData(teacherId);

  if (rows.length === 0) {
    // Return a CSV with headers only
    const emptyCSV = exportService.generateCSV([]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_marks.csv"');
    res.status(200).send(emptyCSV);
    return;
  }

  const csv = exportService.generateCSV(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student_marks.csv"');
  res.status(200).send(csv);
});
