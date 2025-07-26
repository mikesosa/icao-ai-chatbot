import { type DataStreamWriter, tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';

export const displayImageTool = ({
  session: _session,
  dataStream,
}: {
  session: Session;
  dataStream: DataStreamWriter;
}) =>
  tool({
    description: `Display images for exam exercises that require image description or analysis.
    Use this tool to present images during any exam section that involves visual content.
    This tool creates a unified image display that works for both exam and general image display.
    Images can be shown individually or in pairs for comparison exercises.`,
    parameters: z.object({
      title: z
        .string()
        .describe(
          'Title for the image exercise (e.g., "Image 1 - Airport Terminal", "Comparison Images")',
        ),
      description: z
        .string()
        .optional()
        .describe(
          'Optional description of what the image shows or instructions for the exercise',
        ),
      images: z
        .array(
          z.object({
            url: z.string().describe('URL or path to the image'),
            alt: z.string().describe('Alternative text for the image'),
            caption: z
              .string()
              .optional()
              .describe('Optional caption for the image'),
          }),
        )
        .min(1)
        .max(3)
        .describe('Array of images to display (1-3 images)'),
      subsection: z
        .string()
        .optional()
        .describe(
          'Exam subsection identifier (e.g., "3A", "3B", "Image Description")',
        ),
      imageSetId: z
        .string()
        .optional()
        .describe(
          'Unique identifier for the image set (auto-generated if not provided)',
        ),
      isExamImage: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether this is an exam image (affects UI and behavior)'),
      layout: z
        .enum(['single', 'side-by-side', 'stacked'])
        .optional()
        .default('single')
        .describe(
          'How to layout multiple images: single (one at a time), side-by-side, or stacked',
        ),
      instructions: z
        .array(z.string())
        .optional()
        .describe(
          'Optional array of specific instructions for the image exercise',
        ),
    }),
    execute: async ({
      title,
      description,
      images,
      subsection,
      imageSetId,
      isExamImage = false,
      layout = 'single',
      instructions,
    }) => {
      try {
        // Validate images array
        if (!images || images.length === 0) {
          console.warn('🖼️ [DISPLAY IMAGE TOOL] No images provided');
          return {
            success: false,
            message: 'No images provided',
            error: 'At least one image is required',
          };
        }

        // Generate image set ID if not provided
        const finalImageSetId =
          imageSetId ||
          `image-set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(
          '🖼️ [DISPLAY IMAGE TOOL] Final image set ID:',
          finalImageSetId,
        );

        // Prepare image display data (similar to audio player data)
        const imageDisplayData = {
          type: 'image-display',
          content: {
            title,
            description: description || '',
            images,
            layout,
            subsection: subsection || '',
            imageSetId: finalImageSetId,
            isExamImage,
            instructions: instructions || [],
          },
        };
        console.log(
          '🖼️ [DISPLAY IMAGE TOOL] Image display data to send:',
          imageDisplayData,
        );

        // Send image display data to the data stream
        dataStream.writeData(imageDisplayData);

        // Return success message with details for the AI - following audio player pattern
        const imageCount = images.length;
        const layoutInfo = imageCount > 1 ? ` in ${layout} layout` : '';
        const result = {
          success: true,
          message: `Image display created with ${imageCount} image${imageCount > 1 ? 's' : ''}${layoutInfo}`,
          details: {
            title,
            description: description || '',
            images,
            layout,
            subsection: subsection || '',
            imageSetId: finalImageSetId,
            isExamImage,
            instructions: instructions || [],
            timestamp: new Date().toISOString(),
          },
        };
        console.log('🖼️ [DISPLAY IMAGE TOOL] Returning result:', result);
        return result;
      } catch (error) {
        console.error(
          '🖼️ [DISPLAY IMAGE TOOL] Error creating image display:',
          error,
        );
        return {
          success: false,
          message: 'Failed to create image display',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  });
