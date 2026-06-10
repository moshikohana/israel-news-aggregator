import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { formatAnswer, isSafeSelect, questionToSql } from "../ai";
import { runReadonlyQuery } from "../db";
import { findDuplicateGroups, type DuplicateGroup } from "../duplicates";

export const chatRouter = router({
  ask: protectedProcedure
    .input(z.object({ question: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const question = input.question.trim();
      let sqlText = "";
      try {
        sqlText = await questionToSql(question);
      } catch (e: any) {
        return {
          answer: "אירעה שגיאה בהבנת השאלה. נסה לנסח אותה מחדש.",
          sql: "",
          results: [] as any[],
          duplicateGroups: [] as DuplicateGroup[],
        };
      }

      if (!isSafeSelect(sqlText)) {
        return {
          answer:
            'מצטער, יכולתי להמיר את השאלה רק לשאילתה שאינה בטוחה להרצה. נסה לנסח מחדש בשאלת מידע (לדוגמה: "מי חברי המרכז מירושלים?").',
          sql: sqlText,
          results: [] as any[],
          duplicateGroups: [] as DuplicateGroup[],
        };
      }

      let results: any[] = [];
      try {
        results = await runReadonlyQuery(sqlText);
      } catch (e: any) {
        return {
          answer: "אירעה שגיאה בהרצת השאילתה על הנתונים. נסה לנסח את השאלה אחרת.",
          sql: sqlText,
          results: [] as any[],
          duplicateGroups: [] as DuplicateGroup[],
        };
      }

      let answer = "";
      try {
        answer = await formatAnswer(question, sqlText, results);
      } catch (e: any) {
        answer = "התקבלו נתונים אך אירעה שגיאה בניסוח התשובה.";
      }

      return { answer, sql: sqlText, results, duplicateGroups: findDuplicateGroups(results) };
    }),
});
