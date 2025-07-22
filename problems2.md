### **FASE 2: Coordinación de Evaluación**

#### **2.1 Crear herramienta de acceso a transcripts**

```typescript
// Nueva herramienta: lib/ai/tools/get-audio-transcript.ts
export const getAudioTranscript = tool({
  description: 'Get transcript and correct answers for a specific recording',
  parameters: z.object({
    subsection: z.string(), // "2A", "2B", "2C"
    recordingNumber: z.number(), // 1-6 for 2A, 1-4 for 2B, etc.
  }),
  execute: async ({ subsection, recordingNumber }) => {
    // Acceder a examConfig y retornar transcript + correctAnswers
    // para la grabación específica
  },
});
```

#### **2.2 Modificar el prompt del examen**

```typescript
// En exam-configs.json - agregar instrucciones específicas
"EVALUATION WORKFLOW": {
  "1": "Call playAudio with specific recordingNumber",
  "2": "After user responds, call getAudioTranscript with same recordingNumber",
  "3": "Compare user response with transcript data",
  "4": "Provide specific feedback based on accuracy"
}
```
