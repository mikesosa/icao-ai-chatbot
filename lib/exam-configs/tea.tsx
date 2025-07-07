import { FileText, Headphones, MessageSquare } from 'lucide-react';
import type { CompleteExamConfig } from './index';

export const TEA_EXAM_CONFIG: CompleteExamConfig = {
  id: 'tea',
  name: 'TEA',
  examConfig: {
    name: 'TEA',
    sections: {
      1: { name: 'Entrevista', duration: 2 * 60, color: 'bg-blue-500' },
      2: { name: 'Comprensión', duration: 2 * 60, color: 'bg-green-500' },
      3: { name: 'Discusión', duration: 2 * 60, color: 'bg-purple-500' },
    },
  },
  controlsConfig: {
    name: 'TEA',
    totalSections: 3,
    sections: [
      {
        number: 1,
        title: 'Entrevista y Experiencia',
        description:
          'Preguntas sobre rol profesional y experiencia en aviación',
        icon: <FileText className="size-5" />,
        duration: '7-8 min',
      },
      {
        number: 2,
        title: 'Comprensión Interactiva',
        description: 'Escucha situaciones aeronáuticas y demuestra comprensión',
        icon: <Headphones className="size-5" />,
        duration: '8-12 min',
      },
      {
        number: 3,
        title: 'Descripción y Discusión',
        description: 'Describe imágenes y participa en discusión general',
        icon: <MessageSquare className="size-5" />,
        duration: '10 min',
      },
    ],
    totalDuration: '25-30 minutos',
    startButtonText: 'Iniciar Examen TEA',
    finishButtonText: 'Finalizar Examen',
  },
  messagesConfig: {
    welcomeMessage: `¡Bienvenido al simulador del Test de Inglés Aeronáutico (TEA)!

Soy su evaluador certificado ICAO. Este examen evalúa su competencia lingüística en inglés para operaciones aeronáuticas.

**INFORMACIÓN DEL EXAMEN:**
- ⏱️ Duración: 25-30 minutos
- 📋 3 secciones obligatorias
- 🎯 Nivel mínimo requerido: ICAO Nivel 4 (Operacional)

**INSTRUCCIONES:**
1. Use el panel de control para iniciar el examen
2. Complete cada sección en orden
3. El timer controla la duración de cada sección
4. Responda de manera natural y completa

¿Está listo para comenzar? Haga clic en "Iniciar Examen TEA" cuando esté preparado.`,
    sectionStartMessages: {
      1: `**SECCIÓN 1: ENTREVISTA Y EXPERIENCIA** (7-8 minutos)

Comenzemos con algunas preguntas sobre su experiencia profesional en aviación.

1. **¿Cuál es su rol actual en la aviación?**
   - ¿Es usted piloto, controlador de tráfico aéreo, técnico u otro profesional?
   - ¿Cuántos años de experiencia tiene en este rol?

Por favor, responda de manera detallada y natural.`,
      2: `**SECCIÓN 2: COMPRENSIÓN INTERACTIVA** (8-12 minutos)

Ahora evaluaré su comprensión auditiva. Le presentaré situaciones aeronáuticas que debe interpretar y explicar.`,
      3: `**SECCIÓN 3: DESCRIPCIÓN Y DISCUSIÓN** (10 minutos)

Finalmente, describirá imágenes relacionadas con aviación y participará en una discusión general sobre temas aeronáuticos.`,
    },
    completionMessage: `**🎉 EXAMEN TEA COMPLETADO**

Felicitaciones, ha completado las 3 secciones del Test de Inglés Aeronáutico.

**RESUMEN DEL EXAMEN:**
- ✅ Sección 1: Entrevista y Experiencia
- ✅ Sección 2: Comprensión Interactiva  
- ✅ Sección 3: Descripción y Discusión

Ahora procederé a evaluar su desempeño según los criterios ICAO y le proporcionaré su puntuación final con recomendaciones específicas.

**Criterios de Evaluación ICAO:**
1. Pronunciación
2. Estructura Gramatical
3. Vocabulario
4. Fluidez
5. Comprensión
6. Interacciones

¿Desea recibir su evaluación final ahora?`,
    quickInstructions: [
      'Responda de manera natural y completa',
      'Use vocabulario técnico cuando sea apropiado',
      'No se preocupe por errores menores',
      'El evaluador le hará preguntas de seguimiento',
      'Mantenga una conversación fluida',
    ],
  },
};
