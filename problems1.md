## 📋 **PLAN DE MEJORAS**

### **FASE 1: Corrección Crítica - Herramienta de Audio**

#### **1.1 Agregar `playAudioTool` a las herramientas disponibles**

```typescript
// En app/(chat)/api/chat/route.ts
import { playAudioTool } from '@/lib/ai/tools/play-audio';

tools: {
  getWeather,
  createDocument: createDocument({ session, dataStream }),
  updateDocument: updateDocument({ session, dataStream }),
  requestSuggestions: requestSuggestions({ session, dataStream }),
  examSectionControl: examSectionControl({ dataStream }),
  playAudio: playAudioTool({ session, dataStream }), // AGREGAR ESTA LÍNEA
},
```

#### **1.2 Modificar `playAudioTool` para trabajar con grabaciones específicas**

```typescript
// En lib/ai/tools/play-audio.ts - modificar parámetros
parameters: z.object({
  title: z.string(),
  subsection: z.string(),
  recordingNumber: z.number().min(1).max(6), // NUEVO: especificar grabación
  isExamRecording: z.boolean().default(true),
}),
```
