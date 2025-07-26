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

// Add server-side debouncing to prevent AI from making multiple rapid calls
const lastCallTracker = new Map<
  string,
  { action: string; timestamp: number; successful: boolean }
>();

export const examSectionControl = ({ dataStream }: ExamSectionControlProps) =>
  tool({
    description: `Control exam section progression and completion during any type of evaluation or assessment. Use this tool ONLY ONCE per section change request.

Use this tool when:
- User indicates readiness to move to next part (e.g., "let's go to the next section", "skip this part")
- Current section/subsection objectives have been met
- Time to advance naturally in the exam flow
- Need to mark current section as completed
- User requests to finish the exam or all sections are complete

CRITICAL: This tool should only be called ONCE per user request. Do not call it multiple times for the same action.

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

      // Prevent advance_to_next calls that mention automatic advancement
      if (
        action === 'advance_to_next' &&
        reason?.includes('automatically advancing')
      ) {
        console.log(
          '🚫 [EXAM TOOL] Preventing advance_to_next with automatic advancement reason',
        );
        return {
          success: false,
          message:
            'Automatic advancement is handled by the system. Do not call this tool for automatic progression.',
        };
      }

      // Enhanced server-side debouncing - prevent multiple rapid calls
      // EXCEPTION: complete_exam should never be debounced since it's a final action
      const sessionKey = `${action}-${targetSection || 'none'}`;
      const now = Date.now();
      if (action !== 'complete_exam') {
        const lastCall = lastCallTracker.get(sessionKey);

        // Check if we recently had a successful call for the same action
        if (lastCall) {
          const timeSinceLastCall = now - lastCall.timestamp;

          // If the last call was successful and within 10 seconds, completely block it
          if (lastCall.successful && timeSinceLastCall < 10000) {
            console.log('🚫 [EXAM TOOL] Blocking duplicate successful call:', {
              action,
              targetSection,
              timeSinceLastCall,
              lastCallWasSuccessful: lastCall.successful,
            });
            // Return minimal response - no user-visible message
            return {
              success: false,
              duplicate: true,
            };
          }

          // For any call within 5 seconds, block it
          if (timeSinceLastCall < 5000) {
            console.log('🚫 [EXAM TOOL] Debouncing rapid call:', {
              action,
              targetSection,
              timeSinceLastCall,
            });
            // Return minimal response - no user-visible message
            return {
              success: false,
              debounced: true,
            };
          }
        }
      } else {
        console.log(
          '✅ [EXAM TOOL] complete_exam action - skipping debouncing',
        );
      }

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

      // Update the call tracker with successful call
      lastCallTracker.set(sessionKey, {
        action,
        timestamp: now,
        successful: true,
      });

      // Return minimal success response - no user-visible message
      return {
        success: true,
        action,
        targetSection,
        completed: true,
      };
    },
  });
