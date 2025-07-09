import { z } from 'zod';
import { tool } from 'ai';
import type { DataStreamWriter } from 'ai';

interface ExamSectionControlParams {
  action: 'complete_and_advance' | 'complete_current' | 'advance_to_section';
  targetSection?: string;
  reason?: string;
}

interface ExamSectionControlProps {
  dataStream: DataStreamWriter;
}

export const examSectionControl = ({ dataStream }: ExamSectionControlProps) =>
  tool({
    description: `Control exam section progression during any type of evaluation or assessment. Use this tool when:
- User indicates readiness to move to next section (e.g., "let's go to the next section")
- Current section objectives have been met
- Time to advance naturally in the exam flow
- Need to mark current section as completed

This tool helps maintain proper exam flow and section tracking for any exam type with multiple sections.`,
    parameters: z.object({
      action: z.enum(['complete_and_advance', 'complete_current', 'advance_to_section']).describe(
        'Action to take: complete_and_advance (complete current and move to next), complete_current (just mark as complete), advance_to_section (move to specific section)'
      ),
      targetSection: z.string().optional().describe(
        'Target section number (e.g., "1", "2", "3", etc.) when using advance_to_section action'
      ),
      reason: z.string().optional().describe(
        'Brief reason for the section change (e.g., "section objectives completed", "user requested next section")'
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

      console.log('📤 [EXAM TOOL] Sending data stream event:', examControlEvent);

      // Write the event to the data stream so client can process it
      dataStream.writeData({
        type: 'exam-section-control',
        content: examControlEvent,
      });

      console.log('✅ [EXAM TOOL] Data stream event sent successfully');

      // Return a simple confirmation message
      return {
        success: true,
        action,
        targetSection,
        message: `Exam section control executed: ${action}${targetSection ? ` to section ${targetSection}` : ''}`,
      };
    },
  }); 