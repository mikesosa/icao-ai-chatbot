### **FASE 3: Tracking y Estado**

#### **3.1 Agregar estado de grabación actual al contexto**

```typescript
// En contexts/exam-context.tsx
interface ExamContextType {
  // Agregar campos para tracking de audio
  currentRecordingNumber: number;
  currentRecordingTranscript: string | null;
  currentRecordingAnswers: any | null;
  setCurrentRecording: (
    number: number,
    transcript: string,
    answers: any,
  ) => void;
}
```

#### **3.2 Secuencia ordenada de grabaciones**

```typescript
// Modificar playAudio para seguir secuencia
// 2A: grabaciones 1,2,3,4,5,6
// 2B: grabaciones 1,2,3,4
// 2C: grabaciones 1,2,3
```
