import { type DataStreamWriter, tool } from 'ai';
import { z } from 'zod';

interface _ExamSectionControlParams {
  action:
    | 'advance_to_next'
    | 'complete_and_advance'
    | 'complete_current'
    | 'advance_to_section'
    | 'complete_exam';
  targetSection?: string;
  reason?: string;
}

interface ExamSectionControlProps {
  dataStream: DataStreamWriter;
}

export const examSectionControl = ({ dataStream }: ExamSectionControlProps) =>
  tool({
    description: `Control exam section progression and completion during any type of evaluation or assessment. Use this tool when:
- User indicates readiness to move to next part (e.g., "let's go to the next section", "skip this part")
- Current section/subsection objectives have been met
- Time to advance naturally in the exam flow
- Need to mark current section as completed
- User requests to finish the exam or all sections are complete

IMPORTANT: This tool handles section, subsection progression AND exam completion:
- If user says "next section" while in a subsection, advance to the next subsection FIRST
- Only advance to next section when all subsections are complete
- Use "advance_to_next" for natural progression (subsection → subsection → section)
- Use "advance_to_section" only for specific section jumps
- Use "complete_exam" when all sections are done or user requests to finish exam

This tool helps maintain proper exam flow and section tracking for any exam type with multiple sections.`,
    parameters: z.object({
      action: z
        .enum([
          'advance_to_next',
          'complete_current',
          'advance_to_section',
          'complete_exam',
        ])
        .describe(
          'Action to take: advance_to_next (advance to next subsection or section naturally), complete_current (just mark as complete), advance_to_section (move to specific section), complete_exam (finish entire exam and provide final evaluation)',
        ),
      targetSection: z
        .string()
        .optional()
        .describe(
          'Target section number (e.g., "1", "2", "3", etc.) when using advance_to_section action',
        ),
      reason: z
        .string()
        .optional()
        .describe(
          'Brief reason for the section change (e.g., "section objectives completed", "user requested next section")',
        ),
    }),
    execute: async ({ action, targetSection, reason }) => {
      console.log('🎯 [EXAM TOOL] examSectionControl called:', {
        action,
        targetSection,
        reason,
      });

      // Create the exam control event (ensure all values are serializable)
      const examControlEvent = {
        type: 'exam-section-control' as const,
        action,
        targetSection: targetSection || null,
        reason: reason || 'Section progression',
        timestamp: new Date().toISOString(),
      };

      console.log(
        '📤 [EXAM TOOL] Sending data stream event:',
        examControlEvent,
      );

      // Write the event to the data stream so client can process it
      dataStream.writeData({
        type: 'exam-section-control',
        content: examControlEvent,
      });

      console.log('✅ [EXAM TOOL] Data stream event sent successfully');

      // Return success without a message to avoid duplicate responses
      return {
        success: true,
        action,
        targetSection,
      };
    },
  });
